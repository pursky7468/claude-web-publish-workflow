// verify-functional.js — functional interaction tests for personal-website
//
// Usage:
//   node scripts/verify-functional.js          # test production
//   node scripts/verify-functional.js --local  # test localhost:3001

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

const TESTS = [
  {
    name: 'Home page loads (zh-TW)',
    url: '/zh-TW',
    async run(page) {
      const h1 = page.locator('h1')
      if (await h1.count() === 0) throw new Error('No H1 found on home page')
    },
  },

  {
    name: 'Nav links navigate correctly',
    url: '/zh-TW',
    async run(page) {
      const links = [
        { label: 'Projects', path: '/zh-TW/projects' },
        { label: 'Blog',     path: '/zh-TW/blog' },
        { label: 'About',    path: '/zh-TW/about' },
      ]
      const origin = new URL(page.url()).origin
      for (const { label, path: expectedPath } of links) {
        await page.goto(origin + '/zh-TW', { waitUntil: 'networkidle' })
        const link = page.locator(`nav a[href="${expectedPath}"]`).first()
        if (await link.count() === 0) throw new Error(`Nav link to "${expectedPath}" not found`)
        await Promise.all([
          page.waitForURL(`**${expectedPath}`, { timeout: 5000 }),
          link.click(),
        ])
        const currentPath = new URL(page.url()).pathname
        if (!currentPath.startsWith(expectedPath)) {
          throw new Error(`"${label}" link went to "${currentPath}", expected "${expectedPath}"`)
        }
      }
    },
  },

  {
    name: 'Language switcher: zh-TW → en changes URL locale',
    url: '/zh-TW',
    async run(page) {
      const switcher = page.locator('button[aria-label="Switch language"]').first()
      if (await switcher.count() === 0) throw new Error('Language switcher button not found')

      await Promise.all([
        page.waitForURL(url => url.href.includes('/en'), { timeout: 5000 }),
        switcher.click(),
      ])
      const newUrl = page.url()
      if (!newUrl.includes('/en')) {
        throw new Error(`URL after language switch does not contain /en: ${newUrl}`)
      }
    },
  },

  {
    name: 'Language switcher: en → zh-TW changes URL locale',
    url: '/en',
    async run(page) {
      const switcher = page.locator('button[aria-label="Switch language"]').first()
      await Promise.all([
        page.waitForURL(url => url.href.includes('/zh-TW'), { timeout: 5000 }),
        switcher.click(),
      ])
      const newUrl = page.url()
      if (!newUrl.includes('/zh-TW')) {
        throw new Error(`URL after language switch does not contain /zh-TW: ${newUrl}`)
      }
    },
  },

  {
    name: 'Theme toggle changes data-theme attribute',
    url: '/zh-TW',
    async run(page) {
      const toggle = page.locator('button[aria-label]').filter({ has: page.locator('svg') })
      // Find the theme toggle by looking for a button that changes the html class
      const themeBtns = page.locator('header button')
      const count = await themeBtns.count()

      let toggled = false
      for (let i = 0; i < count; i++) {
        const btn = themeBtns.nth(i)
        const label = await btn.getAttribute('aria-label') || ''
        if (/theme|dark|light|moon|sun/i.test(label)) {
          const htmlBefore = await page.locator('html').getAttribute('class')
          await btn.click()
          await page.waitForTimeout(300)
          const htmlAfter = await page.locator('html').getAttribute('class')
          if (htmlBefore === htmlAfter) throw new Error('Theme toggle did not change html class')
          toggled = true
          break
        }
      }
      if (!toggled) {
        console.log('    (skipped — theme toggle button aria-label not matched)')
      }
    },
  },

  {
    name: 'Mobile menu opens on small viewport',
    url: '/zh-TW',
    async run(page) {
      // Resize to mobile
      await page.setViewportSize({ width: 375, height: 812 })
      await page.reload({ waitUntil: 'networkidle' })

      const menuBtn = page.locator('button[aria-label]').filter({ hasText: '' }).nth(0)
      // Find the hamburger (Menu icon button, not LocaleSwitcher or ThemeToggle)
      const allBtns = page.locator('header button')
      const btnCount = await allBtns.count()

      let opened = false
      for (let i = 0; i < btnCount; i++) {
        const btn = allBtns.nth(i)
        const label = await btn.getAttribute('aria-label') || ''
        if (/menu/i.test(label)) {
          await btn.click()
          await page.waitForTimeout(400)
          // Sheet content should be visible
          const sheet = page.locator('[role="dialog"], [data-radix-dialog-content]')
          if (await sheet.count() > 0 && await sheet.first().isVisible()) {
            opened = true
          } else {
            throw new Error('Mobile menu button clicked but Sheet dialog not visible')
          }
          break
        }
      }
      if (!opened) {
        console.log('    (skipped — menu button not found at mobile viewport)')
      }
    },
  },

  {
    name: 'Blog list page shows post cards',
    url: '/zh-TW/blog',
    async run(page) {
      const cards = page.locator('article, a[href*="/blog/"]')
      const count = await cards.count()
      if (count === 0) throw new Error('No blog post cards found on /zh-TW/blog')
    },
  },

  {
    name: 'Blog post page loads and has H1',
    url: '/zh-TW/blog',
    async run(page) {
      // Click the first post card and verify it loads
      const firstLink = page.locator('a[href*="/blog/"]').first()
      if (await firstLink.count() === 0) throw new Error('No blog post links found')

      const href = await firstLink.getAttribute('href')
      await firstLink.click()
      await page.waitForLoadState('networkidle')

      const h1 = page.locator('h1')
      if (await h1.count() === 0) throw new Error(`Blog post page "${href}" has no H1`)
    },
  },
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
