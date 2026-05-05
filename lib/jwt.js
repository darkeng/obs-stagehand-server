const jwt = require('jsonwebtoken');
const config = require('../config');

// Single place that knows the JWT secret. Other modules call signToken /
// decodeToken instead of importing jsonwebtoken directly.

function signToken(payload, ttl) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: ttl });
}

function decodeToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

function readBearer(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7);
}

module.exports = { signToken, decodeToken, readBearer };
