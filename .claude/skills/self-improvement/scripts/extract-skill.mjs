#!/usr/bin/env node
// Skill Extraction Helper — creates a new skill scaffold from a learning entry.
// Usage: node extract-skill.mjs <skill-name> [--dry-run] [--output-dir <dir>]
//
// OS 非依存の Node 実装(bash/sed/awk に依存しない)。

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const RED = '\x1b[0;31m'
const GREEN = '\x1b[0;32m'
const YELLOW = '\x1b[1;33m'
const NC = '\x1b[0m'

const logInfo = (m) => process.stdout.write(`${GREEN}[INFO]${NC} ${m}\n`)
const logWarn = (m) => process.stdout.write(`${YELLOW}[WARN]${NC} ${m}\n`)
const logError = (m) => process.stderr.write(`${RED}[ERROR]${NC} ${m}\n`)

function usage() {
  process.stdout.write(`Usage: extract-skill.mjs <skill-name> [options]

Create a new skill from a learning entry.

Arguments:
  skill-name     Name of the skill (lowercase, hyphens for spaces)

Options:
  --dry-run      Show what would be created without creating files
  --output-dir   Override skills directory (default: ./skills)
  -h, --help     Show this help message

Examples:
  extract-skill.mjs docker-m1-fixes
  extract-skill.mjs api-timeout-patterns --dry-run
  extract-skill.mjs pnpm-setup --output-dir /path/to/skills

The skill will be created in: $SKILLS_DIR/<skill-name>/
`)
}

function titleCase(name) {
  return name.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

function skillTemplate(name) {
  return `---
name: ${name}
description: "[TODO: Add a concise description of what this skill does and when to use it]"
---

# ${titleCase(name)}

[TODO: Brief introduction explaining the skill's purpose]

## Quick Reference

| Situation | Action |
|-----------|--------|
| [Trigger condition] | [What to do] |

## Usage

[TODO: Detailed usage instructions]

## Examples

[TODO: Add concrete examples]

## Source Learning

This skill was extracted from a learning entry.
- Learning ID: [TODO: Add original learning ID]
- Original File: .learnings/LEARNINGS.md
`
}

let skillName = ''
let dryRun = false
let skillsDir = process.env.SKILLS_DIR || './skills'

const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--dry-run') {
    dryRun = true
  } else if (a === '--output-dir') {
    skillsDir = argv[++i]
  } else if (a === '-h' || a === '--help') {
    usage()
    process.exit(0)
  } else if (a.startsWith('-')) {
    logError(`Unknown option: ${a}`)
    usage()
    process.exit(1)
  } else if (!skillName) {
    skillName = a
  } else {
    logError(`Unexpected argument: ${a}`)
    usage()
    process.exit(1)
  }
}

if (!skillName) {
  logError('Skill name is required')
  usage()
  process.exit(1)
}

if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(skillName)) {
  logError('Invalid skill name format. Use lowercase letters, numbers, and hyphens only.')
  logError("Examples: 'docker-fixes', 'api-patterns', 'pnpm-setup'")
  process.exit(1)
}

const skillPath = join(skillsDir, skillName)

if (existsSync(skillPath) && !dryRun) {
  logError(`Skill already exists: ${skillPath}`)
  logError('Use a different name or remove the existing skill first.')
  process.exit(1)
}

if (dryRun) {
  logInfo('Dry run - would create:')
  process.stdout.write(`  ${skillPath}/\n`)
  process.stdout.write(`  ${skillPath}/SKILL.md\n\n`)
  process.stdout.write('Template content would be:\n---\n')
  process.stdout.write(skillTemplate(skillName))
  process.stdout.write('---\n')
  process.exit(0)
}

logInfo(`Creating skill: ${skillName}`)
mkdirSync(skillPath, { recursive: true })
writeFileSync(join(skillPath, 'SKILL.md'), skillTemplate(skillName))
logInfo(`Created: ${skillPath}/SKILL.md`)

process.stdout.write('\n')
logInfo('Skill scaffold created successfully!')
process.stdout.write(`
Next steps:
  1. Edit ${skillPath}/SKILL.md
  2. Fill in the TODO sections with content from your learning
  3. Add references/ folder if you have detailed documentation
  4. Add scripts/ folder if you have executable code
  5. Update the original learning entry with:
     **Status**: promoted_to_skill
     **Skill-Path**: skills/${skillName}
`)
