# Dream Chat

A public dream chat website. No accounts, no sign up: visitors land on the page and chat right away with an AI guide that answers from one knowledge base, the unified Dreams corpus (`backend/data/DREAMS-UNIFIED.md`).

Built with Carter's MEAN scaffold (`new-project.py` from the MeanStackScript project): Angular 21 frontend and Express backend in one repo, deployed together on Vercel.

## What it does

- Chat answers are grounded in the corpus only. The backend searches the corpus for each question (keyword retrieval over chunks in `backend/lib/retrieval.js`) and sends the best excerpts to the model with every request.
- Source labels from the corpus are preserved in answers: [Documented], [Video], [Reddit / firsthand], [Tradition], [Research claim - contested], [Guide]. Documented material and firsthand accounts are never blended into one claim.
- Dream interpretation, lucid dreaming and sleep paralysis techniques, wake back to bed, the Gateway Process and Focus levels, Mall World, spirits and folklore, famous dreams, and the stories in the corpus.
- Privacy firewall: the public bot gets ONLY the Dreams corpus. No personal memory, email, or other project data is in this repo.

## The AI model

- Provider: OpenAI, called from the backend only. The key lives in the `OPENAI_API_KEY` environment variable, never in frontend code and never in git.
- Model at build time (Oct 21, 2026): `gpt-5-nano`, the cheapest chat capable OpenAI model found on current pricing listings: $0.05 per 1M input tokens and $0.40 per 1M output tokens (cached input $0.005 per 1M).
- The model is configurable: set `OPENAI_MODEL` in Vercel (for example `gpt-5-mini` at $0.25 / $2.00 per 1M) and redeploy to trade a little cost for stronger answers.
- If no key is set, the site still loads and the chat replies with a graceful "almost ready" message instead of an error.

## Abuse protection (no login needed)

In-memory limits in `backend/lib/ratelimit.js`, per visitor IP:

- 10 messages per minute
- 50 messages per day per visitor
- 500 messages per day site wide (global bill protection)

All three are environment variables: `CHAT_PER_MINUTE`, `CHAT_DAILY_CAP_PER_IP`, `CHAT_GLOBAL_DAILY_CAP`.

## Ads

Two clean placeholder slots are marked in the home component (`Ad slot: top banner` and `Ad slot: bottom rectangle`). Paste AdSense code into those blocks when an AdSense account is ready. No ad account is created by this project.

## Run locally

```bash
cp .env.example .env.local   # then put a real OPENAI_API_KEY in .env.local
npm install
npm run dev
```

Frontend on port 4200, backend on port 3000. No database is required: leave `MONGODB_URI` empty.

## Deploy (Vercel)

1. Import this repo in Vercel (same account as Carter's other sites).
2. Set environment variables in Vercel: `OPENAI_API_KEY`, and optionally `OPENAI_MODEL` and the `CHAT_` limits.
3. Deploy. `vercel.json` wires `/api/*` to the Express backend service and everything else to the Angular frontend service.
4. Open the live URL and send a test message before calling it done.

## Footer disclaimer

The site carries a plain footer note: dream content and sleep information, not medical advice.
