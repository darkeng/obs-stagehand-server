const config = require('../config');

// Per-scene OBS streaming/recording status. The viewer (Scene.vue running in
// OBS Browser Source) is the source of truth and re-emits every 5s via
// getStatus(). We cache the last-known value here so editors that connect
// AFTER the stream started don't sit at "OFFLINE" until the next change.
//
// Memory-only is fine: it's ephemeral runtime state, gets refilled within 5s
// of any viewer reconnect, and a server restart aligns with re-emission
// anyway. TTL guards against the viewer process dying without sending a stop
// event (last value going stale).

const TTL_MS = config.obsStatusTtlMs;
const byScene = new Map();

function set(sceneId, status) {
  byScene.set(String(sceneId), { status, ts: Date.now() });
}

function get(sceneId) {
  const entry = byScene.get(String(sceneId));
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) {
    byScene.delete(String(sceneId));
    return null;
  }
  return entry.status;
}

function clear(sceneId) {
  byScene.delete(String(sceneId));
}

module.exports = { set, get, clear };
