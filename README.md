# claude-blog-publish-workflow

Claude Code agent workflow for publishing MDX blog posts with automated layout verification.

## What it does

Four-step publish pipeline, fully automated after you trigger step 1:

| Step | Tool | Job |
|---|---|---|
| 1 | `web-content-publisher` agent | Source → `.mdx` + commit + push |
| 2 | `web-content-reviewer` agent | Content quality check |
| 3 | `node scripts/verify-layout.js <slug>` | Playwright screenshot + layout checks |
| 4 | Read screenshots | Visual confirmation (text PASS ≠ visual correct) |

Claude Code handles the sequencing, including waiting for your deployment to go live before running the Playwright check.

## Requirements

- [Claude Code](https://claude.ai/code)
- Node.js ≥ 18
- Playwright (`npm install -D playwright && npx playwright install chromium`)
- A blog deployed on Vercel (or any public URL)

## Installation

```bash
# Clone this repo somewhere
git clone https://github.com/YOUR_USERNAME/claude-blog-publish-workflow

# Run setup from your blog project directory
cd /path/to/your-blog
node /path/to/claude-blog-publish-workflow/setup.js
```

Setup will ask for:
- **Production base URL** — your Vercel (or other) deployment URL
- **Blog content path** — where `.mdx` files live (default: `content/blog`)
- **Deploy wait seconds** — how long to wait for deployment before running Playwright (default: 90)

It installs:
- `.claude/agents/web-content-publisher.md`
- `.claude/agents/web-content-reviewer.md`
- `scripts/verify-layout.js`
- `<blogPath>/CLAUDE.md`
- `blog-publish.config.json` (gitignored — contains your URL)

## Usage

Open your blog project in Claude Code and say:

> 把這份筆記轉成 blog post 發佈

or

> Convert this draft and publish it

The agents pick up from there. After push, Claude schedules the Playwright verification automatically and presents a combined report at the end.

## verify-layout.js

Can also be run standalone:

```bash
node scripts/verify-layout.js <slug>              # check live site
node scripts/verify-layout.js <slug> --local      # check localhost:3001
node scripts/verify-layout.js <slug> --locale en  # check /en/blog/<slug>
```

Checks performed:
- HTTP 200 (not 404)
- H1 heading exists
- Tables render as HTML (not raw `|` pipe characters)
- Code blocks have syntax highlighting tokens
- No garbled encoding (`???`, `â€`, replacement chars)

## Adapting to your stack

The workflow assumes:
- MDX blog posts with frontmatter (`title`, `date`, `tags`, `summary`, `draft`)
- `rehype-pretty-code` for syntax highlighting (token check: `pre code span`)
- Posts accessible at `<baseUrl>/blog/<slug>` or `<baseUrl>/<locale>/blog/<slug>`

If your setup differs, edit `scripts/verify-layout.js` for the selectors and `.claude/agents/web-content-publisher.md` for the frontmatter schema.

## License

MIT
