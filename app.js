const express = require('express');
const path = require('path');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const sceneRoutes = require('./routes/scenes');

// Express composition: middlewares + routes + error handler. Kept separate
// from server.js so it can be required without booting the HTTP/socket layer
// (e.g. for future supertest-style integration tests).
function buildApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

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
