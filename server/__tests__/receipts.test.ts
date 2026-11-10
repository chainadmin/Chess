import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createPrivateKey, generateKeyPairSync, sign, X509Certificate } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GooglePlayVerifier, ReceiptError, verifyAppleTransaction } from '../api/receipts';

let openssl = true;
try { execFileSync('openssl', ['version'], { stdio: 'ignore' }); } catch { openssl = false; }

/** Builds a throwaway root → intermediate → leaf chain shaped like Apple's (same marker OIDs). */
function fakeAppleChain() {
  const dir = mkdtempSync(join(tmpdir(), 'jws-'));
  const run = (...args: string[]) => execFileSync('openssl', args, { cwd: dir, stdio: 'pipe' });
  try {
    for (const name of ['root', 'int', 'leaf']) run('ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', `${name}.key`);
    run('req', '-x509', '-new', '-key', 'root.key', '-subj', '/CN=Test Root', '-days', '3', '-out', 'root.pem',
      '-addext', 'basicConstraints=critical,CA:true', '-addext', 'keyUsage=critical,keyCertSign');
    writeFileSync(join(dir, 'int.ext'), 'basicConstraints=critical,CA:true\nkeyUsage=critical,keyCertSign\n1.2.840.113635.100.6.2.1=ASN1:NULL\n');
    writeFileSync(join(dir, 'leaf.ext'), 'basicConstraints=critical,CA:false\n1.2.840.113635.100.6.11.1=ASN1:NULL\n');
    run('req', '-new', '-key', 'int.key', '-subj', '/CN=Test WWDR', '-out', 'int.csr');
    run('x509', '-req', '-in', 'int.csr', '-CA', 'root.pem', '-CAkey', 'root.key', '-CAcreateserial', '-days', '2', '-extfile', 'int.ext', '-out', 'int.pem');
    run('req', '-new', '-key', 'leaf.key', '-subj', '/CN=Test StoreKit', '-out', 'leaf.csr');
    run('x509', '-req', '-in', 'leaf.csr', '-CA', 'int.pem', '-CAkey', 'int.key', '-CAcreateserial', '-days', '1', '-extfile', 'leaf.ext', '-out', 'leaf.pem');
    const der = (name: string) => new X509Certificate(readFileSync(join(dir, `${name}.pem`))).raw.toString('base64');
    return { x5c: [der('leaf'), der('int'), der('root')], key: createPrivateKey(readFileSync(join(dir, 'leaf.key'))), fingerprint: new X509Certificate(readFileSync(join(dir, 'root.pem'))).fingerprint256 };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('StoreKit 2 JWS verification checks chain, signature, app and product', { skip: !openssl && 'openssl unavailable' }, () => {
  const chain = fakeAppleChain();
  const make = (payload: object, key = chain.key, x5c = chain.x5c) => {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${encode({ alg: 'ES256', x5c })}.${encode(payload)}`;
    return `${unsigned}.${sign('sha256', Buffer.from(unsigned), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
  };
  const good = { bundleId: 'com.example.chess', productId: 'remove_ads', transactionId: '2000000123', originalTransactionId: '2000000100', type: 'Non-Consumable', environment: 'Sandbox' };
  const options = { bundleId: 'com.example.chess', rootFingerprint: chain.fingerprint };

  assert.deepEqual(verifyAppleTransaction(make(good), 'remove_ads', options), { platform: 'ios', productId: 'remove_ads', transactionId: '2000000100' });
  const reject = (jws: string, product = 'remove_ads', opts = options) => assert.throws(() => verifyAppleTransaction(jws, product, opts), ReceiptError);
  reject(make(good), 'remove_ads', { bundleId: 'com.example.chess' } as typeof options); // real Apple root required by default
  reject(make({ ...good, bundleId: 'com.other.app' }));
  reject(make(good), 'pieces_forged_metal');
  reject(make({ ...good, revocationDate: 1 }));
  reject(make(good, generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey));
  reject(make(good, chain.key, [chain.x5c[0], chain.x5c[2], chain.x5c[2]]));
  const [h, p, s] = make(good).split('.');
  const forged = Buffer.from(JSON.stringify({ ...good, productId: 'pieces_royal_lacquer' })).toString('base64url');
  reject(`${h}.${forged}.${s}`, 'pieces_royal_lacquer');
  reject(`${h}.${p}`);
  reject('garbage');
  // Certificates past their validity window are rejected.
  reject(make(good), 'remove_ads', { ...options, now: () => Date.now() + 10 * 86400_000 } as typeof options);
});

test('Google Play verification uses the Android Publisher API and requires a purchased state', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const calls: string[] = [];
  let state = 0;
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push(url.split('?')[0]);
    if (url.includes('oauth2')) {
      assert.match(String(init?.body), /grant_type=urn/);
      return new Response(JSON.stringify({ access_token: 'access', expires_in: 3600 }));
    }
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer access');
    return new Response(JSON.stringify({ purchaseState: state, orderId: 'GPA.1234' }));
  }) as typeof fetch;
  const google = new GooglePlayVerifier({
    packageName: 'com.example.chess', fetch: fakeFetch,
    serviceAccount: { client_email: 'svc@example.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() },
  });
  assert.deepEqual(await google.verify('remove_ads', 'token-abcdefghij'), { platform: 'android', productId: 'remove_ads', transactionId: 'GPA.1234' });
  await google.verify('remove_ads', 'token-abcdefghij');
  assert.equal(calls.filter(call => call.includes('oauth2')).length, 1, 'access token is cached');
  assert.match(calls[1], /applications\/com\.example\.chess\/purchases\/products\/remove_ads\/tokens\/token-abcdefghij$/);
  state = 1;
  await assert.rejects(google.verify('remove_ads', 'token-abcdefghij'), ReceiptError);
  await assert.rejects(google.verify('not_a_product', 'token-abcdefghij'), ReceiptError);
});
