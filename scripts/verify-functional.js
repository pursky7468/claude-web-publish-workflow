// verify-functional.js — functional interaction tests using Playwright
//
// Usage: node scripts/verify-functional.js [slug] [--local]
//
// Unlike verify-layout.js (which checks static rendering), this script tests
// interactive behavior: clicks, navigation, form inputs, state changes.
//
// Configure in blog-publish.config.json:
//   { "verifyCommands": ["node scripts/verify-layout.js", "node scripts/verify-functional.js"] }
//
// EXIT CODES
//   0 — all tests passed
//   1 — one or more tests failed
//
// HOW TO CUSTOMIZE
//   Edit the TESTS array below. Each test has:
//     name    — displayed in output
//     url     — path appended to baseUrl (e.g. "/" or "/blog/my-post")
//     run     — async function(page) that performs actions and assertions
//               throw an Error to fail the test
//
// SPA NAVIGATION NOTE
//   For client-side routing (Next.js, React Router, etc.), do NOT use
//   waitForLoadState('networkidle') after a click — it resolves immediately
//   because no network request is made. Use waitForURL instead:
//
//     await Promise.all([
//       page.waitForURL(url => url.href.includes('/target'), { timeout: 5000 }),
//       element.click(),
//     ])

const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')
const os = require('os')

const LOCAL_BASE = 'http://localhost:3001'

function loadConfig() {
  const configPath = path.join(process.cwd(), 'blog-publish.config.json')
  if (!fs.existsSync(configPath)) {
    console.error('Error: blog-publish.config.json not found in project root.')
    process.exit(1)
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'))
}

// ─── TESTS ────────────────────────────────────────────────────────────────────
// Replace these with tests that match your site's actual UI and routes.

const TESTS = [
  {
    name: 'Home page loads',
    url: '/',
    async run(page) {
      const h1 = page.locator('h1')
      if (await h1.count() === 0) throw new Error('No H1 found on home page')
    },
  },

  {
    name: 'Nav exists and has links',
    url: '/',
    async run(page) {
      const nav = page.locator('nav')
      if (await nav.count() === 0) throw new Error('No <nav> element found')
      const links = nav.locator('a')
      if (await links.count() === 0) throw new Error('Nav has no links')
    },
  },

  {
    name: 'External links have target="_blank"',
    url: '/',
    async run(page) {
      const externalLinks = page.locator('a[href^="http"]:not([href*="localhost"])')
      const count = await externalLinks.count()
      if (count === 0) return

      const missing = []
      for (let i = 0; i < Math.min(count, 20); i++) {
        const target = await externalLinks.nth(i).getAttribute('target')
        const href = await externalLinks.nth(i).getAttribute('href')
        if (target !== '_blank') missing.push(href)
      }
      if (missing.length > 0) {
        throw new Error(`External links missing target="_blank":\n    ${missing.join('\n    ')}`)
      }
    },
  },

  // ── Example: nav link navigates correctly (SPA-safe) ─────────────────────
  // Replace href and expected path with your actual routes.
  //
  // {
  //   name: 'Nav link navigates to /about',
  //   url: '/',
  //   async run(page) {
  //     const link = page.locator('nav a[href="/about"]').first()
  //     if (await link.count() === 0) throw new Error('Nav link to /about not found')
  //     await Promise.all([
  //       page.waitForURL(url => url.href.includes('/about'), { timeout: 5000 }),
  //       link.click(),
  //     ])
  //     if (!page.url().includes('/about')) throw new Error('Did not navigate to /about')
  //   },
  // },

  // ── Example: language / locale switcher ───────────────────────────────────
  // Uncomment and adapt if your site has i18n routing.
  //
  // {
  //   name: 'Language switcher changes URL locale',
  //   url: '/',
  //   async run(page) {
  //     const switcher = page.locator('button[aria-label="Switch language"]').first()
  //     if (await switcher.count() === 0) throw new Error('Language switcher not found')
  //     const before = page.url()
  //     await Promise.all([
  //       page.waitForURL(url => url.href !== before, { timeout: 5000 }),
  //       switcher.click(),
  //     ])
  //     if (page.url() === before) throw new Error('Language switch did not change URL')
  //   },
  // },

  // ── Example: theme toggle ─────────────────────────────────────────────────
  //
  // {
  //   name: 'Theme toggle changes html class',
  //   url: '/',
  //   async run(page) {
  //     const btn = page.locator('button[aria-label*="theme" i], button[aria-label*="dark" i]').first()
  //     if (await btn.count() === 0) throw new Error('Theme toggle button not found')
  //     const before = await page.locator('html').getAttribute('class')
  //     await btn.click()
  //     await page.waitForTimeout(300)
  //     const after = await page.locator('html').getAttribute('class')
  //     if (before === after) throw new Error('Theme toggle did not change html class')
  //   },
  // },

  // ── Example: search / filter ──────────────────────────────────────────────
  //
  // {
  //   name: 'Search input filters results',
  //   url: '/blog',
  //   async run(page) {
  //     const input = page.locator('input[type="search"], input[placeholder*="search" i]')
  //     if (await input.count() === 0) throw new Error('No search input found')
  //     const before = await page.locator('article').count()
  //     await input.fill('search term')
  //     await page.waitForTimeout(400)
  //     const after = await page.locator('article').count()
  //     if (after >= before) throw new Error('Search did not reduce result count')
  //   },
  // },
]

// ─── RUNNER ───────────────────────────────────────────────────────────────────

async function runTests(baseUrl) {
  const browser = await chromium.launch()
  const results = []

  for (const test of TESTS) {
    const url = baseUrl + test.url
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

    try {
      const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
      if (!response || !response.ok()) {
        throw new Error(`HTTP ${response ? response.status() : 'no response'}`)
      }

      await test.run(page)
      console.log(`  [PASS] ${test.name}`)
      results.push({ name: test.name, passed: true })

    } catch (err) {
      console.log(`  [FAIL] ${test.name}`)
      console.log(`         ${err.message}`)

      const screenshotPath = path.join(os.tmpdir(), `functional-fail-${Date.now()}.png`)
      await page.screenshot({ path: screenshotPath }).catch(() => {})
      console.log(`         screenshot → ${screenshotPath}`)
      results.push({ name: test.name, passed: false, error: err.message, screenshot: screenshotPath })

    } finally {
      await page.close()
    }
  }

  await browser.close()
  return results
}

async function main() {
  const config = loadConfig()
  const args = process.argv.slice(2)
  const baseUrl = args.includes('--local') ? LOCAL_BASE : config.baseUrl

  console.log(`Functional tests → ${baseUrl}\n`)

  const results = await runTests(baseUrl)
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
