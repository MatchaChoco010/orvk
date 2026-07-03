#!/usr/bin/env node
// new-heal.mjs — Initialize a new HEAL-<date>-<seq> entry skeleton.
// Usage: node new-heal.mjs <short_kebab_name> [trigger]
//   trigger: tool-failure | missing-capability | env-issue | external-change | <free-form>
//
// Appends a templated HEAL entry to .learnings/HEALS.md and prints the HEAL-ID.
// Does NOT create .learnings/heals/<HEAL-ID>/ — that folder is lazy, created
// only when artifacts are written.
//
// OS 非依存の Node 実装(date / grep に依存しない)。Active-Context は環境変数
// ACTIVE_CONTEXT から読み取る(未設定なら省略)。

import { existsSync, mkdirSync, readFileSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'

const name = process.argv[2]
const trigger = process.argv[3] || 'tool-failure'

if (!name) {
  process.stderr.write('usage: new-heal.mjs <short_kebab_name> [trigger]\n')
  process.exit(2)
}

const pad2 = (n) => String(n).padStart(2, '0')
const now = new Date()
const localDate = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
const compactDate = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`
const loggedUtc = now.toISOString().replace(/\.\d{3}Z$/, 'Z')

const learningsDir = join(process.cwd(), '.learnings')
const healsFile = join(learningsDir, 'HEALS.md')
mkdirSync(learningsDir, { recursive: true })

let seq = 0
if (existsSync(healsFile)) {
  const text = readFileSync(healsFile, 'utf8')
  const re = new RegExp(`^## \\[HEAL-${compactDate}-`, 'gm')
  seq = (text.match(re) || []).length
}
const next = String(seq + 1).padStart(3, '0')
const healId = `HEAL-${compactDate}-${next}`

const activeContext = process.env.ACTIVE_CONTEXT || ''
const activeLine = activeContext ? `**Active-Context**: ${activeContext}\n` : ''

const entry = `
## [${healId}] ${name}

**Logged**: ${loggedUtc}
**Status**: pending-verify
**Trigger**: ${trigger}
${activeLine}**Area**: TODO
**Priority**: medium

### 失敗
TODO — 具体的なエラー、コマンド、終了コード

### 診断
TODO — 調査後の根本原因

### 修正
TODO — 適用したパッチ（コマンド、コード片、またはファイルを生成した場合は .learnings/heals/${healId}/ へのポインタ）

### 検証
TODO — 修正後に何を実行し、何が返ってきたか。**これが通った後にのみ Status を "verified" に更新する。**

### Metadata
- Related Files: TODO
- See Also: TODO
- Pattern-Key: TODO
- Recurrence-Count: 1
- First-Seen: ${localDate}
- Last-Seen: ${localDate}

---
`
appendFileSync(healsFile, entry)

// stdout = the HEAL-ID alone, so `ID=$(node new-heal.mjs ...)` captures it cleanly.
// Human guidance goes to stderr.
process.stdout.write(`${healId}\n`)
process.stderr.write(`${healsFile}\n`)
process.stderr.write(`(create .learnings/heals/${healId}/ only if you generate artifacts to put there)\n`)
