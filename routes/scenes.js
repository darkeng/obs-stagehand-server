const express = require('express');
const mongoose = require('mongoose');
const Scene = require('../models/Scene');
const { requireAuth, ownerFilter } = require('../middleware/auth');
const { newShareToken } = require('../lib/tokens');

const router = express.Router();

// Public: read by shareToken (used by OBS Browser Source).
router.get('/by-token/:shareToken', async (req, res) => {
  try {
    const scene = await Scene.findOne({ shareToken: req.params.shareToken });
    if (!scene) return res.status(404).json({ error: 'Scene not found' });
    res.json(scene);
  } catch (err) {
    console.error('[scenes/by-token]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// List scenes owned by the current principal (user or guest).
// Includes per-type element counts so the dashboard can show identifying tags
// without having to ship the full elements array for every scene.
router.get('/', requireAuth, async (req, res) => {
  try {
    const filter = ownerFilter(req.auth);
    if (!filter) return res.status(401).json({ error: 'Unauthenticated' });
    // Mongoose `find` auto-casts strings to ObjectId via schema; aggregate doesn't.
    if (filter.owner && typeof filter.owner === 'string') {
      filter.owner = new mongoose.Types.ObjectId(filter.owner);
    }
    const countOfType = (t) => ({
      $size: { $filter: { input: '$elements', as: 'e', cond: { $eq: ['$$e.type', t] } } }
    });
    const scenes = await Scene.aggregate([
      { $match: filter },
      { $sort: { createdAt: -1 } },
      {
        $project: {
          name: 1,
          shareToken: 1,
          createdAt: 1,
          owner: 1,
          guestId: 1,
          elementCounts: {
            text: countOfType('text'),
            image: countOfType('image'),
            video: countOfType('video'),
            audio: countOfType('audio'),
          },
          totalElements: { $size: { $ifNull: ['$elements', []] } }
        }
      }
    ]);
    res.json(scenes);
  } catch (err) {
    console.error('[scenes/list]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const update = {};
    if (typeof req.body?.name === 'string') {
      const trimmed = req.body.name.trim().slice(0, 120);
      update.name = trimmed || 'Untitled Scene';
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    const filter = { _id: req.params.id, ...ownerFilter(req.auth) };
    const scene = await Scene.findOneAndUpdate(filter, { $set: update }, { returnDocument: 'after' })
      .select('-elements');
    if (!scene) return res.status(404).json({ error: 'Scene not found' });
    res.json(scene);
  } catch (err) {
    console.error('[scenes/update]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a scene under the current principal.
router.post('/', requireAuth, async (req, res) => {
  try {
    const name = (req.body?.name || 'Untitled Scene').toString().slice(0, 120);
    const doc = {
      name,
      shareToken: newShareToken(),
      elements: [],
      ...(req.auth.kind === 'user'
        ? { owner: req.auth.id, guestId: null }
        : { guestId: req.auth.id, owner: null })
    };
    const scene = await Scene.create(doc);
    res.status(201).json(scene);
  } catch (err) {
    console.error('[scenes/create]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Read by _id, owner-restricted. Used by the controller view.
router.get('/:id', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const filter = { _id: req.params.id, ...ownerFilter(req.auth) };
    const scene = await Scene.findOne(filter);
    if (!scene) return res.status(404).json({ error: 'Scene not found' });
    res.json(scene);
  } catch (err) {
    console.error('[scenes/read]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const filter = { _id: req.params.id, ...ownerFilter(req.auth) };
    const result = await Scene.deleteOne(filter);
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Scene not found' });
    }
    res.status(204).end();
  } catch (err) {
    console.error('[scenes/delete]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
