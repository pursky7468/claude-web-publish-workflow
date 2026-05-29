// verify-functional.js — functional interaction tests using Playwright
//
// Usage: node scripts/verify-functional.js [slug] [--local]
//
// Unlike verify-layout.js (which checks static rendering), this script tests
// interactive behavior: clicks, navigation, form inputs, state changes.
//
// The `slug` argument is optional for functional tests — you may run against
// the site root or a specific page depending on what you're testing.
//
// Configure in blog-publish.config.json:
//   { "verifyCommand": "node scripts/verify-functional.js" }
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
// Edit this array to define your functional tests.
// Each test is independent — the browser navigates to `url` fresh each time.

const TESTS = [
  {
    name: 'Home page loads and has a nav',
    url: '/',
    async run(page) {
      const nav = page.locator('nav')
      if (await nav.count() === 0) throw new Error('No <nav> element found')
    },
  },

  {
    name: 'Nav link navigates to a different page',
    url: '/',
    async run(page) {
      // Find the first <a> inside nav that points to an internal page
      const navLinks = page.locator('nav a[href^="/"]')
      const count = await navLinks.count()
      if (count === 0) throw new Error('No internal nav links found')

      const href = await navLinks.first().getAttribute('href')
      await navLinks.first().click()
      await page.waitForLoadState('networkidle')

      const currentPath = new URL(page.url()).pathname
      if (currentPath === '/') throw new Error(`Nav link "${href}" did not navigate away from "/"`)
    },
  },

  {
    name: 'Clicking a button changes visible state',
    url: '/',
    async run(page) {
      // Example: a mobile menu toggle button.
      // Replace the selector with whatever toggle exists on your site.
      const toggle = page.locator('[aria-label*="menu"], button[data-toggle], button.menu-toggle')
      if (await toggle.count() === 0) {
        console.log('    (skipped — no menu toggle found on this page)')
        return
      }

      const target = page.locator('[data-menu], nav.mobile-menu, .drawer')
      const before = await target.isVisible().catch(() => false)
      await toggle.first().click()
      await page.waitForTimeout(300) // allow CSS transition
      const after = await target.isVisible().catch(() => false)

      if (before === after) throw new Error('Toggle click did not change menu visibility')
    },
  },

  {
    name: 'External links have target="_blank"',
    url: '/',
    async run(page) {
      const externalLinks = page.locator('a[href^="http"]:not([href*="localhost"])')
      const count = await externalLinks.count()
      if (count === 0) return // nothing to check

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

  // ── Example: language switcher ───────────────────────────────────────────
  // Uncomment and adapt if your site has i18n routing.
  //
  // {
  //   name: 'Language switcher changes locale in URL',
  //   url: '/',
  //   async run(page) {
  //     const switcher = page.locator('[aria-label*="language"], .lang-switch, [data-locale]')
  //     if (await switcher.count() === 0) throw new Error('No language switcher found')
  //
  //     await switcher.first().click()
  //     await page.waitForLoadState('networkidle')
  //
  //     const url = page.url()
  //     const hasLocale = /\/(en|zh-TW|ja|ko)(\/|$)/.test(url)
  //     if (!hasLocale) throw new Error(`URL after language switch has no locale segment: ${url}`)
  //   },
  // },

  // ── Example: search / filter ──────────────────────────────────────────────
  // Uncomment and adapt if your site has a search input.
  //
  // {
  //   name: 'Search input filters results',
  //   url: '/blog',
  //   async run(page) {
  //     const input = page.locator('input[type="search"], input[placeholder*="search" i]')
  //     if (await input.count() === 0) throw new Error('No search input found')
  //
  //     const beforeCount = await page.locator('article, .post-card').count()
  //     await input.fill('a query that matches at least one result')
  //     await page.waitForTimeout(400) // debounce
  //     const afterCount = await page.locator('article, .post-card').count()
  //
  //     if (afterCount >= beforeCount) throw new Error('Search did not reduce result count')
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

      // Screenshot on failure for debugging
      const screenshotPath = path.join(os.tmpdir(), `functional-fail-${Date.now()}.png`)
      await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {})
      console.log(`         screenshot: ${screenshotPath}`)
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
  const useLocal = args.includes('--local')
  const baseUrl = useLocal ? LOCAL_BASE : config.baseUrl

  console.log(`Running functional tests against: ${baseUrl}\n`)

  const results = await runTests(baseUrl)

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length

  console.log(`\n${passed} passed, ${failed} failed`)

  if (failed > 0) {
    console.log('\nFAIL')
    process.exit(1)
  } else {
    console.log('\nPASS')
  }
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
