#!/usr/bin/env node
// bash-wrapper-guard.mjs — PreToolUse フック(matcher: Bash)。
//
// 素の `gh` / `git commit` / `git merge --continue` を Bash ツールで直接叩こうと
// したら、理由つきで block し、bot 名義になるラッパー(scripts/gh/gh.mjs /
// commit.mjs / merge-commit.mjs)へ誘導する。permissions.deny(`Bash(gh:*)` /
// `Bash(git commit:*)` / `Bash(git merge --continue:*)`)がハードゲート、本フックが
// 「なぜ・代わりに何を使うか」の案内を担う。該当しないコマンドは素通り(exit 0)。
//
// 検出はコマンド「位置」に限る(行頭・`;`/`&&`/`||`/`|`/`(` の直後、env 代入の後)。
// これにより `node scripts/gh/gh.mjs`(引数中の gh)や `node scripts/gh/commit.mjs`、
// `git status` / `git commit-tree` は誤検知しない。
//
// OS 非依存の純 Node stdlib。起動は
// `node "${CLAUDE_PROJECT_DIR}/scripts/hooks/bash-wrapper-guard.mjs"`。

// コマンド位置のプレフィクス: 行頭 / 区切り(; & | && || |) / 開き括弧 の後、
// 続く env 代入(VAR=val)を読み飛ばす。
const POS = String.raw`(?:^|[;&|(]|&&|\|\|)\s*(?:[A-Za-z_][A-Za-z0-9_]*=[^\s]*\s+)*`
// 素の gh: コマンド位置の `gh` の直後が空白か行末(gh.mjs / github は除外)。
const GH_RE = new RegExp(POS + String.raw`gh(?=\s|$)`, 'm')
// 素の git commit: コマンド位置の git、グローバルオプション(`--no-pager` や値を
// 取る `-c user.x=y` / `-C <path>` 等)を挟んでサブコマンド commit(直後が空白/
// 行末。commit-tree は除外)。オプションは「`-` で始まるトークン + 任意でその値」を
// 繰り返しで読み飛ばす。
const GIT_COMMIT_RE = new RegExp(
  POS + String.raw`git\s+(?:-\S+(?:\s+[^-\s]\S*)?\s+)*commit(?=\s|$)`,
  'm',
)
// git merge --continue: コマンド位置の git、グローバルオプションを挟んで merge、
// その引数のどこかに `--continue`(コンフリクト解消の確定をローカルコミットで
// 行おうとするケース)。`git merge origin/develop` などマージの開始は許可する。
const GIT_MERGE_CONTINUE_RE = new RegExp(
  POS + String.raw`git\s+(?:-\S+(?:\s+[^-\s]\S*)?\s+)*merge\s+(?:\S+\s+)*--continue(?=\s|$)`,
  'm',
)

let input = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (c) => { input += c })
process.stdin.on('end', () => {
  let d = {}
  try { d = JSON.parse(input || '{}') } catch { d = {} }

  const command = (d.tool_input && d.tool_input.command) || ''
  if (!command) process.exit(0)

  const hitsGh = GH_RE.test(command)
  const hitsGitCommit = GIT_COMMIT_RE.test(command)
  const hitsMergeContinue = GIT_MERGE_CONTINUE_RE.test(command)
  if (!hitsGh && !hitsGitCommit && !hitsMergeContinue) process.exit(0)

  const reasons = []
  if (hitsGh) {
    reasons.push(
      '素の `gh` は使わない(ユーザー個人アカウント名義になる)。GitHub 操作は bot 名義になる ' +
        '`node scripts/gh/gh.mjs <gh の引数...>` を通す。',
    )
  }
  if (hitsGitCommit) {
    reasons.push(
      '素の `git commit` は使わない(コミットの author がユーザー個人名義になる)。' +
        '`git add` で対象を選んでから `node scripts/gh/commit.mjs "メッセージ"` を使う(bot 名義 + Verified)。' +
        'マージ中のコンフリクト解消の確定は `node scripts/gh/merge-commit.mjs "メッセージ"`。' +
        '複数行メッセージは stdin: `printf \'subject\\n\\n本文\' | node scripts/gh/commit.mjs -`。',
    )
  }
  if (hitsMergeContinue) {
    reasons.push(
      '`git merge --continue` は使わない(マージコミットの author がユーザー個人名義になる)。' +
        'コンフリクトを解消して `git add` してから `node scripts/gh/merge-commit.mjs "メッセージ"` を使う' +
        '(bot 名義 + Verified の 2 親マージコミット)。',
    )
  }
  reasons.push('詳細: docs/harness/git-and-pr.md /(コマンド手順は)pr-workflow skill。')

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reasons.join('\n'),
    },
  }) + '\n')
})
