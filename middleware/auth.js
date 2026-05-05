const { decodeToken, readBearer } = require('../lib/jwt');

// Two principals are authenticated against the same JWT shape:
//   { kind: 'user' | 'guest', id }
// `requireAuth` rejects missing/invalid tokens; `optionalAuth` lets the
// request through anonymously. `ownerFilter` turns a principal into a Mongo
// filter so route handlers don't repeat the user/guest branching.

function requireAuth(req, res, next) {
  const token = readBearer(req);
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = decodeToken(token);
    if (!payload?.kind || !payload?.id) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.auth = { kind: payload.kind, id: payload.id };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function optionalAuth(req, res, next) {
  const token = readBearer(req);
  if (!token) return next();
  try {
    const payload = decodeToken(token);
    if (payload?.kind && payload?.id) {
      req.auth = { kind: payload.kind, id: payload.id };
    }
  } catch {
    // ignore — treated as anonymous
  }
  next();
}

function ownerFilter(auth) {
  if (!auth) return null;
  if (auth.kind === 'user') return { owner: auth.id };
  if (auth.kind === 'guest') return { guestId: auth.id };
  return null;
}

module.exports = { requireAuth, optionalAuth, ownerFilter };
