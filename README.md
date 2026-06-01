# claude-web-publish-workflow

Claude Code agent workflow for publishing web content and verifying layout automatically after deployment.

Works with any frontend project deployed to a public URL that Playwright can browse — not limited to blogs or MDX.

## Architecture

Three-layer design based on scope alignment:

```
~/.claude/rules/workflows.md        ← shared flow rules (all projects)
~/.claude/hooks/dispatcher.js       ← shared enforcement (all projects)

project/.claude/hooks/post-push.js  ← project-specific trigger logic
project/blog-publish.config.json    ← project-specific verify config
project/scripts/verify-*.js         ← project-specific verify scripts
```

| Layer | What lives here | Who writes it |
|---|---|---|
| User rules | 4-step flow, ScheduleWakeup rule | `setup.js` → `~/.claude/rules/` |
| User hook | Dispatcher that delegates to project hook | `setup.js` → `~/.claude/hooks/` |
| Project | Content format rules, trigger logic, verify config | `setup.js` → project |

## What it does

Four-step publish pipeline, fully automated after you trigger step 1:

| Step | Tool | Job |
|---|---|---|
| 1 | `web-content-publisher` agent | Source → formatted file + commit + push |
| 2 | `web-content-reviewer` agent | Content quality check |
| 3 | `node scripts/verify-layout.js <slug>` | Playwright screenshot + layout checks |
| 4 | Read screenshots | Visual confirmation (text PASS ≠ visual correct) |

After push, the dispatcher hook detects the push, Claude waits for your deployment to go live (configurable), runs all `verifyCommands`, and presents a combined report — no manual intervention needed.

## Requirements

- [Claude Code](https://claude.ai/code)
- Node.js ≥ 18
- Playwright (`npm install -D playwright && npx playwright install chromium`)
- A project deployed to a public URL

## Installation

```bash
# Clone this repo somewhere
git clone https://github.com/pursky7468/claude-web-publish-workflow

# Run setup from your project directory
cd /path/to/your-project
node /path/to/claude-web-publish-workflow/setup.js
```

Setup will ask for:
- **Production base URL** — your deployment URL (Vercel, Netlify, etc.)
- **Content path** — where your content files live (default: `content/blog`)
- **Deploy wait seconds** — how long to wait after push before running Playwright (default: 90)

It installs:

**User-level** (one-time, shared across projects):
- `~/.claude/rules/workflows.md` — 4-step flow rules
- `~/.claude/hooks/dispatcher.js` — post-push hook dispatcher
- `~/.claude/settings.json` — PostToolUse hook entry

**Project-level** (per project):
- `.claude/agents/web-content-publisher.md`
- `.claude/agents/web-content-reviewer.md`
- `.claude/hooks/post-push.js` — project-specific push detection
- `scripts/verify-layout.js`
- `<contentPath>/CLAUDE.md`
- `blog-publish.config.json` (gitignored — contains your URL)

## Usage

Open your project in Claude Code and say:

> 把這份草稿轉成頁面發佈

or

> Convert this draft and publish it

The agents pick up from there. After push, the hook fires automatically, Claude schedules the Playwright verification, and presents a combined report at the end.

## verify-layout.js

Can also be run standalone:

```bash
node scripts/verify-layout.js <slug>              # check live site
node scripts/verify-layout.js <slug> --local      # check localhost:3001
```

Checks performed:
- HTTP 200 (not 404)
- H1 heading exists
- Tables render as HTML (not raw `|` pipe characters)
- Code blocks have syntax highlighting tokens
- No garbled encoding (`???`, `â€`, replacement chars)

## Pluggable verify commands

The verify step is fully configurable via `verifyCommands` in `blog-publish.config.json`:

```json
{
  "baseUrl": "https://your-site.vercel.app",
  "blogPath": "content/blog",
  "deployWaitSeconds": 90,
  "verifyCommands": [
    "node scripts/verify-layout.js",
    "node scripts/verify-functional.js"
  ]
}
```

Claude runs each command with the slug appended as the first argument. You can add any number of scripts — all are run in sequence, and results are merged into one report.

If a script outputs screenshot paths, Claude will `Read` them for visual confirmation.

## Project hook contract

Each project's `.claude/hooks/post-push.js` receives tool input JSON on stdin and should:

1. Check if it was a `git push` command
2. Detect if project-specific content was pushed
3. If yes, output a ScheduleWakeup reminder to stdout
4. Exit 0

Example output format (followed by dispatcher):

```
⚠️  BLOG CONTENT PUSHED — MANDATORY:
Call ScheduleWakeup NOW:
  delaySeconds: 90
  reason: "waiting for Vercel deploy to run verifyCommands"
  prompt: "Run verifyCommands from blog-publish.config.json for: my-post"
```

## Adding a second project

Once the user-level setup is done (dispatcher + workflow rules), adding a new project only needs:

1. Run `setup.js --target /path/to/new-project` — installs project-level files
2. Customize `.claude/hooks/post-push.js` for the new project's content detection
3. Customize `scripts/verify-layout.js` checks if needed

No changes to `~/.claude/` required.

## Why visual screenshots matter

Text `PASS` from automated checks means the selectors matched — it doesn't confirm visual correctness. A table can pass the HTML check but still have broken styles. Screenshots are returned to the main conversation for human eye confirmation, closing the final semantic gap that automated checks can't cover.

## License

MIT
