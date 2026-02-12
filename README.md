# Boardle SF

A daily puzzle game where players guess which San Francisco tech company a redacted billboard belongs to. Think Wordle meets billboard spotting!

## What is this?

SF Billboard is a web game that:
- Shows a redacted billboard image from San Francisco each day
- Players get 6 guesses to identify the company
- Provides hints after 3 wrong guesses
- Tracks stats (win rate, streaks, guess distribution)

**Key Features:**
- 🤖 **AI-Powered Discovery** - Automatically finds SF billboard posts on X (Twitter)
- 🔍 **Smart Validation** - OpenAI Vision validates if images are actual billboards
- 🧠 **Adaptive Learning** - Claude AI generates optimized search queries based on performance
- 💰 **Budget-Controlled** - Stops at 3 billboards OR $1/day in AI costs (whichever first)
- 🎨 **Canvas Redaction Tool** - Draw boxes over company names/logos
- 📊 **Admin Panel** - Manage candidates, schedule puzzles, view analytics

## Tech Stack

Built with the [T3 Stack](https://create.t3.gg/):
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **tRPC** - End-to-end typesafe APIs
- **Tailwind CSS** - Styling
- **File-based storage** - JSON persistence (puzzles, candidates, quota tracking)

**AI Services:**
- **OpenAI GPT-4o-mini Vision** - Image validation
- **Claude 3.5 Sonnet** - Query generation and optimization
- **X (Twitter) API** - Billboard discovery

## How It Works

### For Players
1. Visit the site daily
2. See a redacted billboard image from SF
3. Type guesses (autocomplete with known SF companies)
4. Get feedback on each guess
5. Win by guessing correctly within 6 attempts
6. Share results and view stats

### Behind the Scenes

**Automated Daily Search (9 AM UTC):**
1. **Smart Search** runs multiple optimized queries on X API
2. **OpenAI Vision** validates each image:
   - Is it a physical billboard?
   - Is it in San Francisco?
   - Does it have company branding?
   - Is the image quality good enough?
3. **Auto-categorize** based on AI confidence:
   - >90% = Auto-approved
   - 50-90% = Flagged for manual review
   - <50% = Auto-rejected
4. **If < 3 valid found**: Claude generates new search queries
5. **Stops when**: 3 billboards found OR $1 AI budget spent
6. **Learns & adapts**: Tracks query performance, prunes failures

**Admin workflow:**
1. Review auto-approved candidates
2. Use canvas tool to redact company names/logos
3. Add puzzle metadata (answer, hint, category, date)
4. Schedule for future dates

## Setup

### Prerequisites
- Node.js 18+
- npm or pnpm
- API keys (see below)

### Installation

```bash
# Clone the repo
git clone https://github.com/bshaan77/boardle-sf.git
cd boardle-sf

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Add your API keys (see next section)
```

### Environment Variables

Add these to your `.env` file:

```bash
# Required - X (Twitter) API
X_BEARER_TOKEN="your_bearer_token"  # Get from https://developer.x.com

# Required - OpenAI API
OPENAI_API_KEY="sk-..."  # Get from https://platform.openai.com/api-keys

# Optional - Anthropic API (for query optimization)
ANTHROPIC_API_KEY="sk-ant-..."  # Get from https://console.anthropic.com

# Optional - Automation Settings
ENABLE_CRON="false"              # Set to "true" for automated daily searches
CRON_SCHEDULE="0 9 * * *"        # 9 AM daily (crontab format)
CRON_SECRET="random_string"      # Protect the cron endpoint

# Optional - AI Budget Control
DAILY_BILLBOARD_GOAL="3"         # How many billboards to find per day
MAX_DAILY_AI_COST="1.0"          # Budget limit in USD (stops at goal OR budget)
```

### Development

```bash
# Start dev server
npm run dev

# Open in browser
open http://localhost:3000

# Access admin panel
open http://localhost:3000/admin
```

### Deployment

**Deploy to Vercel (Recommended):**

1. Push to GitHub (already done!)
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Add environment variables in Vercel dashboard
5. Deploy!

The included `vercel.json` configures:
- Automated daily searches via Vercel Cron (9 AM UTC)
- No manual scheduling needed

## Admin Panel Guide

Access at `/admin` (no auth by default - add your own!)

### Tabs

**1. Search Tab**
- Manually trigger X API searches
- View quota usage (monthly limit tracking)
- See recent search history
- Test different queries

**2. Candidates Tab**
- Review pending candidates (AI flagged for review)
- Approve/reject billboard images
- See AI confidence scores
- Sort by quality score (engagement metrics)

**3. Schedule Tab**
- Redact approved billboards (canvas drawing tool)
- Fill in puzzle metadata (answer, hint, category)
- Schedule for specific dates
- View scheduled puzzles

**4. AI Tab**
- Run smart search manually
- View query performance analytics
- See top-performing queries
- Understand how the AI is learning

## API Keys & Costs

### X (Twitter) API
- **Tier**: Pay-as-you-go ($100-200/month)
- **Limits**: 7-day search window, 10k posts/month
- **Sign up**: https://developer.x.com

### OpenAI API
- **Model**: GPT-4o-mini Vision
- **Cost**: ~$0.00015 per image validation
- **Estimate**: ~$0.20-0.50 per day
- **Sign up**: https://platform.openai.com

### Anthropic API
- **Model**: Claude 3.5 Sonnet
- **Cost**: ~$0.02 per query generation
- **Estimate**: ~$0.10-0.30 per day
- **Sign up**: https://console.anthropic.com

**Total**: ~$10-20/month for AI services + X API costs

## File Structure

```
src/
├── app/
│   ├── _components/        # React components
│   │   ├── GameBoard.tsx   # Main game interface
│   │   ├── GuessInput.tsx  # Autocomplete input
│   │   ├── RedactionCanvas.tsx  # Canvas drawing tool
│   │   ├── ShareButton.tsx # Results sharing
│   │   └── StatsModal.tsx  # Player statistics
│   ├── admin/              # Admin panel
│   │   └── page.tsx
│   ├── api/
│   │   ├── cron/           # Automated search endpoint
│   │   └── trpc/           # tRPC routes
│   ├── layout.tsx
│   └── page.tsx            # Home page
├── server/
│   ├── api/
│   │   ├── routers/
│   │   │   └── billboard.ts  # tRPC router
│   │   └── trpc.ts
│   ├── data/               # Data persistence
│   │   ├── companies.ts    # SF company list
│   │   ├── puzzles.ts      # Puzzle & candidate storage
│   │   ├── quota.ts        # X API quota tracking
│   │   └── query-performance.ts  # Query analytics
│   └── services/           # Business logic
│       ├── twitter.ts      # X API integration
│       ├── openai-vision.ts  # Image validation
│       ├── claude-query-generator.ts  # Query optimization
│       ├── smart-search.ts # Intelligent search orchestrator
│       └── scheduled-search.ts  # Cron job handler
└── trpc/                   # tRPC client setup

data/                       # JSON file storage
├── puzzles.json           # Candidates & scheduled puzzles
├── quota.json             # Search history & quota tracking
└── query-performance.json # AI query analytics

public/
└── puzzles/               # Downloaded billboard images
```

## Data Storage

Uses JSON file-based storage (no database required):

- **`data/puzzles.json`** - Candidates, scheduled puzzles
- **`data/quota.json`** - Search history, X API quota usage
- **`data/query-performance.json`** - AI query success rates

Images stored in `public/puzzles/` directory.

**Note**: For production with multiple instances, consider migrating to PostgreSQL/SQLite.

## Contributing

Contributions welcome! This is an open-source project.

**Ideas for improvement:**
- Add authentication to admin panel
- Migrate to database (PostgreSQL/Drizzle)
- Add more data sources (Instagram, Reddit, community submissions)
- Improve AI validation prompts
- Add image similarity detection for better deduplication
- Mobile-responsive redaction canvas
- Leaderboards

## License

MIT

## Credits

Built with Claude Code by Anthropic.

Tech billboards spotted by SF tech Twitter.
