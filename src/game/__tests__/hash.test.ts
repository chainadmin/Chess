import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sha256Hex, hashPassword, randomSalt } from '../../services/auth/hash';

test('sha256Hex matches known test vectors', () => {
  assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('hashPassword is salted and deterministic for the same salt', () => {
  const salt = randomSalt();
  assert.equal(hashPassword('hunter2', salt), hashPassword('hunter2', salt));
  assert.notEqual(hashPassword('hunter2', salt), hashPassword('hunter3', salt));
  assert.notEqual(hashPassword('hunter2', randomSalt()), hashPassword('hunter2', randomSalt()));
  assert.notEqual(hashPassword('hunter2', salt), 'hunter2');
});

test('randomSalt produces distinct 16-hex-char salts', () => {
  const a = randomSalt(), b = randomSalt();
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.notEqual(a, b);
});
