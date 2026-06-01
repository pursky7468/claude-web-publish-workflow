// User-level PostToolUse dispatcher.
// Finds .claude/hooks/post-push.js in the current git repo and delegates to it.

const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

function findGitRoot(dir) {
  let current = dir
  while (true) {
    if (fs.existsSync(path.join(current, '.git'))) return current
    const parent = path.dirname(current)
    if (parent === current) return null
    current = parent
  }
}

let input = ''
process.stdin.on('data', d => (input += d))
process.stdin.on('end', () => {
  const gitRoot = findGitRoot(process.cwd())
  if (!gitRoot) process.exit(0)

  const hookPath = path.join(gitRoot, '.claude', 'hooks', 'post-push.js')
  if (!fs.existsSync(hookPath)) process.exit(0)

  const result = spawnSync('node', [hookPath], {
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'inherit', 'inherit'],
  })

  process.exit(result.status ?? 0)
})
