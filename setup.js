#!/usr/bin/env node
// setup.js — install claude-blog-publish-workflow into a target project
//
// Usage:
//   node setup.js                        # install into current directory
//   node setup.js --target /path/to/blog # install into specified directory

const fs = require('fs')
const path = require('path')
const readline = require('readline')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => new Promise(resolve => rl.question(q, resolve))

const PACKAGE_ROOT = __dirname
const targetIdx = process.argv.indexOf('--target')
const TARGET = targetIdx >= 0 ? path.resolve(process.argv[targetIdx + 1]) : process.cwd()

function copyFile(src, dest) {
  const destDir = path.dirname(dest)
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
  fs.copyFileSync(src, dest)
  console.log(`  copied → ${path.relative(TARGET, dest)}`)
}

async function main() {
  console.log(`\nclaude-blog-publish-workflow setup`)
  console.log(`Target: ${TARGET}\n`)

  // Load existing config if present
  const configPath = path.join(TARGET, 'blog-publish.config.json')
  let existing = {}
  if (fs.existsSync(configPath)) {
    existing = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    console.log('Found existing blog-publish.config.json — will update.\n')
  }

  const baseUrl = await ask(`Production base URL [${existing.baseUrl || 'https://your-site.vercel.app'}]: `)
  const blogPath = await ask(`Blog content path [${existing.blogPath || 'content/blog'}]: `)
  const waitSec = await ask(`Deploy wait seconds [${existing.deployWaitSeconds || 90}]: `)
  const verifyCommand = await ask(`Verify command [${existing.verifyCommand || 'node scripts/verify-layout.js'}]: `)

  const config = {
    baseUrl: baseUrl.trim() || existing.baseUrl || 'https://your-site.vercel.app',
    blogPath: blogPath.trim() || existing.blogPath || 'content/blog',
    deployWaitSeconds: parseInt(waitSec.trim(), 10) || existing.deployWaitSeconds || 90,
    verifyCommand: verifyCommand.trim() || existing.verifyCommand || 'node scripts/verify-layout.js',
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n')
  console.log(`\n✓ Wrote blog-publish.config.json`)

  // Copy agents
  console.log('\nCopying agent definitions...')
  const agentSrc = path.join(PACKAGE_ROOT, '.claude', 'agents')
  const agentDest = path.join(TARGET, '.claude', 'agents')
  for (const file of fs.readdirSync(agentSrc)) {
    const dest = path.join(agentDest, file)
    if (fs.existsSync(dest)) {
      const overwrite = await ask(`  .claude/agents/${file} already exists. Overwrite? [y/N]: `)
      if (overwrite.trim().toLowerCase() !== 'y') { console.log(`  skipped ${file}`); continue }
    }
    copyFile(path.join(agentSrc, file), dest)
  }

  // Copy verify-layout.js
  console.log('\nCopying scripts...')
  const scriptDest = path.join(TARGET, 'scripts', 'verify-layout.js')
  if (fs.existsSync(scriptDest)) {
    const overwrite = await ask('  scripts/verify-layout.js already exists. Overwrite? [y/N]: ')
    if (overwrite.trim().toLowerCase() === 'y') {
      copyFile(path.join(PACKAGE_ROOT, 'scripts', 'verify-layout.js'), scriptDest)
    } else {
      console.log('  skipped verify-layout.js')
    }
  } else {
    copyFile(path.join(PACKAGE_ROOT, 'scripts', 'verify-layout.js'), scriptDest)
  }

  // Copy CLAUDE.md (optional)
  const claudeMdDest = path.join(TARGET, config.blogPath, 'CLAUDE.md')
  console.log('\nCopying CLAUDE.md workflow rules...')
  if (fs.existsSync(claudeMdDest)) {
    const overwrite = await ask(`  ${config.blogPath}/CLAUDE.md already exists. Overwrite? [y/N]: `)
    if (overwrite.trim().toLowerCase() === 'y') {
      copyFile(path.join(PACKAGE_ROOT, 'content', 'blog', 'CLAUDE.md'), claudeMdDest)
    } else {
      console.log('  skipped CLAUDE.md')
    }
  } else {
    copyFile(path.join(PACKAGE_ROOT, 'content', 'blog', 'CLAUDE.md'), claudeMdDest)
  }

  console.log('\n✓ Setup complete.')
  console.log('\nNext steps:')
  console.log('  1. Install playwright: npm install -D playwright && npx playwright install chromium')
  console.log('  2. Open your project in Claude Code — the agents are ready to use.')
  console.log('  3. Ask Claude: "把這份筆記轉成 blog post 發佈"')

  rl.close()
}

main().catch(err => {
  console.error('Setup failed:', err.message)
  rl.close()
  process.exit(1)
})
