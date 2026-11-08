import { createOnlineServer } from './httpServer';

const app = createOnlineServer({
  host: process.env.SHIFTCHESS_HOST ?? '127.0.0.1',
  port: Number(process.env.SHIFTCHESS_PORT ?? '8787'),
  ...(process.env.SHIFTCHESS_ORIGINS === undefined ? {} : {
    allowedOrigins: process.env.SHIFTCHESS_ORIGINS.split(',').map(value => value.trim()).filter(Boolean),
  }),
});
app.listen().then(({ host, port }) => {
  console.log(`ShiftChess development guest server listening on ${host}:${port}. Not production authentication.`);
}).catch(() => { console.error('Unable to start ShiftChess server. Check host, port and configuration.'); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { void app.close().catch(() => { process.exitCode = 1; }); });
}
