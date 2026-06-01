#!/usr/bin/env node
// setup.js — install claude-web-publish-workflow into a target project
//
// Usage:
//   node setup.js                        # install into current directory
//   node setup.js --target /path/to/blog # install into specified directory

const fs = require('fs')
const os = require('os')
const path = require('path')
const readline = require('readline')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => new Promise(resolve => rl.question(q, resolve))

const PACKAGE_ROOT = __dirname
const targetIdx = process.argv.indexOf('--target')
const TARGET = targetIdx >= 0 ? path.resolve(process.argv[targetIdx + 1]) : process.cwd()

function copyFile(src, dest, label) {
  const destDir = path.dirname(dest)
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
  fs.copyFileSync(src, dest)
  console.log(`  copied → ${label || dest}`)
}

async function setupUserLevel() {
  const homeDir = os.homedir()
  const claudeDir = path.join(homeDir, '.claude')

  console.log('\n--- User-level Setup ---')
  console.log('Installs shared workflow rules + dispatcher hook (~/.claude/).')
  console.log('One-time setup — all future projects will inherit these automatically.')

  const doUserLevel = await ask('Set up user-level rules and dispatcher? [Y/n]: ')
  if (doUserLevel.trim().toLowerCase() === 'n') return false

  // Install ~/.claude/rules/workflows.md
  const rulesDir = path.join(claudeDir, 'rules')
  const workflowsMd = path.join(rulesDir, 'workflows.md')
  const workflowsSrc = path.join(PACKAGE_ROOT, 'user-level', 'rules', 'workflows.md')
  if (fs.existsSync(workflowsMd)) {
    const ow = await ask('  ~/.claude/rules/workflows.md already exists. Overwrite? [y/N]: ')
    if (ow.trim().toLowerCase() === 'y') copyFile(workflowsSrc, workflowsMd, '~/.claude/rules/workflows.md')
    else console.log('  skipped ~/.claude/rules/workflows.md')
  } else {
    copyFile(workflowsSrc, workflowsMd, '~/.claude/rules/workflows.md')
  }

  // Install ~/.claude/hooks/dispatcher.js
  const hooksDir = path.join(claudeDir, 'hooks')
  const dispatcherDest = path.join(hooksDir, 'dispatcher.js')
  const dispatcherSrc = path.join(PACKAGE_ROOT, 'hooks', 'dispatcher.js')
  if (fs.existsSync(dispatcherDest)) {
    const ow = await ask('  ~/.claude/hooks/dispatcher.js already exists. Overwrite? [y/N]: ')
    if (ow.trim().toLowerCase() === 'y') copyFile(dispatcherSrc, dispatcherDest, '~/.claude/hooks/dispatcher.js')
    else console.log('  skipped ~/.claude/hooks/dispatcher.js')
  } else {
    copyFile(dispatcherSrc, dispatcherDest, '~/.claude/hooks/dispatcher.js')
  }

  // Update ~/.claude/settings.json
  const settingsPath = path.join(claudeDir, 'settings.json')
  let settings = {}
  if (fs.existsSync(settingsPath)) {
    try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) } catch {}
  }

  const dispatcherCmd = process.platform === 'win32'
    ? `node ${dispatcherDest.replace(/\\/g, '\\\\')}`
    : `node ${dispatcherDest}`

  const alreadyHasDispatcher = (settings.hooks?.PostToolUse || []).some(rule =>
    (rule.hooks || []).some(h => h.command?.includes('dispatcher.js'))
  )

  if (!alreadyHasDispatcher) {
    if (!settings.hooks) settings.hooks = {}
    if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = []
    settings.hooks.PostToolUse.push({
      matcher: 'Bash|PowerShell',
      hooks: [{
        type: 'command',
        command: dispatcherCmd,
        timeout: 15,
        statusMessage: 'Running post-push checks...',
      }],
    })
    if (!fs.existsSync(claudeDir)) fs.mkdirSync(claudeDir, { recursive: true })
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n')
    console.log('  updated ~/.claude/settings.json (PostToolUse dispatcher added)')
  } else {
    console.log('  ~/.claude/settings.json already has dispatcher — skipped')
  }

  return true
}

async function main() {
  console.log(`\nclaude-web-publish-workflow setup`)
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
  const defaultCmds = (existing.verifyCommands || ['node scripts/verify-layout.js']).join(', ')
  const verifyCmds = await ask(`Verify commands, comma-separated [${defaultCmds}]: `)

  const config = {
    baseUrl: baseUrl.trim() || existing.baseUrl || 'https://your-site.vercel.app',
    blogPath: blogPath.trim() || existing.blogPath || 'content/blog',
    deployWaitSeconds: parseInt(waitSec.trim(), 10) || existing.deployWaitSeconds || 90,
    verifyCommands: verifyCmds.trim()
      ? verifyCmds.split(',').map(s => s.trim()).filter(Boolean)
      : existing.verifyCommands || ['node scripts/verify-layout.js'],
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n')
  console.log(`\n✓ Wrote blog-publish.config.json`)

  // User-level setup
  const userLevelInstalled = await setupUserLevel()

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

  // Copy project hook
  console.log('\nCopying project hook...')
  const projectHookSrc = path.join(PACKAGE_ROOT, 'project-hooks', 'post-push.js')
  if (fs.existsSync(projectHookSrc)) {
    const projectHookDest = path.join(TARGET, '.claude', 'hooks', 'post-push.js')
    if (fs.existsSync(projectHookDest)) {
      const ow = await ask('  .claude/hooks/post-push.js already exists. Overwrite? [y/N]: ')
      if (ow.trim().toLowerCase() === 'y') copyFile(projectHookSrc, projectHookDest)
      else console.log('  skipped .claude/hooks/post-push.js')
    } else {
      copyFile(projectHookSrc, projectHookDest)
    }
  }

  // Copy scripts
  console.log('\nCopying scripts...')
  const scriptsToCopy = [
    { src: 'verify-layout.js', note: '' },
    { src: 'verify-functional.js', note: ' (template — customize TESTS array for your site)' },
  ]
  for (const { src, note } of scriptsToCopy) {
    const scriptDest = path.join(TARGET, 'scripts', src)
    if (fs.existsSync(scriptDest)) {
      const overwrite = await ask(`  scripts/${src} already exists. Overwrite? [y/N]: `)
      if (overwrite.trim().toLowerCase() === 'y') {
        copyFile(path.join(PACKAGE_ROOT, 'scripts', src), scriptDest)
        if (note) console.log(`  note:${note}`)
      } else {
        console.log(`  skipped ${src}`)
      }
    } else {
      copyFile(path.join(PACKAGE_ROOT, 'scripts', src), scriptDest)
      if (note) console.log(`  note:${note}`)
    }
  }

  // Copy CLAUDE.md
  const claudeMdSrc = userLevelInstalled
    ? path.join(PACKAGE_ROOT, 'content', 'blog', 'CLAUDE.md')
    : path.join(PACKAGE_ROOT, 'content', 'blog', 'CLAUDE.standalone.md')
  const claudeMdDest = path.join(TARGET, config.blogPath, 'CLAUDE.md')
  console.log('\nCopying CLAUDE.md workflow rules...')
  if (!fs.existsSync(claudeMdSrc)) {
    // fallback: use whichever exists
    const fallback = path.join(PACKAGE_ROOT, 'content', 'blog', 'CLAUDE.md')
    if (fs.existsSync(fallback)) {
      if (fs.existsSync(claudeMdDest)) {
        const ow = await ask(`  ${config.blogPath}/CLAUDE.md already exists. Overwrite? [y/N]: `)
        if (ow.trim().toLowerCase() === 'y') copyFile(fallback, claudeMdDest)
        else console.log('  skipped CLAUDE.md')
      } else {
        copyFile(fallback, claudeMdDest)
      }
    }
  } else if (fs.existsSync(claudeMdDest)) {
    const ow = await ask(`  ${config.blogPath}/CLAUDE.md already exists. Overwrite? [y/N]: `)
    if (ow.trim().toLowerCase() === 'y') copyFile(claudeMdSrc, claudeMdDest)
    else console.log('  skipped CLAUDE.md')
  } else {
    copyFile(claudeMdSrc, claudeMdDest)
  }

  console.log('\n✓ Setup complete.')
  console.log('\nNext steps:')
  console.log('  1. Install playwright: npm install -D playwright && npx playwright install chromium')
  if (!userLevelInstalled) {
    console.log('  2. (Optional) Re-run setup to enable user-level rules for multi-project sharing')
  }
  console.log('  2. Open your project in Claude Code — the agents are ready to use.')
  console.log('  3. Ask Claude: "把這份筆記轉成 blog post 發佈"')

  rl.close()
}

main().catch(err => {
  console.error('Setup failed:', err.message)
  rl.close()
  process.exit(1)
})
