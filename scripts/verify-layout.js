// Usage: node scripts/verify-layout.js <slug> [--local] [--locale zh-TW|en]
//
// Checks that a blog post renders correctly on the live site:
//   - Page loads (non-404)
//   - Tables render as HTML table elements (not raw | characters)
//   - Code blocks have syntax highlighting tokens
//   - No garbled encoding (???, â€, replacement chars)
//   - H1 heading exists
//
// --local       → uses http://localhost:3001 instead of the production URL
// --locale en   → verifies /en/blog/<slug> (default: /zh-TW/blog/<slug>)
//
// Reads baseUrl from blog-publish.config.json in the project root.
// Saves screenshots to the system temp directory and prints their paths.
// Exits with code 1 if any check fails.

const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')
const os = require('os')

const LOCAL_BASE = 'http://localhost:3001'

function loadConfig() {
  const configPath = path.join(process.cwd(), 'blog-publish.config.json')
  if (!fs.existsSync(configPath)) {
    console.error('Error: blog-publish.config.json not found in project root.')
    console.error('Run setup.js to create it, or copy blog-publish.config.example.json.')
    process.exit(1)
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'))
}

async function verify(slug, baseUrl, locale) {
  const url = locale ? `${baseUrl}/${locale}/blog/${slug}` : `${baseUrl}/blog/${slug}`
  const screenshotSlug = locale ? `${slug}-${locale}` : slug
  const tmpDir = os.tmpdir()
  const screenshots = []
  const failures = []

  console.log(`Verifying: ${url}\n`)

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

  try {
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })

    if (!response || !response.ok()) {
      const status = response ? response.status() : 'no response'
      console.error(`FAIL: HTTP ${status}`)
      process.exit(1)
    }

    // Full-page screenshot
    const fullPath = path.join(tmpDir, `verify-${screenshotSlug}-full.png`)
    await page.screenshot({ path: fullPath, fullPage: true })
    screenshots.push(fullPath)

    const bodyText = await page.locator('body').innerText()
    // Text outside code blocks — used for encoding check to avoid false positives
    // from intentional "???" examples in troubleshooting articles.
    const proseText = await page.evaluate(() => {
      const clone = document.body.cloneNode(true)
      clone.querySelectorAll('pre, code, script, style').forEach(el => el.remove())
      return clone.innerText || clone.textContent || ''
    })

    // Check: H1 exists
    const h1 = await page.locator('h1').first()
    if (await h1.count() === 0) {
      failures.push('Layout: no H1 heading found')
    } else {
      const title = (await h1.innerText()).trim()
      console.log(`  [PASS] H1: "${title.slice(0, 60)}"`)
    }

    // Check: tables render as HTML (not raw pipe chars)
    const tableCount = await page.locator('table').count()
    const hasPipeTables = /^\|.+\|$/m.test(bodyText)
    if (hasPipeTables) {
      failures.push('Tables: raw | pipe characters found — table not rendered as HTML')
    } else {
      console.log(`  [PASS] Tables: ${tableCount} HTML table(s), no raw pipes`)
      if (tableCount > 0) {
        const tablePath = path.join(tmpDir, `verify-${screenshotSlug}-table.png`)
        await page.locator('table').first().screenshot({ path: tablePath })
        screenshots.push(tablePath)
      }
    }

    // Check: code blocks have syntax highlighting tokens
    const preCount = await page.locator('pre').count()
    if (preCount === 0) {
      console.log('  [PASS] Code blocks: none (N/A)')
    } else {
      // rehype-pretty-code wraps tokens in <span> inside <code> inside <pre>
      const tokenCount = await page.locator('pre code span').count()
      if (tokenCount === 0) {
        failures.push(`Code blocks: ${preCount} <pre> found but no highlight tokens detected`)
      } else {
        console.log(`  [PASS] Code blocks: ${preCount} block(s), ${tokenCount} highlight tokens`)
      }
      // Screenshot the longest pre element (most lines) with padding
      const pres = page.locator('pre')
      const count = await pres.count()
      let longestIndex = 0
      let maxLines = 0
      for (let i = 0; i < count; i++) {
        const text = await pres.nth(i).innerText()
        const lines = text.split('\n').length
        if (lines > maxLines) { maxLines = lines; longestIndex = i }
      }
      const codePath = path.join(tmpDir, `verify-${screenshotSlug}-code.png`)
      await pres.nth(longestIndex).scrollIntoViewIfNeeded()
      const box = await pres.nth(longestIndex).boundingBox()
      if (box) {
        const pad = 20
        const vp = page.viewportSize() || { width: 1280, height: 900 }
        const x = Math.max(0, box.x - pad)
        const y = Math.max(0, box.y - pad)
        const width = Math.min(vp.width - x, box.width + pad * 2)
        const height = Math.min(box.height + pad * 2, 1200)
        await page.screenshot({ path: codePath, clip: { x, y, width, height } })
      } else {
        await pres.nth(longestIndex).screenshot({ path: codePath })
      }
      screenshots.push(codePath)
    }

    // Check: no garbled encoding
    const garbledPatterns = [
      { pattern: /\?{3,}/, label: '???' },
      { pattern: /â€/, label: 'â€ (UTF-8 mojibake)' },
      { pattern: /ï¿½/, label: 'ï¿½ (replacement char)' },
      { pattern: /�/, label: '\\uFFFD (Unicode replacement char)' },
    ]
    const garbled = garbledPatterns.find(({ pattern }) => pattern.test(proseText))
    if (garbled) {
      failures.push(`Encoding: garbled text found — "${garbled.label}"`)
    } else {
      console.log('  [PASS] Encoding: no garbled characters')
    }

  } finally {
    await browser.close()
  }

  console.log('\n--- Screenshots (MUST READ each file below for visual inspection) ---')
  screenshots.forEach(p => console.log(' ', p))

  // Write baseline cache
  const cacheDir = path.join(process.cwd(), '.verify-cache')
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })
  fs.writeFileSync(
    path.join(cacheDir, `${slug}-${Date.now()}.json`),
    JSON.stringify({ slug, timestamp: new Date().toISOString(), url, passed: failures.length === 0 })
  )

  if (failures.length > 0) {
    console.log('\nFAIL')
    failures.forEach(f => console.log('  ✗', f))
    process.exit(1)
  } else {
    console.log('\nPASS — automated checks passed.')
    console.log('⚠ NEXT STEP: Use the Read tool on every screenshot path above.')
    console.log('  Text PASS does not confirm visual correctness (background, spacing, contrast).')
    console.log('  Verification is NOT complete until screenshots are visually inspected.')
  }
}

const args = process.argv.slice(2)
const slug = args.find(a => !a.startsWith('--'))
const useLocal = args.includes('--local')
const localeIdx = args.indexOf('--locale')
const locale = localeIdx >= 0 ? args[localeIdx + 1] : null

if (!slug) {
  console.error('Usage: node scripts/verify-layout.js <slug> [--local] [--locale zh-TW|en]')
  process.exit(1)
}

const config = loadConfig()
verify(slug, useLocal ? LOCAL_BASE : config.baseUrl, locale).catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
