// gh を GitHub App bot 名義で実行するラッパー。
//
// installation token を発行して GH_TOKEN に注入し、素の `gh` に引数をそのまま
// 渡して実行する。これを通した `gh issue create` / `gh pr create` /
// `gh api ...` は bot(matchachoco010-bot[bot])名義になる。
//
// 使い方(素の `gh` と同じ引数):
//   node scripts/gh/gh.mjs issue create --title "..." --body "..."
//   node scripts/gh/gh.mjs pr create --base develop --title "..." --body "..."
//   node scripts/gh/gh.mjs pr view 123 --json state,mergedAt
//   echo "body" | node scripts/gh/gh.mjs pr comment 123 --body-file -
//
// 設定は app-token.mjs 参照(ORVK_GH_APP_ID / ORVK_GH_INSTALLATION_ID /
// ORVK_GH_APP_KEY を .claude/settings.local.json の "env" に置く)。

import { spawnSync } from 'node:child_process'
import { getInstallationToken } from './app-token.mjs'

let token
try {
  token = await getInstallationToken()
} catch (e) {
  console.error(e.message)
  process.exit(1)
}

// gh は GH_TOKEN を最優先で使う。stdio は継承し、終了コードもそのまま返す。
// stdin 継承により `--body-file -` などのパイプ入力も透過する。
const result = spawnSync('gh', process.argv.slice(2), {
  stdio: 'inherit',
  env: { ...process.env, GH_TOKEN: token, GITHUB_TOKEN: token },
})

if (result.error) {
  console.error(`gh の起動に失敗しました: ${result.error.message}`)
  process.exit(1)
}
process.exit(result.status ?? 1)
