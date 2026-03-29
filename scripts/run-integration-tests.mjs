import { execSync } from 'node:child_process'

function run(command) {
  execSync(command, {
    stdio: 'inherit',
  })
}

let rebuiltForNode = false

try {
  console.log('\n[docudoc] Rebuilding better-sqlite3 for Node test runtime...\n')
  run('npm rebuild better-sqlite3')
  rebuiltForNode = true

  console.log('\n[docudoc] Running integration tests...\n')
  run('npx vitest run tests/integration')
} finally {
  if (rebuiltForNode) {
    console.log('\n[docudoc] Restoring Electron native dependencies...\n')
    run('npx electron-builder install-app-deps')
  }
}
