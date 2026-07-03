#!/usr/bin/env node
// find-similar-heals.mjs — Search existing heals before generating a new fix.
// Usage: node find-similar-heals.mjs <pattern-key-or-keyword>
//
// Prints matching HEAL entries with their Pattern-Key, Status, and
// Recurrence-Count so the agent can decide whether to re-apply an existing fix
// or write a new one.
//
// OS 非依存の Node 実装(python に依存しない)。

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const query = (process.argv[2] || '').toLowerCase()
const healsFile = join(process.cwd(), '.learnings', 'HEALS.md')

if (!query) {
  process.stderr.write('usage: find-similar-heals.mjs <pattern-key-or-keyword>\n')
  process.exit(2)
}

if (!existsSync(healsFile)) {
  process.stdout.write('(no .learnings/HEALS.md yet — no prior heals to consult)\n')
  process.exit(0)
}

const text = readFileSync(healsFile, 'utf8')
// Split into entries by ^## [HEAL-...]
const entries = text.split(/^## \[HEAL-/m).slice(1)
const hits = []
for (const body of entries) {
  if (!body.toLowerCase().includes(query)) continue
  const head = body.split('\n')[0]
  const pk = body.match(/Pattern-Key:\s*(\S+)/)
  const status = body.match(/Status\*\*:\s*(\S+)/) || body.match(/Status:\s*(\S+)/)
  const rc = body.match(/Recurrence-Count:\s*(\d+)/)
  const closeIdx = head.indexOf(']')
  hits.push({
    id: 'HEAL-' + head.split(']')[0],
    name: closeIdx >= 0 ? head.slice(closeIdx + 1).trim() : head,
    pattern_key: pk ? pk[1] : '?',
    status: status ? status[1] : '?',
    recurrence: rc ? rc[1] : '1',
  })
}

if (hits.length === 0) {
  process.stdout.write(`(no heals match '${query}')\n`)
} else {
  process.stdout.write(`Found ${hits.length} matching heal(s):\n\n`)
  for (const h of hits) {
    process.stdout.write(`  ${h.id} ${h.name}\n`)
    process.stdout.write(`    pattern=${h.pattern_key}  status=${h.status}  recurrence=${h.recurrence}\n`)
  }
}
