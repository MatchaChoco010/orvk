// コンフリクト解消済みのマージを、bot 名義(Verified)の 2 親マージコミットとして
// 確定するヘルパー。`git merge --continue` / `git commit` の代わりに使う(どちらも
// ローカルでユーザー個人名義のコミットを作ってしまう)。
//
// 想定フロー(PR のコンフリクト解消):
//   git merge origin/develop          # コンフリクトが出る
//   (コンフリクトを解消して git add)
//   node scripts/gh/merge-commit.mjs "Merge origin/develop into feature/hoge"
//   printf 'subject\n\n本文' | node scripts/gh/merge-commit.mjs -   # メッセージを stdin から
//
// フロー(1 マージ分):
//   1. マージ中(MERGE_HEAD あり)かつ未解消ファイルが無いことを確認する。
//   2. index vs MERGE_HEAD の差分から blob → tree を API で作成し、tree sha が
//      ローカル `git write-tree` と一致することを検証する(解消結果の同一性保証)。
//   3. parents=[HEAD, MERGE_HEAD] でコミットを作成し、ref を更新する。
//   4. ローカルのマージ状態を終了(merge --quit)→ fetch → `reset --soft` で
//      新コミットへ同期(未ステージの変更は温存)。
//
// 前提: HEAD(feature ブランチ)と MERGE_HEAD(マージ相手。通常 origin/develop)が
// どちらも remote に存在するコミットであること。
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

  const mergeHeadProbe = spawnSync('git', ['rev-parse', '-q', '--verify', 'MERGE_HEAD'], { encoding: 'utf8' })
  if (mergeHeadProbe.status !== 0) {
    throw new Error('マージ中ではありません(MERGE_HEAD がありません)。通常のコミットは commit.mjs を使ってください。')
  }
  const mergeHead = mergeHeadProbe.stdout.trim()

  const unmerged = gitText(['diff', '--name-only', '--diff-filter=U'])
  if (unmerged) {
    throw new Error(`未解消のコンフリクトが残っています:\n${unmerged}\n解消して git add してから実行してください。`)
  }

  const message = readMessage()
  const { owner, repo } = parseRepo()
  const token = await getInstallationToken()

  const head = gitText(['rev-parse', 'HEAD'])
  const baseTree = gitText(['rev-parse', 'MERGE_HEAD^{tree}'])
  const localTree = gitText(['write-tree'])

  // MERGE_HEAD 側を base にすると、develop を feature に取り込む通常ケースで
  // アップロードする blob が「PR の差分ぶん」だけで済む。
  const treeItems = await buildStagedTreeItems({ owner, repo, token, base: mergeHead })
  const treeSha = await createTree({ owner, repo, token, baseTree, treeItems })

  // API 側で組んだツリーがローカルの解消結果と一致することを、コミット作成前に
  // 検証する。tree sha は内容から決まるので、一致すればマージコミットは
  // ローカルの index と同一内容になる。
  if (treeSha !== localTree) {
    throw new Error(`作成したツリーがローカルの解消結果と一致しません(api=${treeSha} local=${localTree})。ref は更新していません。`)
  }

  const commit = await createCommitAndUpdateRef({
    owner,
    repo,
    token,
    branch,
    message,
    treeSha,
    parents: [head, mergeHead],
  })

  // ローカルのマージ状態を終了してから新コミットへ同期する。merge --quit は
  // MERGE_HEAD 等を消すだけで index/working tree はそのまま。reset --soft で
  // HEAD を新コミットへ進める(index は新 HEAD と一致してクリーンになる)。
  git(['merge', '--quit'])
  git(['fetch', 'origin', branch])
  git(['reset', '--soft', commit.sha])

  console.log(`bot 名義でマージコミットしました(Verified): ${commit.sha}`)
  console.log(`  parents: ${head.slice(0, 8)} + ${mergeHead.slice(0, 8)}`)
  console.log(`  ${branch} ← ${commit.sha.slice(0, 8)}  ${message.split('\n')[0]}`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
}
