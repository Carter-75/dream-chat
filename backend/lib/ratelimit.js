// In-memory abuse protection for a public, no-login chat.
// Per IP: a per-minute burst limit and a daily cap.
// Site wide: a global daily cap so the API bill can never run away.
// Counters live in memory, which is the right trade for a small public
// site on serverless hosting: they reset on cold starts, and the global
// cap plus the OpenAI account spend limit are the hard backstops.
const perMinute = parseInt(process.env.CHAT_PER_MINUTE || '10', 10);
const dailyPerIp = parseInt(process.env.CHAT_DAILY_CAP_PER_IP || '50', 10);
const dailyGlobal = parseInt(process.env.CHAT_GLOBAL_DAILY_CAP || '500', 10);

const minuteHits = new Map();
const dailyHits = new Map();
let globalDay = '';
let globalCount = 0;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function clientIp(req) {
  const fwd = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || req.ip || 'unknown';
}

// Returns null when allowed, or a friendly error string when limited.
function checkAndRecord(req) {
  const ip = clientIp(req);
  const now = Date.now();
  const minuteKey = `${ip}:${Math.floor(now / 60000)}`;
  const day = todayKey();
  const dailyKey = `${ip}:${day}`;

  const m = (minuteHits.get(minuteKey) || 0) + 1;
  minuteHits.set(minuteKey, m);
  if (minuteHits.size > 5000) minuteHits.clear();
  if (m > perMinute) {
    return `You are sending messages a little fast. Give it a minute, then keep dreaming.`;
  }

  const d = (dailyHits.get(dailyKey) || 0) + 1;
  dailyHits.set(dailyKey, d);
  if (d > dailyPerIp) {
    return `You have used today's free messages (${dailyPerIp} per visitor). Come back tomorrow, the dreams will still be here.`;
  }

  if (globalDay !== day) {
    globalDay = day;
    globalCount = 0;
  }
  globalCount += 1;
  if (globalCount > dailyGlobal) {
    return `The dream chat has hit its daily limit for today. Come back tomorrow.`;
  }
  return null;
}

module.exports = { checkAndRecord, limits: { perMinute, dailyPerIp, dailyGlobal } };
