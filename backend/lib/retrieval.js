// Retrieval over the Dreams corpus, built to find RELATED material,
// not only exact word matches (Carter's lookup rule, Oct 23, 2026:
// the knowledge base is the source of truth, and the chat should be
// able to look things up in it the way a person would).
//
// How it works, with no database, no embeddings, and no extra API cost:
// 1. Light stemming, so "crystals" matches "crystal" and "remembering"
//    matches "remember".
// 2. A dream-domain synonym map, so a question about a "rock" also
//    searches stone and crystal material, "seeing the future" searches
//    precognition, a "demon on my chest" searches sleep paralysis
//    entities, "leaving my body" searches astral projection, and so on.
// 3. Section fallback: when no chunk matches well, the best matching
//    top level sections contribute their opening chunks, so the model
//    still gets the closest corpus material instead of nothing.
const fs = require('fs');
const path = require('path');

const CORPUS_PATH = path.join(__dirname, '..', 'data', 'DREAMS-UNIFIED.md');

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'is', 'it', 'i', 'me', 'my',
  'what', 'how', 'why', 'when', 'does', 'do', 'did', 'was', 'were', 'are',
  'about', 'tell', 'can', 'you', 'your', 'that', 'this', 'with', 'for', 'on',
  'at', 'by', 'from', 'have', 'has', 'had', 'will', 'would', 'there', 'their',
  'dream', 'dreams', 'dreaming', 'dreamed', 'sleep', 'asleep', 'night'
]);

// Light stemmer: folds plurals and common verb endings together.
function stem(w) {
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ies')) w = w.slice(0, -3) + 'y';
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('es')) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s')) w = w.slice(0, -1);
  // Fold a doubled final consonant left by ing/ed stripping (sitting -> sit).
  if (w.length > 3 && w[w.length - 1] === w[w.length - 2] && !'aeiou'.includes(w[w.length - 1])) {
    w = w.slice(0, -1);
  }
  return w;
}

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || [])
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .map(stem);
}

// Synonym groups: any phrase (matched on the raw query) or member word
// (matched stemmed) pulls the whole group's stemmed tokens into the
// search at a slightly lower weight than the visitor's own words.
const GROUPS = [
  { phrases: ['stone', 'crystal', 'rock', 'rocks'], words: ['stone', 'crystal', 'gem', 'gemstone', 'mineral', 'amethyst', 'moonstone', 'labradorite', 'herkimer', 'lapis', 'celestite', 'azurite', 'sodalite', 'charoite', 'moldavite', 'quartz', 'howlite', 'lepidolite', 'kunzite', 'tourmaline', 'obsidian', 'hematite', 'selenite', 'bloodstone', 'fluorite', 'jade', 'pillow'] },
  { phrases: ['remember', 'recall'], words: ['recall', 'remember', 'memory', 'forget', 'journal'] },
  { phrases: ['vivid', 'intense', 'more real'], words: ['vivid', 'intense', 'powerful', 'realistic'] },
  { phrases: ['the future', 'predict', 'prophecy', 'prophetic'], words: ['precognitive', 'precognition', 'prophetic', 'prophecy', 'future', 'predict', 'prediction', 'foretell'] },
  { phrases: ['on my chest', "can't move", 'cannot move', 'cant move', 'frozen in bed', 'sleep demon', 'hat man'], words: ['paralysis', 'hat', 'hag', 'shadow', 'people', 'demon', 'entity', 'incubus', 'kanashibari', 'chest', 'pressure', 'atonia'] },
  { phrases: ['leave my body', 'leaving my body', 'out of body', 'astral'], words: ['astral', 'projection', 'obe', 'body', 'exit', 'separation'] },
  { phrases: ['another dream', 'within a dream', 'false awakening', 'loop'], words: ['false', 'awakening', 'nested', 'loop', 'layer'] },
  { phrases: ['lucid'], words: ['lucid', 'mild', 'wild', 'wbtb', 'reality', 'check', 'stabilize'] },
  { phrases: ['nightmare', 'bad dream', 'scary dream'], words: ['nightmare', 'terror', 'frightening', 'recurrent'] },
  { phrases: ['gateway', 'monroe', 'hemi-sync', 'hemi sync', 'the cia'], words: ['gateway', 'monroe', 'hemi', 'sync', 'focus', 'cia', 'remote', 'viewing'] },
  { phrases: ['protect', 'protection', 'keep me safe', 'ward off'], words: ['protection', 'protective', 'ward', 'shield', 'guard', 'guardian', 'blessing'] },
  { phrases: ['shared dream', 'same dream', 'meet in a dream', 'mall world', 'telepathy'], words: ['shared', 'connected', 'mutual', 'telepathy', 'telepathic', 'meeting', 'mall', 'world'] },
  { phrases: ['spirit', 'ghost', 'haunted', 'curse', 'entity'], words: ['spirit', 'ghost', 'haunting', 'curse', 'entity', 'attachment', 'blessing', 'luck'] },
  { phrases: ["can't sleep", 'cannot sleep', 'insomnia', 'trouble sleeping', 'wake up a lot'], words: ['insomnia', 'sleepless', 'waking', 'restless', 'hygiene', 'disorder'] },
  { phrases: ['what does it mean', 'meaning of', 'symbol'], words: ['meaning', 'symbol', 'interpretation', 'interpret', 'signify', 'theme'] },
  { phrases: ['falling', 'teeth', 'flying', 'being chased', 'snake'], words: ['falling', 'teeth', 'flying', 'chase', 'snake', 'theme', 'common'] },
  // Thinking, consciousness, and intelligence cluster (Carter, Oct 23, 2026).
  { phrases: ['how thinking works', 'how does thinking work', 'conscious mind', 'subconscious', 'consciousness'], words: ['thinking', 'thought', 'conscious', 'subconscious', 'consciousness', 'mind', 'awareness', 'inner', 'voice'] },
  { phrases: ['at birth', 'when does consciousness start', 'newborn', 'babies think', 'born conscious'], words: ['birth', 'newborn', 'infant', 'baby', 'born', 'start', 'begin', 'delayed', 'develop'] },
  { phrases: ['reincarnation', 'past life', 'past lives', 'birthmark', 'born again', 'lived before'], words: ['reincarnation', 'reincarnated', 'past', 'life', 'lives', 'birthmark', 'birthmarks', 'stevenson', 'children', 'remember', 'died', 'death', 'wound', 'carry'] },
  { phrases: ['street smarts', 'book smarts', 'creative thinking', 'types of intelligence', 'kind of smart', 'internal thinking'], words: ['intelligence', 'intelligent', 'smart', 'smarts', 'creative', 'creativity', 'practical', 'internal', 'iq', 'savant'] }
];

let chunks = null;
let sections = null;

function loadChunks() {
  if (chunks) return chunks;
  let raw = '';
  try {
    raw = fs.readFileSync(CORPUS_PATH, 'utf-8');
  } catch (e) {
    console.error('ERROR: corpus file missing:', e.message);
    chunks = [];
    sections = [];
    return chunks;
  }
  const lines = raw.split('\n');
  const out = [];
  sections = [];
  let heading = '';
  let topHeading = '';
  let buf = [];
  let sectionChunks = null;
  const flush = () => {
    const text = buf.join('\n').trim();
    if (text.length > 40) {
      const size = 1400;
      for (let i = 0; i < text.length; i += size - 200) {
        const slice = text.slice(i, i + size).trim();
        if (slice.length > 40) {
          const chunk = {
            heading,
            topHeading,
            text: slice,
            // Privacy firewall: chunks carrying [Carter fact] lines hold
            // the site owner's personal facts inside the corpus file.
            // The file is synced as written, but those chunks are never
            // eligible for the public chat's lookup.
            personal: slice.includes('[Carter fact]'),
            tokens: new Set(tokenize(slice + ' ' + heading)),
            headingTokens: new Set(tokenize(heading))
          };
          out.push(chunk);
          if (sectionChunks) sectionChunks.push(chunk);
        }
        if (i + size >= text.length) break;
      }
    }
    buf = [];
  };
  for (const line of lines) {
    if (/^#\s/.test(line)) {
      flush();
      topHeading = line.replace(/^#\s*/, '').trim();
      heading = topHeading;
      sectionChunks = [];
      sections.push({ heading: topHeading, headingTokens: new Set(tokenize(topHeading)), chunks: sectionChunks });
      buf.push(line);
    } else if (/^#{2,3}\s/.test(line)) {
      flush();
      heading = line.replace(/^#{2,3}\s*/, '').trim();
      buf.push(line);
    } else {
      buf.push(line);
    }
  }
  flush();
  chunks = out;
  console.log(`INFO: corpus loaded, ${chunks.length} chunks, ${sections.length} sections`);
  return chunks;
}

function expandQuery(query) {
  const lower = ' ' + query.toLowerCase() + ' ';
  const own = [...new Set(tokenize(query))];
  const expanded = new Set();
  for (const g of GROUPS) {
    const phraseHit = g.phrases.some((p) => lower.includes(p));
    const wordHit = g.words.some((w) => own.includes(stem(w)));
    if (phraseHit || wordHit) {
      for (const w of g.words) expanded.add(stem(w));
    }
  }
  for (const t of own) expanded.delete(t);
  return { own, expanded: [...expanded] };
}

function search(query, limit = 6) {
  const all = loadChunks();
  const { own, expanded } = expandQuery(query);
  if (!own.length && !expanded.length) return all.filter((c) => !c.personal).slice(0, limit);
  const lowerQuery = query.toLowerCase();
  const pairs = [];
  const rawTokens = lowerQuery.match(/[a-z0-9]+/g) || [];
  for (let i = 0; i + 1 < rawTokens.length; i++) pairs.push(rawTokens[i] + ' ' + rawTokens[i + 1]);

  // Probe guard: a question that names the site owner gets no chunk
  // that mentions him at all, so there is nothing personal to draw on.
  const probeMode = /\bcarter\b/i.test(query);
  const scored = [];
  for (const c of all) {
    if (c.personal) continue;
    if (probeMode && /\bcarter\b/i.test(c.text)) continue;
    let score = 0;
    for (const t of own) {
      if (c.tokens.has(t)) score += 1;
      if (c.headingTokens.has(t)) score += 2.5;
    }
    for (const t of expanded) {
      if (c.tokens.has(t)) score += 0.6;
      if (c.headingTokens.has(t)) score += 1.2;
    }
    const lowerText = c.text.toLowerCase();
    for (const p of pairs) if (lowerText.includes(p)) score += 1.5;
    if (/how|technique|step|guide|practice|method/.test(lowerQuery) && /\[Guide\]|step by step|technique/.test(c.text)) score += 1.5;
    if (score > 0 && /\[(Documented|Video|Reddit|Tradition|Guide|Research)/.test(c.text)) score += 0.5;
    if (score > 0) scored.push({ score, chunk: c });
  }
  scored.sort((a, b) => b.score - a.score);

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

  // Section fallback: weak chunk matches mean the question is probably
  // phrased far from the corpus wording. Pull the opening chunks of the
  // best matching sections so the model still works from the closest
  // related corpus material instead of nothing.
  const best = scored.length ? scored[0].score : 0;
  if (best < 4 && sections && sections.length) {
    const secScored = [];
    for (const s of sections) {
      let sc = 0;
      for (const t of own) if (s.headingTokens.has(t)) sc += 2.5;
      for (const t of expanded) if (s.headingTokens.has(t)) sc += 1.2;
      if (sc > 0) secScored.push({ sc, section: s });
    }
    secScored.sort((a, b) => b.sc - a.sc);
    for (const ss of secScored.slice(0, 2)) {
      for (const ch of ss.section.chunks.filter((x) => !x.personal && !(probeMode && /\bcarter\b/i.test(x.text))).slice(0, 2)) {
        if (picked.length >= limit) break;
        if (!picked.includes(ch)) picked.push(ch);
      }
    }
  }
  return picked;
}

module.exports = { search, loadChunks, expandQuery };
