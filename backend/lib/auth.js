const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const COOKIE_NAME = 'dc_token';
const TOKEN_TTL_DAYS = 30;

function jwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.VERCEL) {
    console.warn('WARN: JWT_SECRET is not set; sessions will not survive a restart.');
  }
  return 'dream-chat-dev-secret-change-me';
}

function issueSession(res, user) {
  const token = jwt.sign({ sub: String(user._id), email: user.email }, jwtSecret(), {
    expiresIn: TOKEN_TTL_DAYS + 'd'
  });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: !!process.env.VERCEL,
    sameSite: 'lax',
    maxAge: TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    path: '/'
  });
}

function clearSession(res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: !!process.env.VERCEL, sameSite: 'lax', path: '/' });
}

function readSession(req) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    return jwt.verify(token, jwtSecret());
  } catch (e) {
    return null;
  }
}

// Accounts need the database. If Mongo is not connected, say so plainly
// instead of hanging or leaking a stack error.
function requireDb(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Accounts are not switched on yet. You can still chat as a guest.' });
  }
  next();
}

function requireAuth(req, res, next) {
  const session = readSession(req);
  if (!session || !session.sub) {
    return res.status(401).json({ error: 'Sign in required.' });
  }
  req.userId = session.sub;
  req.userEmail = session.email;
  next();
}

module.exports = { COOKIE_NAME, issueSession, clearSession, readSession, requireDb, requireAuth };
