import { IncomingMessage, ServerResponse } from 'node:http';

export class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

export function positive(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive integer.`);
  return value;
}

export function parseOrigins(origins: string[]) {
  const set = new Set(origins);
  for (const origin of set) {
    const parsed = new URL(origin);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) throw new Error('CORS origins must be exact HTTP(S) origins.');
  }
  return set;
}

/**
 * Railway (and most hosts) put a proxy in front of the service. With
 * trustProxyHops = 1 we use the address that proxy appended to X-Forwarded-For.
 * With 0 (local development) forwarded headers are ignored.
 */
export function clientAddress(req: IncomingMessage, trustProxyHops: number): string {
  const direct = req.socket.remoteAddress ?? 'unknown';
  if (trustProxyHops < 1) return direct;
  const header = req.headers['x-forwarded-for'];
  const chain = (Array.isArray(header) ? header.join(',') : header ?? '').split(',').map(part => part.trim()).filter(Boolean);
  return chain[chain.length - trustProxyHops] ?? direct;
}

export type Window = { resetAt: number; count: number };
export function rateLimiter(now: () => number) {
  const window = (): Window => ({ resetAt: now() + 60_000, count: 0 });
  const consume = (budget: Window, limit: number, res: ServerResponse) => {
    const time = now();
    if (budget.resetAt <= time) { budget.resetAt = time + 60_000; budget.count = 0; }
    if (budget.count >= limit) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((budget.resetAt - time) / 1000))));
      throw new HttpError(429, 'rate_limited', 'Too many requests. Try again later.');
    }
    budget.count++;
  };
  return { window, consume };
}

export function sendJson(res: ServerResponse, status: number, body: unknown) {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}

export function sendHtml(res: ServerResponse, html: string) {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  });
  res.end(html);
}

export async function readJson(req: IncomingMessage, maxBody: number): Promise<unknown> {
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new HttpError(415, 'unsupported_media_type', 'Send application/json.');
  }
  if (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity') {
    throw new HttpError(415, 'unsupported_encoding', 'Compressed request bodies are not supported.');
  }
  if (Number(req.headers['content-length']) > maxBody) throw new HttpError(413, 'body_too_large', 'Request body is too large.');
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    const cleanup = () => { req.off('data', data); req.off('end', end); req.off('error', error); req.off('aborted', error); };
    const error = () => { cleanup(); reject(new HttpError(400, 'invalid_body', 'Incomplete request body.')); };
    const data = (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > maxBody) { cleanup(); req.pause(); reject(new HttpError(413, 'body_too_large', 'Request body is too large.')); }
      else chunks.push(chunk);
    };
    const end = () => {
      cleanup();
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new HttpError(400, 'invalid_json', 'Request body must be valid JSON.')); }
    };
    req.on('data', data); req.on('end', end); req.on('error', error); req.on('aborted', error);
  });
}

export function envOrigins(name: string, fallback: string[]): string[] {
  const value = process.env[name];
  return value === undefined ? fallback : value.split(',').map(origin => origin.trim()).filter(Boolean);
}

export function envInt(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative integer.`);
  return parsed;
}
