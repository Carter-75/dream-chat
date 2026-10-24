const mongoose = require('mongoose');

// A Dream Chat account is just an email, per Carter's spec: no username,
// no profile fields. Password hash exists only for email sign ups;
// Google accounts have no password.
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, default: null },
  googleSub: { type: String, default: null, index: true },
  provider: { type: String, enum: ['local', 'google'], required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
