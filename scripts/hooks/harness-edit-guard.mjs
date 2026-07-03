#!/usr/bin/env node
// harness-edit-guard.mjs — PreToolUse フック(matcher: Edit|Write|MultiEdit)。
//
// ハーネス(エージェント向けの規約・指示・道具立て)のファイルを編集しようとした
// 瞬間に、docs/harness/editing.md に従うよう `additionalContext` でリマインダーを
// 注入する。非ブロック(過剰にワークフローを止めない)。ハーネス以外のファイル編集
// では何も出さず exit 0。
//
// OS 非依存の純 Node stdlib(jq / python に依存しない)。フックは
// `node "${CLAUDE_PROJECT_DIR}/scripts/hooks/harness-edit-guard.mjs"` で起動する。

import path from 'node:path'

let input = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (c) => { input += c })
process.stdin.on('end', () => {
  let d = {}
  try { d = JSON.parse(input || '{}') } catch { d = {} }

  const ti = d.tool_input || {}
  const filePath = ti.file_path || ti.filePath || ti.path || ''
  if (!filePath) process.exit(0)

  // file_path は絶対/相対いずれもありうる。repo ルート相対へ正規化する。
  const cwd = d.cwd || process.cwd()
  let rel = path.isAbsolute(filePath) ? path.relative(cwd, filePath) : filePath
  rel = rel.split(path.sep).join('/').replace(/^\.\//, '')

  // ハーネス(規約・指示・道具立て)のパス。design doc 本体(docs/design/NNNN_*.md)は
  // 対象外 — あれは design doc 規約の管轄であって「ハーネス編集」ではない。
  const isHarness =
    rel === 'CLAUDE.md' ||
    rel === '.claude/settings.json' ||
    rel.startsWith('.claude/skills/') ||
    rel.startsWith('docs/harness/') ||
    rel === 'docs/design/README.md' ||
    rel === 'docs/design/template.md' ||
    rel.startsWith('scripts/')

  if (!isHarness) process.exit(0)

  const additionalContext = [
    '<harness-edit-guard>',
    `編集対象 ${rel} はハーネス(エージェント向けの規約・指示・道具立て)です。変更前に docs/harness/editing.md に従うこと:`,
    '- 既存を読み、重複はマージし、整理してから書く(末尾に継ぎ足して肥大化させない)。CLAUDE.md には常時必要な standing 規約だけを置く。',
    '- 参照ドキュメントや skill を新設・変更したら、「いつ読む/読まねばならないか」を明示し、実際に読まれる仕組み(docs/harness/README.md の索引への登録 + skill の description かフック)まで用意する。受動的なポインタを置くだけにしない。',
    '- ハーネスの変更は Issue + ゲーティング PR で行い、マージはユーザー(エージェントは develop / main にマージしない)。詳細は docs/harness/git-and-pr.md。',
    'ハーネス文書の一覧と「いつ読むか」は docs/harness/README.md。',
    '</harness-edit-guard>',
  ].join('\n')

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext },
  }) + '\n')
})
