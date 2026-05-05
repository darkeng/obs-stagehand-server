const crypto = require('crypto');

// Short, URL-safe public token used to share a scene with OBS Browser Source.
// 16 hex chars = 64 bits of entropy. Random collisions are vanishingly small
// for the expected scale; the unique index on Scene.shareToken catches any.
function newShareToken() {
  return crypto.randomBytes(8).toString('hex');
}

module.exports = { newShareToken };
