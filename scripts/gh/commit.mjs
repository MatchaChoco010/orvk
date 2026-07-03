// コミットを GitHub App bot 名義(Verified)で作るヘルパー。
//
// 通常の `git commit` はコミットの author を `git` の user.name / user.email で
// 決めるため、エージェントのコミットはユーザー個人名義になる。これを bot
// (matchachoco010-bot[bot])名義にするには、installation token で GitHub の
// Git Data API を叩き、サーバ側でコミットオブジェクトを作らせる(仕組みの詳細は
// git-data.mjs)。
//
// フロー(1 コミット分):
//   1. ステージ済み変更(index vs HEAD)を集める(= `git commit` と同じ範囲)。
//   2. blob → tree → commit(parent=HEAD)を API で作成し、ref を更新する。
//   3. ローカルを fetch → `reset --soft` で新コミットへ同期(未ステージの変更は温存)。
//
// 使い方(`git add` で対象を選んでから実行する。`git commit` の代わり):
//   git add -A
//   node scripts/gh/commit.mjs "subject 行\n\n本文"
//   printf 'subject\n\n本文' | node scripts/gh/commit.mjs -   # メッセージを stdin から
//
// マージ中(MERGE_HEAD あり)は使えない。コンフリクト解消の確定は merge-commit.mjs
// (2 親のマージコミット)を使う。
//
// 前提: カレントの HEAD が remote に存在するコミットであること(このヘルパーは
// コミットのたびにローカルを remote の新 head へ同期し、その不変条件を保つ)。
// 設定(App ID / Installation ID / 秘密鍵)は app-token.mjs 参照。

import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { getInstallationToken } from './app-token.mjs'
import {
  buildStagedTreeItems,
  createCommitAndUpdateRef,
  createTree,
  currentBranch,
  git,
  gitText,
  parseRepo,
  readMessage,
} from './git-data.mjs'

async function main() {
  const branch = currentBranch()

  const mergeHead = spawnSync('git', ['rev-parse', '-q', '--verify', 'MERGE_HEAD'], { encoding: 'utf8' })
  if (mergeHead.status === 0) {
    throw new Error('マージ中です。コンフリクト解消の確定は merge-commit.mjs を使ってください(commit.mjs は単一親のコミットしか作れません)。')
  }

  const message = readMessage()
  const { owner, repo } = parseRepo()
  const token = await getInstallationToken()

  const parent = gitText(['rev-parse', 'HEAD'])
  const baseTree = gitText(['rev-parse', 'HEAD^{tree}'])

  const treeItems = await buildStagedTreeItems({ owner, repo, token, base: 'HEAD' })
  if (treeItems.length === 0) {
    throw new Error('ステージされた変更がありません。`git add` で対象を選んでから実行してください。')
  }

  const treeSha = await createTree({ owner, repo, token, baseTree, treeItems })
  const commit = await createCommitAndUpdateRef({
    owner,
    repo,
    token,
    branch,
    message,
    treeSha,
    parents: [parent],
  })

  // ローカルを新コミットへ同期する。reset --soft なので index/working tree は
  // そのまま(index は新 HEAD と一致してクリーンに、未ステージの変更は温存)。
  git(['fetch', 'origin', branch])
  git(['reset', '--soft', commit.sha])
  // 新規ブランチなら upstream を張る。
  spawnSync('git', ['branch', `--set-upstream-to=origin/${branch}`, branch], { stdio: 'ignore' })

  console.log(`bot 名義でコミットしました(Verified): ${commit.sha}`)
  console.log(`  ${branch} ← ${commit.sha.slice(0, 8)}  ${message.split('\n')[0]}`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
}
