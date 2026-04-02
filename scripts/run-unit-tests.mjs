import { execSync } from 'node:child_process'

function run(command) {
  execSync(command, {
    stdio: 'inherit',
  })
}

let rebuiltForNode = false

try {
  console.log('\n[narralab] Rebuilding better-sqlite3 for Node unit test runtime...\n')
  run('npm run rebuild:node')
  rebuiltForNode = true

  console.log('\n[narralab] Running unit tests...\n')
  run('npx vitest run tests/unit')
} finally {
  if (rebuiltForNode) {
    console.log('\n[narralab] Restoring Electron native dependencies...\n')
    run('npm run rebuild:electron')
  }
}
