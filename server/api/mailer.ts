import { createHash, randomBytes } from 'node:crypto';

export type Email = { to: string; subject: string; text: string; html: string };
export interface Mailer { send(email: Email): Promise<void> }

/**
 * Resend (resend.com) transactional email over HTTPS. Set RESEND_API_KEY and
 * EMAIL_FROM, e.g. "ShiftChess <no-reply@yourdomain.com>" on a verified domain.
 */
export class ResendMailer implements Mailer {
  constructor(private readonly apiKey: string, private readonly from: string, private readonly fetcher: typeof fetch = (input, init) => fetch(input, init)) {}
  async send(email: Email) {
    const response = await this.fetcher('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, to: [email.to], subject: email.subject, text: email.text, html: email.html }),
    });
    if (!response.ok) throw new Error(`Email provider rejected the message (${response.status}).`);
  }
}

/** Local development only: prints the email instead of sending it. */
export class ConsoleMailer implements Mailer {
  async send(email: Email) { console.log(`[dev email] to=${email.to} subject=${email.subject}\n${email.text}`); }
}

export function mailerFromEnv(env: NodeJS.ProcessEnv = process.env): Mailer | undefined {
  if (env.RESEND_API_KEY && env.EMAIL_FROM) return new ResendMailer(env.RESEND_API_KEY, env.EMAIL_FROM);
  if (env.NODE_ENV !== 'production' && !env.RAILWAY_ENVIRONMENT) return new ConsoleMailer();
  return undefined; // production without a provider: email resets report "not configured"
}

const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
export function resetEmail(to: string, username: string, link: string, minutes: number): Email {
  return {
    to,
    subject: 'Reset your ShiftChess password',
    text: `Hi ${username},\n\nSomeone asked to reset the password for your ShiftChess account. Open this link to choose a new password (it works once and expires in ${minutes} minutes):\n\n${link}\n\nIf this wasn't you, ignore this email; your password stays the same.\n\nShiftChess by Chain Software Group`,
    html: `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:auto;padding:24px;color:#1d1b22">
<h1 style="font-size:22px;margin:0 0 12px">Reset your password</h1>
<p>Hi ${escape(username)},</p>
<p>Someone asked to reset the password for your ShiftChess account. Tap the button to choose a new one. The link works once and expires in ${minutes} minutes.</p>
<p style="margin:28px 0"><a href="${escape(link)}" style="background:#e3a64a;color:#1d1406;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:999px;display:inline-block">Choose a new password</a></p>
<p style="color:#5d5866;font-size:14px">If this wasn't you, ignore this email; your password stays the same.</p>
<p style="color:#5d5866;font-size:13px">ShiftChess by Chain Software Group</p></div>`,
  };
}

// Crockford base32 without I, L, O, U: easy to read aloud and copy by hand.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
/** 80-bit one-time recovery code, e.g. 7KQ2-M9XD-4TPA-HV3N. */
export function newRecoveryCode(): string {
  const bytes = randomBytes(16);
  let code = '';
  for (let i = 0; i < 16; i++) code += ALPHABET[bytes[i] % 32];
  return code.match(/.{4}/g)!.join('-');
}
export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
}
export const recoveryDigest = (code: string) => createHash('sha256').update(`recovery:${normalizeRecoveryCode(code)}`).digest('hex');

export const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
