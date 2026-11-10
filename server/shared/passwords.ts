import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const N = 16384, R = 8, P = 1, KEY_LENGTH = 64;
const derive = (password: string, salt: Buffer, n = N, r = R, p = P) => new Promise<Buffer>((resolve, reject) => {
  scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key));
});

/** scrypt$N$r$p$salt$hash — runs off the event loop via libuv's thread pool. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = await derive(password, Buffer.from(salt, 'base64url'), Number(n), Number(r), Number(p));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Burns comparable time when a username does not exist, so timing does not reveal accounts. */
let dummy: Promise<string> | undefined;
export async function dummyVerify(password: string) {
  dummy ??= hashPassword('not-a-real-password');
  await verifyPassword(password, await dummy);
}

export const newToken = () => randomBytes(32).toString('base64url');
export const tokenDigest = (token: string) => createHash('sha256').update(token).digest('hex');
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
const RESERVED = new Set(['admin', 'administrator', 'support', 'moderator', 'shiftchess', 'system', 'guest', 'root', 'chain', 'chainsoftware', 'chainsoftwaregroup']);
export function usernameProblem(username: unknown): string | null {
  if (typeof username !== 'string' || !USERNAME_PATTERN.test(username)) return 'Usernames are 3–20 letters, numbers or underscores.';
  if (RESERVED.has(username.toLowerCase()) || /^guest_?\d*$/i.test(username)) return 'That username is reserved. Pick another one.';
  return null;
}
export const MIN_PASSWORD = 8, MAX_PASSWORD = 128;
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) return `Passwords need at least ${MIN_PASSWORD} characters.`;
  if (password.length > MAX_PASSWORD) return `Passwords can be at most ${MAX_PASSWORD} characters.`;
  return null;
}
