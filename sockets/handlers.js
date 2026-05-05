const Scene = require('../models/Scene');
const obsStatusCache = require('../services/obsStatusCache');
const { isEditorOf } = require('./auth');

// Per-connection event wiring. Splits naturally into:
//   - join-scene gating
//   - element CRUD (editor only)
//   - OBS streaming/recording status replay (viewer-emitted)
module.exports = function registerHandlers(io, socket) {
  socket.on('join-scene', async (sceneId, ack) => {
    try {
      let allowed = false;
      if (socket.data.role === 'editor') {
        allowed = await isEditorOf(socket.data.auth, sceneId);
      } else if (socket.data.role === 'viewer') {
        allowed = socket.data.viewerSceneId === sceneId;
      }
      if (!allowed) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Forbidden' });
        return;
      }
      socket.join(sceneId);
      socket.data.sceneId = sceneId;

      // Replay last-known OBS status so a freshly connecting editor sees the
      // current LIVE/OFFLINE state without waiting for the next change.
      const cached = obsStatusCache.get(sceneId);
      if (cached) socket.emit('obs-status', cached);

      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      console.error('[join-scene]', err);
      if (typeof ack === 'function') ack({ ok: false, error: 'Server error' });
    }
  });

  function canMutate(sceneId) {
    return socket.data.role === 'editor'
      && socket.data.sceneId === sceneId
      && socket.rooms.has(sceneId);
  }

  function inRoom(sceneId) {
    return socket.data.sceneId === sceneId && socket.rooms.has(sceneId);
  }

  socket.on('update-element', async ({ sceneId, element } = {}) => {
    if (!canMutate(sceneId) || !element?.id) return;
    socket.to(sceneId).emit('element-updated', element);
    try {
      await Scene.updateOne(
        { _id: sceneId, 'elements.id': element.id },
        { $set: { 'elements.$': element } }
      );
    } catch (err) {
      console.error('[update-element]', err);
    }
  });

  socket.on('add-element', async ({ sceneId, element } = {}) => {
    if (!canMutate(sceneId) || !element?.id) return;
    socket.to(sceneId).emit('element-added', element);
    try {
      await Scene.updateOne(
        { _id: sceneId },
        { $push: { elements: element } }
      );
    } catch (err) {
      console.error('[add-element]', err);
    }
  });

  socket.on('remove-element', async ({ sceneId, elementId } = {}) => {
    if (!canMutate(sceneId) || !elementId) return;
    socket.to(sceneId).emit('element-removed', elementId);
    try {
      await Scene.updateOne(
        { _id: sceneId },
        { $pull: { elements: { id: elementId } } }
      );
    } catch (err) {
      console.error('[remove-element]', err);
    }
  });

  // OBS viewer reports streaming/recording status; editors listen.
  // Restricted to viewers — only the Browser Source running inside OBS has
  // window.obsstudio access, so editors emitting this would be spoofing.
  socket.on('obs-status', ({ sceneId, status } = {}) => {
    if (socket.data.role !== 'viewer') return;
    if (!inRoom(sceneId)) return;
    if (!status || typeof status !== 'object') return;
    obsStatusCache.set(sceneId, status);
    socket.to(sceneId).emit('obs-status', status);
  });

  // Clear the cached status when the last viewer leaves the room. Without
  // this, closing OBS while a controller is still connected would leave the
  // controller stuck on "LIVE" until TTL expires.
  socket.on('disconnect', () => {
    const sceneId = socket.data.sceneId;
    if (!sceneId || socket.data.role !== 'viewer') return;
    // Defer one tick so socket.io has finished processing the leave.
    setImmediate(async () => {
      try {
        const remaining = await io.in(sceneId).fetchSockets();
        const stillHasViewer = remaining.some(s => s.data?.role === 'viewer');
        if (!stillHasViewer) obsStatusCache.clear(sceneId);
      } catch (err) {
        console.warn('[obs-status cleanup]', err);
      }
    });
  });
};
