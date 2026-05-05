const Scene = require('../models/Scene');
const { decodeToken } = require('../lib/jwt');

// When a guest signs up or logs in, move every scene they created as a guest
// over to the new user account. Returns the count of scenes migrated.
// Tolerant of bad/expired guest tokens — failure is silent (returns 0) so the
// signup/login flow doesn't break on a stale token from a previous session.
async function migrateGuestScenes(guestToken, userId) {
  if (!guestToken) return 0;
  let payload;
  try {
    payload = decodeToken(guestToken);
  } catch {
    return 0;
  }
  if (payload?.kind !== 'guest' || !payload?.id) return 0;
  const result = await Scene.updateMany(
    { guestId: payload.id, owner: null },
    { $set: { owner: userId, guestId: null } }
  );
  return result.modifiedCount ?? 0;
}

module.exports = { migrateGuestScenes };
