#!/usr/bin/env node

/**
 * Generates release-notes markdown from commit subjects since the previous
 * tag. Ported from tkforgeworks/anvil with two adaptations:
 *  - Jira ticket regex is CGUI-\d+
 *  - A stable release (no prerelease suffix) diffs against the previous
 *    STABLE tag, not the last rc.N — otherwise final notes would only
 *    contain the handful of commits after the last release candidate.
 *
 * Env:
 *  RELEASE_VERSION  tag being released (e.g. v1.1.0-rc.4); defaults to
 *                   GITHUB_REF_NAME, then the newest tag
 *  JIRA_BASE_URL    e.g. https://tkforgeworks.atlassian.net/browse —
 *                   when set, CGUI-123 becomes a link
 */

const { execSync } = require('child_process')

const JIRA_BASE = process.env.JIRA_BASE_URL || ''

function git(cmd) {
  return execSync(`git ${cmd}`, { encoding: 'utf-8' }).trim()
}

function isPrerelease(tag) {
  return tag.includes('-')
}

function findPreviousTag() {
  try {
    const tags = git('tag --sort=-v:refname').split('\n').filter(Boolean)
    const current = process.env.RELEASE_VERSION || process.env.GITHUB_REF_NAME || tags[0]
    const idx = tags.indexOf(current)
    if (idx < 0) return tags.length > 0 ? tags[0] : null

    const candidates = tags.slice(idx + 1)
    if (!isPrerelease(current)) {
      // Stable release: span all rc.N tags back to the previous stable
      const prevStable = candidates.find((t) => !isPrerelease(t))
      if (prevStable) return prevStable
    }
    return candidates.length > 0 ? candidates[0] : null
  } catch {
    return null
  }
}

function getCommits(since) {
  const range = since ? `${since}..HEAD` : 'HEAD'
  const raw = git(`log ${range} --format="%h|||%s"`)
  if (!raw) return []
  return raw.split('\n').map((line) => {
    const [hash, ...rest] = line.split('|||')
    return { hash, message: rest.join('|||') }
  })
}

function isReleaseBump(msg) {
  return /^Release\b/i.test(msg) || /^\d+\.\d+\.\d+/i.test(msg)
}

function isFix(msg) {
  // Bare "Fix ..." subjects and ticket-prefixed "CGUI-123: Fix ..." both count
  return /^fix\b/i.test(msg) || /^CGUI-\d+:\s*fix\b/i.test(msg)
}

function linkTickets(msg) {
  if (!JIRA_BASE) return msg
  const base = JIRA_BASE.replace(/\/$/, '')
  return msg.replace(/\b(CGUI-\d+)\b/g, `[$1](${base}/$1)`)
}

function run() {
  const prevTag = findPreviousTag()
  const commits = getCommits(prevTag)
  const filtered = commits.filter((c) => !isReleaseBump(c.message))

  if (filtered.length === 0) {
    console.log('No notable changes in this release.')
    return
  }

  const fixes = []
  const changes = []
  for (const c of filtered) {
    if (isFix(c.message)) {
      fixes.push(c)
    } else {
      changes.push(c)
    }
  }

  const lines = ["## What's Changed", '']
  if (changes.length > 0) {
    lines.push('### Changes')
    for (const c of changes) lines.push(`- ${linkTickets(c.message)}`)
    lines.push('')
  }
  if (fixes.length > 0) {
    lines.push('### Bug Fixes')
    for (const c of fixes) lines.push(`- ${linkTickets(c.message)}`)
    lines.push('')
  }

  console.log(lines.join('\n'))
}

run()
