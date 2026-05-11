#!/usr/bin/env node

const { execSync } = require('child_process')
const { readFileSync } = require('fs')
const { resolve } = require('path')

const bumpType = process.argv[2]
if (!['patch', 'minor', 'major'].includes(bumpType)) {
  console.error('Usage: node scripts/rc-tag.js <patch|minor|major>')
  process.exit(1)
}

const pkg = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf8'))
const isAlreadyRc = /-rc[.\d]*$/.test(pkg.version)

let base
if (isAlreadyRc) {
  base = pkg.version.replace(/-rc[.\d]*$/, '')
} else {
  const parts = pkg.version.split('.').map(Number)
  if (bumpType === 'major') {
    base = `${parts[0] + 1}.0.0`
  } else if (bumpType === 'minor') {
    base = `${parts[0]}.${parts[1] + 1}.0`
  } else {
    base = `${parts[0]}.${parts[1]}.${parts[2] + 1}`
  }
}

let highestRc = 0
try {
  const tags = execSync(`git tag --list "v${base}-rc.*"`, { encoding: 'utf8' }).trim()
  if (tags) {
    for (const tag of tags.split('\n')) {
      const match = tag.match(/-rc\.(\d+)$/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > highestRc) highestRc = num
      }
    }
  }
} catch {
  // No tags found — start at rc.1
}

const rcVersion = `${base}-rc.${highestRc + 1}`

console.log(`Bumping to ${rcVersion}`)
execSync(`npm version ${rcVersion} -m "Release candidate %s"`, { stdio: 'inherit' })
execSync('git push', { stdio: 'inherit' })
execSync('git push --tags', { stdio: 'inherit' })
