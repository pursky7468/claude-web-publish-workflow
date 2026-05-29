# claude-web-publish-workflow

Claude Code agent workflow for publishing web content and verifying layout automatically after deployment.

Works with any frontend project deployed to a public URL that Playwright can browse — not limited to blogs or MDX.

## What it does

Four-step publish pipeline, fully automated after you trigger step 1:

| Step | Tool | Job |
|---|---|---|
| 1 | `web-content-publisher` agent | Source → formatted file + commit + push |
| 2 | `web-content-reviewer` agent | Content quality check |
| 3 | `node scripts/verify-layout.js <slug>` | Playwright screenshot + layout checks |
| 4 | Read screenshots | Visual confirmation (text PASS ≠ visual correct) |

After push, Claude waits for your deployment to go live (configurable), runs Playwright, and presents a combined report — no manual intervention needed.

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
- `.claude/agents/web-content-publisher.md`
- `.claude/agents/web-content-reviewer.md`
- `scripts/verify-layout.js`
- `<contentPath>/CLAUDE.md`
- `blog-publish.config.json` (gitignored — contains your URL)

## Usage

Open your project in Claude Code and say:

> 把這份草稿轉成頁面發佈

or

> Convert this draft and publish it

The agents pick up from there. After push, Claude schedules the Playwright verification automatically and presents a combined report at the end.

## verify-layout.js

Can also be run standalone:

```bash
node scripts/verify-layout.js <slug>              # check live site
node scripts/verify-layout.js <slug> --local      # check localhost:3001
node scripts/verify-layout.js <slug> --locale en  # check /<locale>/blog/<slug>
```

Checks performed:
- HTTP 200 (not 404)
- H1 heading exists
- Tables render as HTML (not raw `|` pipe characters)
- Code blocks have syntax highlighting tokens
- No garbled encoding (`???`, `â€`, replacement chars)

These checks target content-heavy pages (articles, docs, blog posts). For pure app UIs, edit the checks in `verify-layout.js` to match what matters for your project.

## Adapting to your stack

The workflow assumes pages are accessible at `<baseUrl>/<slug>` or `<baseUrl>/<locale>/blog/<slug>`.

Customize as needed:
- **URL pattern** — edit the `url` construction in `verify-layout.js`
- **Layout checks** — add/remove checks for your specific requirements (e.g., nav presence, image loading, specific component visibility)
- **Publisher agent** — update the frontmatter schema and content paths in `.claude/agents/web-content-publisher.md`
- **Deploy wait** — adjust `deployWaitSeconds` in `blog-publish.config.json` to match your CI/CD speed

## Why visual screenshots matter

Text `PASS` from automated checks means the selectors matched — it doesn't confirm visual correctness. A table can pass the HTML check but still have broken styles. Screenshots are returned to the main conversation for human eye confirmation, closing the final semantic gap that automated checks can't cover.

## License

MIT
