# Boardle SF

GeoGuessr but for San Francisco tech billboards. See a redacted billboard, guess the company. New one every day.

## What is this?

Every day you get a photo of a billboard from SF with the company name/logo covered up. You have 6 tries to guess which company it is. That's it.

After 3 wrong guesses you get a hint. Stats are tracked locally (win rate, current streak, etc).

**How billboards are sourced:**
- Automated X (Twitter) search runs daily looking for SF billboard posts
- OpenAI checks if images are actually billboards (not news articles, etc)
- If less than 3 good ones are found, Claude generates new search queries to try
- Stops after finding 3 billboards or spending $1 on AI, whichever comes first
- Admin panel to review candidates, redact company names, and schedule puzzles

## Tech Stack

- Next.js 15 (T3 Stack)
- TypeScript + tRPC
- Tailwind CSS
- JSON file storage (no database)
- OpenAI Vision for image validation
- Claude for search query generation
- X API for finding billboard posts

## How It Works

**Playing:**
1. Look at the redacted billboard
2. Type a company name (autocomplete helps)
3. See if you're right
4. Repeat until you win or run out of guesses (6 max)

**Finding Billboards (automated):**

Every day at 9 AM UTC, the system:
1. Searches X with different queries looking for SF billboard posts
2. OpenAI checks each image - is it actually a billboard in SF with visible branding?
3. Auto-approves high confidence ones (>90%), flags medium ones (50-90%) for review, rejects bad ones
4. If less than 3 good billboards found, Claude generates new search queries to try
5. Keeps going until it hits 3 billboards or spends $1 on AI
6. Tracks which queries work and which don't

**Admin Side:**
1. Check what got auto-approved
2. Draw boxes over company names/logos to redact them
3. Add the answer, hint, and category
4. Schedule it for a future date

## Setup

You'll need Node.js 18+ and API keys for X, OpenAI, and optionally Anthropic.

```bash
git clone https://github.com/bshaan77/boardle-sf.git
cd boardle-sf
npm install
cp .env.example .env
```

Now edit `.env` and add your keys:

```bash
X_BEARER_TOKEN="..."           # Required - developer.x.com
OPENAI_API_KEY="sk-..."        # Required - platform.openai.com
ANTHROPIC_API_KEY="sk-ant-..." # Optional - console.anthropic.com

DAILY_BILLBOARD_GOAL="3"       # Find 3 per day
MAX_DAILY_AI_COST="1.0"        # Or stop at $1, whichever first
```

Run it:
```bash
npm run dev
open http://localhost:3000        # Play the game
open http://localhost:3000/admin  # Admin panel
```

Deploy to Vercel:
1. Push to GitHub
2. Import on vercel.com
3. Add env vars
4. Deploy

The `vercel.json` file sets up a daily cron job at 9 AM UTC to search for billboards automatically.

## Admin Panel

Go to `/admin` (no auth - you should add that)

**Search** - Manually run X searches, see quota usage
**Candidates** - Approve/reject billboards, see AI confidence scores
**Schedule** - Draw redaction boxes, add puzzle details, schedule dates
**AI** - Run smart search, see which queries work best

## Costs

**X API** - $100-200/month (pay-as-you-go tier, 7-day search window, 10k posts/month)
**OpenAI** - ~$0.20-0.50/day (GPT-4o-mini vision to check images)
**Claude** - ~$0.10-0.30/day (generates search queries)

Total: ~$10-20/month for AI + X API

## File Structure

```
src/app/
  _components/        - Game UI (board, input, canvas, stats)
  admin/              - Admin panel
  api/cron/           - Daily search endpoint

src/server/
  api/routers/        - tRPC API
  data/               - JSON storage logic
  services/           - X API, OpenAI, Claude, smart search

data/                 - JSON files (puzzles, quota, query stats)
public/puzzles/       - Downloaded billboard images
```

## Data Storage

Everything's in JSON files (no database):
- `data/puzzles.json` - candidates and scheduled puzzles
- `data/quota.json` - search history and X API quota tracking
- `data/query-performance.json` - which queries work
- `public/puzzles/` - downloaded images

If you run this at scale you'll want a real database.

## Contributing

Open to PRs. Some ideas:
- Add auth to admin panel
- Switch to PostgreSQL
- Instagram/Reddit as sources
- Better AI prompts
- Image similarity detection
- Mobile redaction tool
- Leaderboards

## License

MIT
