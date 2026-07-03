// Git Data API で bot 名義コミットを組み立てる共有ロジック。
// commit.mjs(通常コミット)と merge-commit.mjs(コンフリクト解消のマージコミット)から使う。
// 単体で実行するスクリプトではない。

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { request } from 'node:https'

export function git(args, { buffer = false } = {}) {
  const r = spawnSync('git', args, {
    encoding: buffer ? 'buffer' : 'utf8',
    maxBuffer: 512 * 1024 * 1024,
  })
  if (r.status !== 0) {
    const err = (r.stderr && r.stderr.toString()) || ''
    throw new Error(`git ${args.join(' ')} が失敗しました: ${err.trim()}`)
  }
  return r.stdout
}

export const gitText = (args) => git(args).trim()

// installation token での GitHub API 呼び出し。非 2xx でも reject せず status を返す
// (ref の存在確認で 404 を分岐に使うため)。
export function api(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body)) : null
    const req = request(
      {
        hostname: 'api.github.com',
        path,
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'orvk-gh-app',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(data ? { 'Content-Type': 'application/json', 'Content-Length': data.length } : {}),
        },
      },
      (res) => {
        let b = ''
        res.on('data', (c) => (b += c))
        res.on('end', () => {
          let parsed = null
          try {
            parsed = b ? JSON.parse(b) : null
          } catch {
            parsed = null
          }
          resolve({ status: res.statusCode, data: parsed, raw: b })
        })
      },
    )
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

export async function apiOk(method, path, token, body) {
  const res = await api(method, path, token, body)
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`GitHub API ${method} ${path} → HTTP ${res.status}\n${res.raw}`)
  }
  return res.data
}

// remote.origin.url から {owner, repo} を取り出す(https / ssh の両形式)。
export function parseRepo() {
  const url = gitText(['config', '--get', 'remote.origin.url'])
  const m = url.match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?$/)
  if (!m) throw new Error(`remote.origin.url から owner/repo を判別できません: ${url}`)
  return { owner: m[1], repo: m[2] }
}

// コミットメッセージを argv[2](または '-' / 省略時は stdin)から読む。
export function readMessage() {
  const arg = process.argv[2]
  if (arg && arg !== '-') return arg
  const msg = readFileSync(0, 'utf8')
  if (!msg.trim()) throw new Error('コミットメッセージが空です(引数か stdin で渡してください)')
  return msg.replace(/\n+$/, '')
}

// カレントブランチ名。detached HEAD と develop/main 直コミットを拒否する。
export function currentBranch() {
  const branch = gitText(['rev-parse', '--abbrev-ref', 'HEAD'])
  if (branch === 'HEAD') throw new Error('detached HEAD ではコミットできません。ブランチ上で実行してください。')
  if (branch === 'develop' || branch === 'main') {
    throw new Error(`${branch} へ直接コミットしないでください。feature ブランチを切ってから実行します。`)
  }
  return branch
}

// index(ステージ済み)と base コミットの差分から Git Data API のツリー項目を作る。
// 追加/変更ファイルは blob をアップロードし、削除は sha:null の項目にする。
// -z で NUL 区切り、--no-renames で rename を削除+追加に分解して扱いを単純化する。
export async function buildStagedTreeItems({ owner, repo, token, base }) {
  const rawStatus = git(['diff', '--name-status', '--no-renames', '-z', '--staged', base])
  const fields = rawStatus.split('\0').filter((s) => s.length > 0)
  const treeItems = []
  for (let i = 0; i < fields.length; i += 2) {
    const status = fields[i]
    const path = fields[i + 1]
    if (status === 'D') {
      // 削除: base 側の mode を付けつつ sha:null で消す。
      const line = gitText(['ls-tree', base, '--', path])
      const mode = line ? line.split(/\s+/)[0] : '100644'
      treeItems.push({ path, mode, type: 'blob', sha: null })
      continue
    }
    // 追加/変更/型変更: index の mode と中身から blob を作る。
    const stage = gitText(['ls-files', '--stage', '--', path])
    const mode = stage ? stage.split(/\s+/)[0] : '100644'
    const content = git(['cat-file', 'blob', `:${path}`], { buffer: true })
    const blob = await apiOk('POST', `/repos/${owner}/${repo}/git/blobs`, token, {
      content: content.toString('base64'),
      encoding: 'base64',
    })
    treeItems.push({ path, mode, type: 'blob', sha: blob.sha })
  }
  return treeItems
}

// base_tree にツリー項目を重ねた新しいツリーを作成し、その sha を返す。
export async function createTree({ owner, repo, token, baseTree, treeItems }) {
  const tree = await apiOk('POST', `/repos/${owner}/${repo}/git/trees`, token, {
    base_tree: baseTree,
    tree: treeItems,
  })
  return tree.sha
}

// コミットを作成し、refs/heads/<branch> を新コミットへ更新(未作成なら作成)する。
// author/committer は指定しない → installation token の持ち主(bot)名義になり
// GitHub がサーバ署名するので "Verified" が付く。
export async function createCommitAndUpdateRef({ owner, repo, token, branch, message, treeSha, parents }) {
  const commit = await apiOk('POST', `/repos/${owner}/${repo}/git/commits`, token, {
    message,
    tree: treeSha,
    parents,
  })

  const refPath = `/repos/${owner}/${repo}/git/refs/heads/${branch}`
  const existing = await api('GET', `/repos/${owner}/${repo}/git/ref/heads/${branch}`, token)
  if (existing.status === 200) {
    await apiOk('PATCH', refPath, token, { sha: commit.sha, force: false })
  } else if (existing.status === 404) {
    await apiOk('POST', `/repos/${owner}/${repo}/git/refs`, token, {
      ref: `refs/heads/${branch}`,
      sha: commit.sha,
    })
  } else {
    throw new Error(`ref 確認に失敗: HTTP ${existing.status}\n${existing.raw}`)
  }
  return commit
}
