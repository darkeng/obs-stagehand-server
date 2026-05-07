require('dotenv').config();

// Centralised env access + named constants. Server-side modules import from
// here instead of touching process.env directly, so misuse fails fast at
// startup with a single readable error.

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET env var is required');
  process.exit(1);
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,

  // Comma-separated allow-list. Defaults work for the production deployment;
  // override via CORS_ORIGINS for staging or extra clients.
  corsOrigins: (process.env.CORS_ORIGINS || 'https://stagehand.darkeng.dev')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // Token TTLs. Users renew on every login; guests get a year because they
  // can't recover their identity if the token expires.
  userTokenTtl: '24h',
  guestTokenTtl: '365d',

  // Per-scene OBS streaming/recording status TTL. The viewer (Scene.vue inside
  // OBS Browser Source) re-emits every 5s; we let the cache go stale 15s after
  // the last update to guard against the viewer dying silently.
  obsStatusTtlMs: 15_000,
};
