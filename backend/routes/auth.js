const express = require('express');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { issueSession, clearSession, readSession, requireDb } = require('../lib/auth');

const router = express.Router();

// Small in-memory throttle for credential attempts: 20 per 15 min per IP.
const attempts = new Map();
function throttled(ip) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const list = (attempts.get(ip) || []).filter((t) => now - t < windowMs);
  list.push(now);
  attempts.set(ip, list);
  return list.length > 20;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function cleanEmail(v) {
  return String(v || '').trim().toLowerCase().slice(0, 200);
}

router.post('/register', requireDb, async (req, res) => {
  try {
    if (throttled(req.ip)) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
    const email = cleanEmail(req.body && req.body.email);
    const password = String((req.body && req.body.password) || '');
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password needs at least 8 characters.' });
    if (password.length > 200) return res.status(400).json({ error: 'Password is too long.' });
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'That email already has an account. Sign in instead.' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, passwordHash, provider: 'local' });
    issueSession(res, user);
    res.status(201).json({ email: user.email });
  } catch (err) {
    console.error('register error:', err.message);
    res.status(500).json({ error: 'Something went wrong creating the account.' });
  }
});

router.post('/login', requireDb, async (req, res) => {
  try {
    if (throttled(req.ip)) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
    const email = cleanEmail(req.body && req.body.email);
    const password = String((req.body && req.body.password) || '');
    const user = await User.findOne({ email });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Email or password is not right. If you signed up with Google, use the Google button.' });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Email or password is not right.' });
    issueSession(res, user);
    res.json({ email: user.email });
  } catch (err) {
    console.error('login error:', err.message);
    res.status(500).json({ error: 'Something went wrong signing in.' });
  }
});

router.post('/google', requireDb, async (req, res) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(503).json({ error: 'Google sign in is not switched on yet.' });
    const credential = String((req.body && req.body.credential) || '');
    if (!credential) return res.status(400).json({ error: 'Missing Google credential.' });
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload || !payload.email || payload.email_verified === false) {
      return res.status(401).json({ error: 'Google did not confirm that email.' });
    }
    const email = cleanEmail(payload.email);
    let user = await User.findOne({ $or: [{ googleSub: payload.sub }, { email }] });
    if (!user) {
      user = await User.create({ email, googleSub: payload.sub, provider: 'google' });
    } else if (!user.googleSub) {
      user.googleSub = payload.sub;
      await user.save();
    }
    issueSession(res, user);
    res.json({ email: user.email });
  } catch (err) {
    console.error('google auth error:', err.message);
    res.status(401).json({ error: 'Google sign in did not work. Try again.' });
  }
});

router.post('/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  const session = readSession(req);
  if (!session || !session.sub) return res.status(401).json({ error: 'Not signed in.' });
  res.json({ email: session.email });
});

module.exports = router;
