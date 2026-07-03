#!/usr/bin/env node
// PR のレビューコメントにスレッド内返信する。
//
// `pr-comments.mjs` で出る review-thread のコメント id (databaseId) に対して、
// 同じスレッドに返信を付ける。修正不要な指摘に「なぜ不要か」を返したり、質問に
// 答えたりするのに使う。REST の replies エンドポイントを薄くラップしている。
//
// 使い方:
//   node scripts/gh/pr-reply.mjs <PR番号> <コメントID> <本文>
//   node scripts/gh/pr-reply.mjs <PR番号> <コメントID> --body-file <path>
//   echo "本文" | node scripts/gh/pr-reply.mjs <PR番号> <コメントID> -
//
// 前提: bot(GitHub App)の設定が済み、カレントが対象リポジトリであること。
// gh は bot の installation token(GH_TOKEN)経由で実行する(app-token.mjs)。

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { getInstallationToken } from './app-token.mjs'

const [prNumber, commentId, ...rest] = process.argv.slice(2)

if (!/^\d+$/.test(prNumber ?? '') || !/^\d+$/.test(commentId ?? '')) {
  console.error('usage: node scripts/gh/pr-reply.mjs <PR番号> <コメントID> <本文 | --body-file path | ->')
  process.exit(2)
}

let body
if (rest[0] === '--body-file') {
  body = readFileSync(rest[1], 'utf8')
} else if (rest[0] === '-') {
  body = readFileSync(0, 'utf8')
} else {
  body = rest.join(' ')
}

if (!body.trim()) {
  console.error('エラー: 返信本文が空です。')
  process.exit(2)
}

const ghToken = await getInstallationToken()

function gh(ghArgs, input) {
  return execFileSync('gh', ghArgs, {
    encoding: 'utf8',
    input,
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, GH_TOKEN: ghToken, GITHUB_TOKEN: ghToken },
  })
}

const { nameWithOwner } = JSON.parse(gh(['repo', 'view', '--json', 'nameWithOwner']))

const out = gh([
  'api',
  '--method', 'POST',
  `repos/${nameWithOwner}/pulls/${prNumber}/comments/${commentId}/replies`,
  '-f', `body=${body}`,
])

const reply = JSON.parse(out)
console.log(`返信しました: ${reply.html_url}`)
