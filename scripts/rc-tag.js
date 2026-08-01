#!/usr/bin/env node

// Cuts a release-candidate version bump on the current release branch
// (vX.Y.Z/main). No git tag is created here — the tag is created by CI when
// release.yml publishes the prerelease, so this works under branch
// protection. Ported from tkforgeworks/anvil.

const { execSync } = require('child_process')
const { readFileSync } = require('fs')
const { resolve } = require('path')

const bumpType = process.argv[2]
if (!['patch', 'minor', 'major'].includes(bumpType)) {
  console.error('Usage: node scripts/rc-tag.js <patch|minor|major>')
  process.exit(1)
}

function git(cmd) {
  return execSync(`git ${cmd}`, { encoding: 'utf8' }).trim()
}

const currentBranch = git('rev-parse --abbrev-ref HEAD')
if (currentBranch === 'main' || currentBranch === 'master') {
  console.error(
    'RCs are cut from a release branch (vX.Y.Z/main), never from main — check out the release branch first'
  )
  process.exit(1)
}

// Tags are created remotely by CI, so make sure the local tag list is fresh
// before deriving the next RC number.
try {
  execSync('git fetch --tags --quiet origin', { stdio: 'inherit' })
} catch {
  console.warn('Could not fetch tags from origin — RC numbering uses local tags only')
}

const pkg = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf8'))
const currentVersion = pkg.version
const currentRcMatch = currentVersion.match(/-rc\.(\d+)$/)
const currentRcNum = currentRcMatch ? parseInt(currentRcMatch[1], 10) : 0

let base
if (currentRcMatch) {
  base = currentVersion.replace(/-rc\.\d+$/, '')
} else {
  const parts = currentVersion.split('.').map(Number)
  if (bumpType === 'major') {
    base = `${parts[0] + 1}.0.0`
  } else if (bumpType === 'minor') {
    base = `${parts[0]}.${parts[1] + 1}.0`
  } else {
    base = `${parts[0]}.${parts[1]}.${parts[2] + 1}`
  }
}

let highestTagRc = 0
try {
  const tags = execSync(`git tag --list "v${base}-rc.*"`, { encoding: 'utf8' }).trim()
  if (tags) {
    for (const tag of tags.split('\n')) {
      const match = tag.match(/-rc\.(\d+)$/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > highestTagRc) highestTagRc = num
      }
    }
  }
} catch {
  // No tags found
}

const nextRc = Math.max(highestTagRc, currentRcNum) + 1
const rcVersion = `${base}-rc.${nextRc}`

console.log(`Bumping to ${rcVersion}`)
execSync(`npm version ${rcVersion} --no-git-tag-version`, { stdio: 'inherit' })
execSync('git add package.json package-lock.json', { stdio: 'inherit' })
execSync(`git commit -m "Release candidate ${rcVersion}"`, { stdio: 'inherit' })

console.log(`Pushing ${currentBranch} — release.yml will build and publish the prerelease (tag v${rcVersion} is created by CI)`)
execSync(`git push -u origin ${currentBranch}`, { stdio: 'inherit' })
