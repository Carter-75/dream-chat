const express = require('express');
const Conversation = require('../models/Conversation');
const { requireDb, requireAuth } = require('../lib/auth');

const router = express.Router();
router.use(requireDb, requireAuth);

function cleanMessages(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 200).map((m) => ({
    role: m && m.role === 'user' ? 'user' : 'assistant',
    content: String((m && m.content) || '').slice(0, 10000)
  })).filter((m) => m.content.length > 0);
}

function titleFrom(messages) {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return 'New conversation';
  const t = firstUser.content.replace(/\s+/g, ' ').trim();
  return (t.length > 57 ? t.slice(0, 57) + '...' : t) || 'New conversation';
}

// List: metadata only, newest first. ?archived=1 lists the archive instead.
router.get('/', async (req, res) => {
  try {
    const archived = req.query.archived === '1';
    const rows = await Conversation.find({ userId: req.userId, archived })
      .sort({ updatedAt: -1 })
      .limit(100)
      .select('title archived createdAt updatedAt')
      .lean();
    res.json({
      conversations: rows.map((r) => ({ id: String(r._id), title: r.title, archived: !!r.archived, createdAt: r.createdAt, updatedAt: r.updatedAt }))
    });
  } catch (err) {
    console.error('conversations list error:', err.message);
    res.status(500).json({ error: 'Could not load your conversations.' });
  }
});

// Auto name a new conversation from its first user prompt (Carter's rule:
// the title comes from the first prompt's context, ChatGPT style). Uses the
// same cheap model as the chat; any failure keeps the truncation fallback.
async function autoTitle(convoId, messages) {
  try {
    if (!process.env.OPENAI_API_KEY) return;
    const firstUser = messages.find((m) => m.role === 'user');
    if (!firstUser || firstUser.content.trim().length < 12) return;
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-5-nano',
      reasoning_effort: 'low',
      max_completion_tokens: 60,
      messages: [
        { role: 'system', content: 'Write a short title for a dream chat conversation. Use 3 to 6 words. No quotes, no punctuation at the end, no em dashes. Base it only on the user message.' },
        { role: 'user', content: firstUser.content.slice(0, 500) }
      ]
    });
    let title = (completion.choices[0] && completion.choices[0].message && completion.choices[0].message.content) || '';
    title = title.replace(/["']/g, '').replace(/\u2014/g, ', ').replace(/\u2013/g, '-').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (title.length >= 3) {
      await Conversation.updateOne({ _id: convoId }, { $set: { title } });
    }
  } catch (err) {
    console.error('auto title error:', err.message);
  }
}

router.post('/', async (req, res) => {
  try {
    const messages = cleanMessages(req.body && req.body.messages);
    const convo = await Conversation.create({
      userId: req.userId,
      title: titleFrom(messages),
      messages
    });
    res.status(201).json({ id: String(convo._id), title: convo.title });
    // Fire and forget: the list refresh picks the smart title up seconds later.
    autoTitle(convo._id, messages);
  } catch (err) {
    console.error('conversations create error:', err.message);
    res.status(500).json({ error: 'Could not save that conversation.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const convo = await Conversation.findOne({ _id: req.params.id, userId: req.userId }).lean();
    if (!convo) return res.status(404).json({ error: 'Conversation not found.' });
    res.json({
      id: String(convo._id),
      title: convo.title,
      messages: convo.messages,
      createdAt: convo.createdAt,
      updatedAt: convo.updatedAt
    });
  } catch (err) {
    res.status(400).json({ error: 'Conversation not found.' });
  }
});

// Rename and archive or unarchive.
router.patch('/:id', async (req, res) => {
  try {
    const convo = await Conversation.findOne({ _id: req.params.id, userId: req.userId });
    if (!convo) return res.status(404).json({ error: 'Conversation not found.' });
    if (typeof (req.body && req.body.title) === 'string') {
      const t = req.body.title.replace(/\s+/g, ' ').trim().slice(0, 120);
      if (t) convo.title = t;
    }
    if (typeof (req.body && req.body.archived) === 'boolean') {
      convo.archived = req.body.archived;
    }
    convo.updatedAt = new Date();
    await convo.save();
    res.json({ id: String(convo._id), title: convo.title, archived: !!convo.archived });
  } catch (err) {
    res.status(400).json({ error: 'Conversation not found.' });
  }
});

// Save the latest state of an open conversation.
router.put('/:id', async (req, res) => {
  try {
    const messages = cleanMessages(req.body && req.body.messages);
    const convo = await Conversation.findOne({ _id: req.params.id, userId: req.userId });
    if (!convo) return res.status(404).json({ error: 'Conversation not found.' });
    convo.messages = messages;
    if (convo.title === 'New conversation') convo.title = titleFrom(messages);
    convo.updatedAt = new Date();
    await convo.save();
    res.json({ id: String(convo._id), title: convo.title });
  } catch (err) {
    console.error('conversations update error:', err.message);
    res.status(500).json({ error: 'Could not save that conversation.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const out = await Conversation.deleteOne({ _id: req.params.id, userId: req.userId });
    if (!out.deletedCount) return res.status(404).json({ error: 'Conversation not found.' });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: 'Conversation not found.' });
  }
});

module.exports = router;
