const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const config = require('../config');
const { signToken } = require('../lib/jwt');
const { requireAuth } = require('../middleware/auth');
const { migrateGuestScenes } = require('../services/authService');

const router = express.Router();

// Allow login/signup callers to forward their previous (guest) token alongside
// credentials so we can migrate any scenes they made as guests.
function readGuestTokenFromBody(req) {
  return req.body?.guestToken || null;
}

// Issue a fresh guest identity. Idempotent — clients call when they have no token.
router.post('/guest', (req, res) => {
  const guestId = crypto.randomUUID();
  const token = signToken({ kind: 'guest', id: guestId }, config.guestTokenTtl);
  res.json({ token, kind: 'guest', id: guestId });
});

router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ error: 'User already exists' });

    const user = new User({ email, password });
    await user.save();

    const migrated = await migrateGuestScenes(readGuestTokenFromBody(req), user._id);

    const token = signToken({ kind: 'user', id: user._id.toString() }, config.userTokenTtl);
    res.json({ token, user: user.toJSON(), migratedScenes: migrated });
  } catch (err) {
    console.error('[signup]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });

    const migrated = await migrateGuestScenes(readGuestTokenFromBody(req), user._id);

    const token = signToken({ kind: 'user', id: user._id.toString() }, config.userTokenTtl);
    res.json({ token, user: user.toJSON(), migratedScenes: migrated });
  } catch (err) {
    console.error('[login]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    if (req.auth.kind === 'guest') {
      return res.json({ kind: 'guest', id: req.auth.id });
    }
    const user = await User.findById(req.auth.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ kind: 'user', user: user.toJSON() });
  } catch (err) {
    console.error('[me]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
