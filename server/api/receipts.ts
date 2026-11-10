import { createHash, createSign, verify as verifySignature, X509Certificate } from 'node:crypto';
import { isProductId, ProductId } from '../../src/services/purchases/products';

export type VerifiedPurchase = { platform: 'ios' | 'android'; productId: ProductId; transactionId: string };
export class ReceiptError extends Error {
  constructor(readonly code: 'invalid_receipt' | 'not_configured' | 'store_unavailable', message: string) { super(message); }
}
export interface ReceiptVerifier {
  verify(platform: 'ios' | 'android', productId: string, purchaseToken: string): Promise<VerifiedPurchase>;
}

/** SHA-256 fingerprint of "Apple Root CA - G3", the root of every StoreKit 2 signature. */
export const APPLE_ROOT_CA_G3_FINGERPRINT = '63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79';
// DER encodings of Apple's marker OIDs: 1.2.840.113635.100.6.11.1 (leaf) and 1.2.840.113635.100.6.2.1 (WWDR intermediate).
const LEAF_OID = Buffer.from('060a2a864886f76364060b01', 'hex');
const INTERMEDIATE_OID = Buffer.from('060a2a864886f763640602 01'.replace(/ /g, ''), 'hex');

const invalid = (message = 'The store receipt could not be verified.') => new ReceiptError('invalid_receipt', message);
const b64json = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;

export type AppleOptions = { bundleId: string; now?: () => number; rootFingerprint?: string };

/**
 * Verifies a StoreKit 2 signed transaction (JWS) fully offline: the x5c chain must
 * end at Apple Root CA G3, each certificate must be valid and issued by the next,
 * and the leaf key must sign the payload. Sandbox transactions are accepted
 * because App Review purchases in the sandbox.
 */
export function verifyAppleTransaction(jws: string, expectedProductId: string, options: AppleOptions): VerifiedPurchase {
  const parts = jws.split('.');
  if (parts.length !== 3) throw invalid();
  let header: Record<string, unknown>, payload: Record<string, unknown>;
  try { header = b64json(parts[0]); payload = b64json(parts[1]); } catch { throw invalid(); }
  if (header.alg !== 'ES256' || !Array.isArray(header.x5c) || header.x5c.length !== 3) throw invalid();
  let chain: X509Certificate[];
  try { chain = (header.x5c as unknown[]).map(cert => new X509Certificate(Buffer.from(String(cert), 'base64'))); } catch { throw invalid(); }
  const [leaf, intermediate, root] = chain;
  const now = options.now?.() ?? Date.now();
  if (root.fingerprint256 !== (options.rootFingerprint ?? APPLE_ROOT_CA_G3_FINGERPRINT)) throw invalid();
  for (const [subject, issuer] of [[leaf, intermediate], [intermediate, root], [root, root]] as const) {
    if (!subject.checkIssued(issuer) || !subject.verify(issuer.publicKey)) throw invalid();
    if (Date.parse(subject.validFrom) > now || Date.parse(subject.validTo) < now) throw invalid();
  }
  if (!leaf.raw.includes(LEAF_OID) || !intermediate.raw.includes(INTERMEDIATE_OID)) throw invalid();
  const signed = verifySignature('sha256', Buffer.from(`${parts[0]}.${parts[1]}`), { key: leaf.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(parts[2], 'base64url'));
  if (!signed) throw invalid();

  if (payload.bundleId !== options.bundleId) throw invalid('This receipt belongs to a different app.');
  if (payload.productId !== expectedProductId || !isProductId(payload.productId)) throw invalid('This receipt is for a different product.');
  if (payload.revocationDate !== undefined) throw invalid('This purchase was refunded or revoked.');
  if (payload.type !== undefined && payload.type !== 'Non-Consumable') throw invalid('Unexpected purchase type.');
  const transactionId = String(payload.originalTransactionId ?? payload.transactionId ?? '');
  if (!/^\d{1,40}$/.test(transactionId)) throw invalid();
  return { platform: 'ios', productId: payload.productId, transactionId };
}

export type GoogleOptions = {
  packageName: string;
  /** The full JSON key of a Google Cloud service account invited in Play Console. */
  serviceAccount: { client_email: string; private_key: string; token_uri?: string };
  fetch?: typeof fetch; now?: () => number;
};

/** Verifies Google Play one-time products through the Android Publisher API. */
export class GooglePlayVerifier {
  private accessToken?: { value: string; expiresAt: number };
  private readonly fetcher: typeof fetch;
  private readonly now: () => number;
  constructor(private readonly options: GoogleOptions) {
    this.fetcher = options.fetch ?? fetch;
    this.now = options.now ?? Date.now;
  }

  private async token(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > this.now() + 60_000) return this.accessToken.value;
    const { client_email, private_key, token_uri = 'https://oauth2.googleapis.com/token' } = this.options.serviceAccount;
    const iat = Math.floor(this.now() / 1000);
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: token_uri, iat, exp: iat + 3600 })}`;
    const signature = createSign('RSA-SHA256').update(unsigned).sign(private_key).toString('base64url');
    const response = await this.fetcher(token_uri, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }).toString(),
    });
    if (!response.ok) throw new ReceiptError('store_unavailable', 'Google Play verification is unavailable. Try again later.');
    const data = await response.json() as { access_token?: string; expires_in?: number };
    if (!data.access_token) throw new ReceiptError('store_unavailable', 'Google Play verification is unavailable. Try again later.');
    this.accessToken = { value: data.access_token, expiresAt: this.now() + (data.expires_in ?? 3600) * 1000 };
    return data.access_token;
  }

  async verify(productId: string, purchaseToken: string): Promise<VerifiedPurchase> {
    if (!isProductId(productId) || !/^[A-Za-z0-9._:-]{10,4096}$/.test(purchaseToken)) throw invalid();
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(this.options.packageName)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
    const response = await this.fetcher(url, { headers: { Authorization: `Bearer ${await this.token()}` } });
    if (response.status === 400 || response.status === 404 || response.status === 410) throw invalid();
    if (!response.ok) throw new ReceiptError('store_unavailable', 'Google Play verification is unavailable. Try again later.');
    const data = await response.json() as { purchaseState?: number; orderId?: string };
    if (data.purchaseState !== 0) throw invalid('This purchase is pending, cancelled or refunded.');
    const transactionId = data.orderId || `token:${createHash('sha256').update(purchaseToken).digest('hex')}`;
    return { platform: 'android', productId, transactionId };
  }
}

/** Builds the verifier from environment variables. Unconfigured platforms fail closed. */
export function receiptVerifierFromEnv(env: NodeJS.ProcessEnv = process.env): ReceiptVerifier {
  let google: GooglePlayVerifier | undefined;
  if (env.GOOGLE_PLAY_PACKAGE_NAME && env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    google = new GooglePlayVerifier({ packageName: env.GOOGLE_PLAY_PACKAGE_NAME, serviceAccount: JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON) });
  }
  return {
    async verify(platform, productId, purchaseToken) {
      if (platform === 'ios') {
        if (!env.APPLE_BUNDLE_ID) throw new ReceiptError('not_configured', 'App Store purchases are not configured on the server.');
        return verifyAppleTransaction(purchaseToken, productId, { bundleId: env.APPLE_BUNDLE_ID });
      }
      if (!google) throw new ReceiptError('not_configured', 'Google Play purchases are not configured on the server.');
      return google.verify(productId, purchaseToken);
    },
  };
}
