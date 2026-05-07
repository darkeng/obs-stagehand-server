const express = require('express');
const path = require('path');
const cors = require('cors');

const config = require('./config');
const authRoutes = require('./routes/auth');
const sceneRoutes = require('./routes/scenes');

// Express composition: middlewares + routes + error handler. Kept separate
// from server.js so it can be required without booting the HTTP/socket layer
// (e.g. for future supertest-style integration tests).
function buildApp() {
  const app = express();

  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  // Liveness probe — answers as long as Express is alive. Mongo blips do not
  // mark the container unhealthy, since the app can still serve cached data
  // and recover when Mongo reconnects.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

  app.use('/api/auth', authRoutes);
  app.use('/api/scenes', sceneRoutes);

  app.use((err, req, res, next) => {
    console.error('[unhandled]', err);
    res.status(500).json({ error: 'Server error' });
  });

  return app;
}

module.exports = buildApp;
