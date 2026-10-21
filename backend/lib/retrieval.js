// Lightweight keyword retrieval over the Dreams corpus.
// No database, no embeddings, no extra API cost: the corpus file is
// loaded once, split into chunks, and scored by term overlap.
const fs = require('fs');
const path = require('path');

const CORPUS_PATH = path.join(__dirname, '..', 'data', 'DREAMS-UNIFIED.md');

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'is', 'it', 'i', 'me', 'my',
  'what', 'how', 'why', 'when', 'does', 'do', 'did', 'was', 'were', 'are',
  'about', 'tell', 'can', 'you', 'your', 'that', 'this', 'with', 'for', 'on',
  'at', 'by', 'from', 'have', 'has', 'had', 'was', 'were', 'be', 'been',
  'dream', 'dreams', 'dreaming'
]);

let chunks = null;

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || [])
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function loadChunks() {
  if (chunks) return chunks;
  let raw = '';
  try {
    raw = fs.readFileSync(CORPUS_PATH, 'utf-8');
  } catch (e) {
    console.error('ERROR: corpus file missing:', e.message);
    chunks = [];
    return chunks;
  }
  const lines = raw.split('\n');
  const out = [];
  let heading = '';
  let buf = [];
  const flush = () => {
    const text = buf.join('\n').trim();
    if (text.length > 40) {
      // Split long sections into overlapping windows so answers stay focused.
      const size = 1400;
      for (let i = 0; i < text.length; i += size - 200) {
        const slice = text.slice(i, i + size).trim();
        if (slice.length > 40) {
          out.push({ heading, text: slice, tokens: new Set(tokenize(slice + ' ' + heading)) });
        }
        if (i + size >= text.length) break;
      }
    }
    buf = [];
  };
  for (const line of lines) {
    if (/^#{1,3}\s/.test(line)) {
      flush();
      heading = line.replace(/^#{1,3}\s*/, '').trim();
      buf.push(line);
    } else {
      buf.push(line);
    }
  }
  flush();
  chunks = out;
  console.log(`INFO: corpus loaded, ${chunks.length} chunks`);
  return chunks;
}

function search(query, limit = 5) {
  const all = loadChunks();
  const qTokens = [...new Set(tokenize(query))];
  if (!qTokens.length) return all.slice(0, limit);
  const scored = [];
  const lowerQuery = query.toLowerCase();
  const pairs = [];
  const rawTokens = lowerQuery.match(/[a-z0-9]+/g) || [];
  for (let i = 0; i + 1 < rawTokens.length; i++) pairs.push(rawTokens[i] + ' ' + rawTokens[i + 1]);
  for (const c of all) {
    let score = 0;
    for (const t of qTokens) {
      if (c.tokens.has(t)) score += 1;
      if (c.heading.toLowerCase().includes(t)) score += 2;
    }
    const lowerText = c.text.toLowerCase();
    for (const p of pairs) if (lowerText.includes(p)) score += 1.5;
    // Technique questions should surface the step by step material.
    if (/how|technique|step|guide|practice|method/.test(lowerQuery) && /\[Guide\]|step by step|technique/.test(c.text)) score += 1.5;
    // Small boost for labeled claim lines, they are the meat of the corpus.
    if (score > 0 && /\[(Documented|Video|Reddit|Tradition|Guide|Research)/.test(c.text)) score += 0.5;
    if (score > 0) scored.push({ score, chunk: c });
  }
  scored.sort((a, b) => b.score - a.score);
  // One window per heading first, so answers draw on distinct sections.
  const picked = [];
  const seenHeadings = new Set();
  for (const s of scored) {
    if (picked.length >= limit) break;
    if (seenHeadings.has(s.chunk.heading)) continue;
    seenHeadings.add(s.chunk.heading);
    picked.push(s.chunk);
  }
  for (const s of scored) {
    if (picked.length >= limit) break;
    if (!picked.includes(s.chunk)) picked.push(s.chunk);
  }
  return picked;
}

module.exports = { search, loadChunks };
