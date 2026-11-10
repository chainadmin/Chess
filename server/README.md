# Game server transport

Production runs `game/index.ts` (account tokens, rated results, Postgres). See ../docs/LAUNCH.md for deployment.
The guest-only development mode below is what `npm run online:server` starts (`index.ts`).
Defaults: `127.0.0.1:8787`, browser origins `http://localhost:8081` and
`http://127.0.0.1:8081`. Set `SHIFTCHESS_HOST`, `SHIFTCHESS_PORT`, and
`SHIFTCHESS_ORIGINS` (comma-separated exact HTTP(S) origins) if needed.
For a phone on the same trusted LAN, explicitly bind `0.0.0.0`, use the
computer's LAN address in the client, and allow its browser origin if applicable.
Do not expose this plaintext development server to the public internet.

- `GET /health`: development mode and protocol version.
- `POST /session`, JSON `{}`: returns `{token, player:{id,displayName}, expiresAt}`.
- `POST /command`, JSON OnlineCommand, `Authorization: Bearer <token>`: OnlineState.
- Errors: `{error:{code,message}}`; requests require JSON. Origins are exact
  allowlisted; nonbrowser requests without Origin are allowed. CORS is not auth.

Guest tokens have 256 bits of randomness, are stored hashed in memory and expire
in 24 hours. If a match is still active at expiration, that same token receives
match-only grace capped at two hours from the original expiry. It can only sync,
move or resign in that captured match, never enter a new queue or another match.
Out-of-scope commands return `403 session_scope`; the credential remains usable
for its match. Fully expired/retired credentials return `401 unauthenticated`.
After the match ends, result reads and accepted retries remain available for
60 seconds, still within the two-hour ceiling. Grace is not sliding renewal and
counts against the active-session cap. Expiration never automatically resigns a
match. Names and IDs are server-issued, never copied from local mock auth.
No password, subscription, entitlement, or purchase is needed. Keep tokens in
memory, never URLs or logs. Sessions, matches and recovery are lost on restart.
There is no verified account authentication, durable storage, production rating
settlement, TLS, multi-process coordination or production abuse protection.

The server limits bodies (4 KiB), active sessions (1000), connections (100),
IP rate buckets (2000), and fixed 60-second request windows:

- Authenticated `POST /command`: 300/minute **per guest session**
  (`commandsPerMinute`), including invalid command bodies. Normal 750 ms polling
  uses 80/minute, leaving room for moves, retries and resignation. Players on the
  same NAT do not compete for this budget.
- Anonymous traffic: 300/minute per direct IP (`requestsPerMinute`). Includes
  invalid/expired tokens, guest creation, health checks, preflights and unknown
  endpoints. Arbitrary tokens never allocate additional rate buckets.
- Guest creation attempts: 20/minute per direct IP (`sessionsPerMinute`), also
  counted as anonymous traffic. Minting more credentials cannot bypass this cap
  or the active-session limit.
- Aggregate circuit breaker: 12,000/minute per direct IP
  (`aggregateRequestsPerMinute`), for requests admitted by the session/anonymous
  budget. Already rate-limited traffic does not spend neighbors' aggregate
  allowance. This emergency shared bound is deliberately much higher than normal
  polling load; sufficiently large shared networks can still reach it.

It ignores forwarded IP headers. `Retry-After` is the rounded-up remaining seconds
in the exhausted window, not an additional minute. Allowed browser origins can
read it through `Access-Control-Expose-Headers: Retry-After`. IP buckets expire after all
three IP windows end. Session budgets live inside bounded guest records and are
removed with expired credentials. Expiration also removes pending queue entries
before matchmaking, including after a slow request body; it never resigns an
already paired match or discards ticket tombstones/accepted move receipts.
An authority timer advances clocks even without polling. Shutdown clears timers,
connections and credentials. Limits are configurable through createOnlineServer.

Test: `node --import tsx --test src/online/__tests__/transport.test.ts`
Typecheck: `npx tsc --noEmit -p server/tsconfig.json`

The authority additionally caps lifetime queue/cancel ticket tombstones (100,000),
retained matches (1,000) and accepted move receipts per match (2,048 plus a reserved
terminal resignation). Existing accepted retries and current queue cancellations
continue at capacity. Ticket tombstones are not TTL-evicted because that could
resurrect delayed cancelled searches. Controlled retirement of expired identities
and durable coordination are production work, not hidden unsafe eviction.

CORS preflights advertise a 600-second cache to avoid doubling normal poll load.
The client uses 750 ms HTTP polling, not WebSockets. Public deployment needs TLS
and trusted-proxy rate configuration; merely setting SHIFTCHESS_HOST is not that.
