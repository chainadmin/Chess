/** Public web pages served by the accounts API: /privacy and /account-deletion. */
export type PageOptions = { owner?: string; appName?: string; contactEmail?: string; effectiveDate?: string };

const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

function layout(title: string, body: string) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<style>
:root{color-scheme:light dark;--bg:#ffffff;--fg:#1d1b22;--muted:#5d5866;--line:#e4e1ea;--accent:#2f7d6d}
@media (prefers-color-scheme:dark){:root{--bg:#120f18;--fg:#f1eef6;--muted:#aaa3b8;--line:#2c2636;--accent:#5fd3bc}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:760px;margin:0 auto;padding:40px 16px 64px}
h1{font-size:2rem;line-height:1.2;margin:0 0 4px}h2{font-size:1.2rem;margin:32px 0 8px}
p,li{color:var(--fg)}.muted{color:var(--muted)}a{color:var(--accent)}
ul{padding-left:1.2rem}table{border-collapse:collapse;width:100%;font-size:.95rem}
td,th{border-top:1px solid var(--line);padding:8px 6px;text-align:left;vertical-align:top}
form{display:grid;gap:12px;margin-top:20px}label{font-weight:600;font-size:.95rem}
input{font:inherit;padding:12px 14px;border-radius:12px;border:1px solid var(--line);background:transparent;color:var(--fg)}
button{font:inherit;font-weight:700;padding:14px;border:0;border-radius:999px;background:#e3a64a;color:#1d1406;cursor:pointer}
.error{color:#d9534f;font-weight:600}
</style></head><body><main>${body}</main></body></html>`;
}

function contactLine(options: PageOptions) {
  return options.contactEmail
    ? `email <a href="mailto:${escape(options.contactEmail)}">${escape(options.contactEmail)}</a>`
    : 'use the support contact listed on our App Store or Google Play page';
}

export function privacyPage(options: PageOptions = {}) {
  const owner = escape(options.owner ?? 'Chain Software Group');
  const app = escape(options.appName ?? 'ShiftChess');
  const date = escape(options.effectiveDate ?? 'November 10, 2026');
  const contact = contactLine(options);
  return layout(`${options.appName ?? 'ShiftChess'} Privacy Policy`, `
<h1>${app} Privacy Policy</h1>
<p class="muted">Effective ${date}</p>
<p>${app} is owned and operated by <strong>${owner}</strong> ("we", "us"). This policy explains what information the ${app} app and its online service collect, how we use it, and the choices you have.</p>

<h2>Information we collect</h2>
<table>
<tr><th>Information</th><th>Why we use it</th></tr>
<tr><td><strong>Account details</strong>: your username and a one-way scrambled (hashed) version of your password and recovery code. We never store your password or recovery code itself.</td><td>To create your account, sign you in, let you recover it, and show your username to opponents and on leaderboards.</td></tr>
<tr><td><strong>Email address</strong> (optional): only if you add one.</td><td>Only to send password-reset links you ask for. We do not send marketing email and never show your email to other players.</td></tr>
<tr><td><strong>Game information</strong>: online games you play, including moves, results, opponents, dates and your rating and win/loss record.</td><td>To run matches, calculate ratings, prevent cheating and show your game history.</td></tr>
<tr><td><strong>Purchase records</strong>: which in-app items you bought and the store's transaction ID.</td><td>To unlock and restore what you bought. Payments are handled by Apple or Google; we never receive your card or bank details.</td></tr>
<tr><td><strong>Technical information</strong>: your IP address and basic request details while you use the online service.</td><td>To deliver the service, keep it secure and stop abuse. We use IP addresses briefly for rate limiting and do not save them in our account database.</td></tr>
<tr><td><strong>Advertising information</strong> (only if ads are shown): the advertising identifier on your device and ad interaction data, collected by Google AdMob.</td><td>To show ads and measure them. On iPhone we only use the advertising identifier for personalized ads if you allow tracking. You can play without allowing it.</td></tr>
</table>
<p>Settings, piece and board choices, practice progress, daily puzzles and offline games stay on your device and are not sent to us.</p>

<h2>Information we do not collect</h2>
<p>We do not ask for your real name, phone number, contacts, photos, precise location or payment details. An email address is optional. We do not sell your personal information.</p>

<h2>Who we share information with</h2>
<ul>
<li><strong>Other players</strong> see your username, rating and the moves of games you play against them.</li>
<li><strong>Service providers</strong> that host our servers and database (for example Railway) process data on our behalf.</li>
<li><strong>Resend</strong> delivers password-reset emails on our behalf if you have added an email address.</li>
<li><strong>Apple and Google</strong> process in-app purchases under their own privacy policies.</li>
<li><strong>Google AdMob</strong> serves ads in the free version under Google's privacy policy (<a href="https://policies.google.com/privacy">policies.google.com/privacy</a>). Buying "Remove Ads" turns these ads off.</li>
<li><strong>Legal reasons</strong>: we may disclose information when the law requires it or to protect the safety of our players and service.</li>
</ul>

<h2>How long we keep information</h2>
<ul>
<li>Account details, ratings and purchase records are kept until you delete your account.</li>
<li>Sign-in sessions expire after 30 days, or right away when you log out. Password-reset links expire after one hour and work once.</li>
<li>When you delete your account, your username, email address, password hash, sessions, rating and purchase records are deleted. Games you played remain in your opponents' history without your username or account attached.</li>
<li>Our hosting provider may keep short-lived server logs for security and reliability.</li>
</ul>

<h2>Your choices and rights</h2>
<ul>
<li><strong>Delete your account</strong> at any time in the app: Settings → Account → Delete account. See <a href="/account-deletion">how account deletion works</a>.</li>
<li><strong>Play without an account</strong>: guests can play offline games, puzzles and the computer without sending us any account data.</li>
<li><strong>Ad tracking</strong>: on iPhone you can allow or deny tracking when asked, and change it later in iOS Settings → Privacy &amp; Security → Tracking. In some regions you are also asked for advertising consent.</li>
<li>Depending on where you live, you may have rights to access, correct or delete your information. To make a request, ${contact}.</li>
</ul>

<h2>Children</h2>
<p>${app} is not directed to children under 13, and we do not knowingly collect personal information from them. If you believe a child has created an account, ${contact} and we will delete it.</p>

<h2>Security</h2>
<p>Connections to our service are encrypted, passwords are stored only as salted hashes, and sign-in tokens are stored on our servers only in hashed form. No system is perfectly secure, but we work to protect your information.</p>

<h2>Changes to this policy</h2>
<p>We may update this policy. When we do, we will change the effective date above and, for significant changes, tell you in the app.</p>

<h2>Contact</h2>
<p>${owner}. For privacy questions or requests, ${contact}.</p>
`);
}

export function accountDeletionPage(options: PageOptions = {}) {
  const owner = escape(options.owner ?? 'Chain Software Group');
  const app = escape(options.appName ?? 'ShiftChess');
  return layout(`Delete your ${options.appName ?? 'ShiftChess'} account`, `
<h1>Delete your ${app} account</h1>
<p class="muted">${app} by ${owner}</p>
<h2>In the app</h2>
<ol>
<li>Open ${app} and sign in.</li>
<li>Go to <strong>Settings</strong> → <strong>Account</strong>.</li>
<li>Tap <strong>Delete account</strong>, enter your password and confirm.</li>
</ol>
<p>Deletion happens immediately.</p>
<h2>Without the app</h2>
<p>If you can no longer use the app, ${contactLine(options)} with your username and we will delete the account within 30 days.</p>
<h2>What is deleted</h2>
<p>Your username, email address, password hash, sign-in sessions, rating, win/loss record and purchase records are permanently deleted. Games you played stay in your opponents' history without your username. Purchases made through Apple or Google stay with your store account and can be restored to a new ${app} account.</p>
<p><a href="/privacy">Read the full privacy policy</a></p>
`);
}

export function resetFormPage(token: string, error: string | null, options: PageOptions = {}) {
  const app = escape(options.appName ?? 'ShiftChess');
  return layout(`Reset your ${options.appName ?? 'ShiftChess'} password`, `
<h1>Choose a new password</h1>
<p class="muted">${app} account recovery</p>
${error ? `<p class="error" role="alert">${escape(error)}</p>` : ''}
<form method="post" action="/reset-password">
<input type="hidden" name="token" value="${escape(token)}">
<label for="password">New password (at least 8 characters)</label>
<input id="password" name="password" type="password" autocomplete="new-password" minlength="8" maxlength="128" required autofocus>
<label for="confirm">Confirm new password</label>
<input id="confirm" name="confirm" type="password" autocomplete="new-password" minlength="8" maxlength="128" required>
<button type="submit">Save new password</button>
</form>
<p class="muted">After saving, open ${app} and log in with your new password. You'll be signed out on your other devices.</p>`);
}

export function resetDonePage(options: PageOptions = {}) {
  const app = escape(options.appName ?? 'ShiftChess');
  return layout('Password updated', `
<h1>Password updated ✓</h1>
<p>Your new password is saved. Open ${app} and log in with it.</p>
<p class="muted">For your security, every device that was signed in to this account has been signed out.</p>`);
}

export function resetInvalidPage(options: PageOptions = {}) {
  const app = escape(options.appName ?? 'ShiftChess');
  return layout('Link expired', `
<h1>This link has expired</h1>
<p>Password-reset links work once and only for one hour. Open ${app}, tap <strong>Forgot password?</strong> on the login screen, and ask for a new link.</p>
<p class="muted">You can also reset your password with your recovery code.</p>`);
}
