import fs from 'fs'
import path from 'path'

const root = process.cwd()

function findLockfiles(dir, found = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
        if (entry.name === 'node_modules') continue

        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
            findLockfiles(fullPath, found)
        }

        if (entry.isFile() && entry.name === 'pnpm-lock.yaml') {
            found.push(fullPath)
        }
    }
    return found
}

const lockfiles = findLockfiles(root)

if (lockfiles.length !== 1) {
    console.error('\n❌ Invalid workspace state.')
    console.error('Exactly one pnpm-lock.yaml must exist at root.\n')
    console.error('Found:\n')
    lockfiles.forEach((f) => console.error(` - ${f}`))
    process.exit(1)
}

if (!lockfiles[0].endsWith('pnpm-lock.yaml')) {
    console.error('Root lockfile not found.')
    process.exit(1)
}

console.log('✅ Workspace structure valid.')