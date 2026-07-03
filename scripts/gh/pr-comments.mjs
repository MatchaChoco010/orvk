#!/usr/bin/env node
// PR のレビューコメントを取得して整形表示する。
//
// inline のレビュースレッド(解決済み/未解決の状態つき)、会話タブの issue
// コメント、そして本文つきの review サマリー(行コメントを伴わない COMMENTED /
// APPROVED レビューの本体)を集める。`gh api graphql` が冗長になる操作なので
// ヘルパー化している。素の `gh pr view` では取れないスレッドの isResolved を出す。
//
// 使い方:
//   node scripts/gh/pr-comments.mjs <PR番号> [--all] [--json]
//     --all  : 解決済みスレッドも含める(既定は未解決のみ)
//     --json : 整形済みテキストでなく JSON を出力
//
// 前提: bot(GitHub App)の設定が済み、カレントが対象リポジトリであること。
// gh は bot の installation token(GH_TOKEN)経由で実行する(app-token.mjs)。

import { execFileSync } from 'node:child_process'
import { getInstallationToken } from './app-token.mjs'

const args = process.argv.slice(2)
const prNumber = args.find((a) => /^\d+$/.test(a))
const includeResolved = args.includes('--all')
const asJson = args.includes('--json')

if (!prNumber) {
  console.error('usage: node scripts/gh/pr-comments.mjs <PR番号> [--all] [--json]')
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
const [owner, repo] = nameWithOwner.split('/')

const query = `
query($owner:String!, $repo:String!, $pr:Int!) {
  repository(owner:$owner, name:$repo) {
    pullRequest(number:$pr) {
      reviewThreads(first:100) {
        nodes {
          isResolved
          isOutdated
          path
          line
          comments(first:50) {
            nodes { databaseId author { login } body url createdAt }
          }
        }
      }
      comments(first:100) {
        nodes { databaseId author { login } body url createdAt }
      }
      reviews(first:100) {
        nodes { author { login } state body url createdAt }
      }
    }
  }
}`

const raw = gh([
  'api', 'graphql',
  '-f', `query=${query}`,
  '-F', `owner=${owner}`,
  '-F', `repo=${repo}`,
  '-F', `pr=${prNumber}`,
])

const pr = JSON.parse(raw).data.repository.pullRequest

const threads = pr.reviewThreads.nodes
  .filter((t) => includeResolved || !t.isResolved)
  .map((t) => ({
    type: 'review-thread',
    resolved: t.isResolved,
    outdated: t.isOutdated,
    path: t.path,
    line: t.line,
    comments: t.comments.nodes.map((c) => ({
      id: c.databaseId,
      author: c.author?.login ?? '(unknown)',
      body: c.body,
      url: c.url,
      createdAt: c.createdAt,
    })),
  }))

const issueComments = pr.comments.nodes.map((c) => ({
  type: 'issue-comment',
  id: c.databaseId,
  author: c.author?.login ?? '(unknown)',
  body: c.body,
  url: c.url,
  createdAt: c.createdAt,
}))

// review サマリー(本文つきの review 本体)。行コメントは reviewThreads 側で拾うので、
// ここでは本文のある review だけを対象にする(APPROVED でも本文があれば拾う)。
const reviews = pr.reviews.nodes
  .filter((r) => r.body && r.body.trim())
  .map((r) => ({
    type: 'review',
    author: r.author?.login ?? '(unknown)',
    state: r.state,
    body: r.body,
    url: r.url,
    createdAt: r.createdAt,
  }))

if (asJson) {
  console.log(JSON.stringify({ threads, issueComments, reviews }, null, 2))
  process.exit(0)
}

if (!threads.length && !issueComments.length && !reviews.length) {
  console.log(`PR #${prNumber}: コメントなし`)
  process.exit(0)
}

console.log(`# PR #${prNumber} のコメント (${nameWithOwner})\n`)

if (threads.length) {
  console.log(`## レビュースレッド (${includeResolved ? '全件' : '未解決のみ'}): ${threads.length}\n`)
  for (const t of threads) {
    const flags = [t.resolved ? 'resolved' : 'UNRESOLVED', t.outdated ? 'outdated' : null]
      .filter(Boolean)
      .join(', ')
    console.log(`### ${t.path}:${t.line ?? '?'} [${flags}]`)
    for (const c of t.comments) {
      console.log(`  - @${c.author} (id=${c.id}) ${c.url}`)
      console.log(`    ${c.body.replace(/\n/g, '\n    ')}`)
    }
    console.log('')
  }
}

if (reviews.length) {
  // review 本体は行スレッドではないので pr-reply.mjs の返信先 id を持たない。
  // 返信は PR 会話コメント(gh pr comment)で行う。
  console.log(`## レビュー(サマリー本文): ${reviews.length}\n`)
  for (const r of reviews) {
    console.log(`- @${r.author} [${r.state}] ${r.url}`)
    console.log(`  ${r.body.replace(/\n/g, '\n  ')}`)
  }
  console.log('')
}

if (issueComments.length) {
  console.log(`## 会話コメント: ${issueComments.length}\n`)
  for (const c of issueComments) {
    console.log(`- @${c.author} (id=${c.id}) ${c.url}`)
    console.log(`  ${c.body.replace(/\n/g, '\n  ')}`)
  }
}
