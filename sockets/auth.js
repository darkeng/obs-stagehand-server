const Scene = require('../models/Scene');
const { decodeToken } = require('../lib/jwt');

// Two valid socket roles:
//   - editor: authenticated (user or guest JWT). Can mutate scenes they own.
//   - viewer: read-only, identified by a shareToken. Used by OBS Browser
//     Source.
async function socketAuth(socket, next) {
  const { token, shareToken } = socket.handshake.auth ?? {};

  if (token) {
    try {
      const payload = decodeToken(token);
      if (!payload?.kind || !payload?.id) return next(new Error('Invalid token'));
      socket.data.role = 'editor';
      socket.data.auth = { kind: payload.kind, id: payload.id };
      return next();
    } catch {
      return next(new Error('Invalid token'));
    }
  }

  if (shareToken) {
    try {
      const scene = await Scene.findOne({ shareToken }).select('_id');
      if (!scene) return next(new Error('Scene not found'));
      socket.data.role = 'viewer';
      socket.data.viewerSceneId = scene._id.toString();
      return next();
    } catch (err) {
      console.error('[socket auth viewer]', err);
      return next(new Error('Server error'));
    }
  }

  next(new Error('No auth'));
}

// Cheap existence check: does the JWT principal own the scene?
async function isEditorOf(auth, sceneId) {
  if (!auth || !sceneId) return false;
  const filter = { _id: sceneId };
  if (auth.kind === 'user') filter.owner = auth.id;
  else if (auth.kind === 'guest') filter.guestId = auth.id;
  else return false;
  const exists = await Scene.exists(filter);
  return !!exists;
}

module.exports = { socketAuth, isEditorOf };
