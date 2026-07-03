// GitHub App の installation access token を発行するモジュール。
//
// コーディングエージェント(Claude Code 等)からの GitHub 操作を、ユーザー個人
// アカウントではなく bot アカウント(GitHub App)名義で行うための土台。
// PR/Issue の作成・レビュー返信は「その操作に使われたトークンの持ち主」に
// 紐づくので、bot の installation token を GH_TOKEN に渡せば bot 名義になる。
//
// installation token は 1 時間で失効するため、その場で JWT を署名して発行し、
// OS の一時ディレクトリに短命キャッシュする(失効 5 分前で作り直す)。
// 秘密鍵(.pem)だけが機密で、リポジトリ外に置く。App ID / Installation ID は
// 機密ではないので設定ファイルに平文で置いてよい。
//
// 設定(環境変数。`.claude/settings.local.json` の "env" に置く):
//   ORVK_GH_APP_ID          … GitHub App の App ID(数字)
//   ORVK_GH_INSTALLATION_ID … リポジトリにインストールした Installation ID(数字)
//   ORVK_GH_APP_KEY         … 秘密鍵 .pem の絶対パス(リポジトリ外)
//
// 使い方(モジュール):
//   import { getInstallationToken } from './app-token.mjs'
//   const token = await getInstallationToken()   // GH_TOKEN に渡す文字列
//
// 使い方(CLI、診断のみ・トークンは出力しない):
//   node scripts/gh/app-token.mjs --check

import { createSign } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { request } from 'node:https'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const REFRESH_MARGIN_MS = 5 * 60 * 1000 // 失効 5 分前で作り直す

function config() {
  const appId = process.env.ORVK_GH_APP_ID
  const installationId = process.env.ORVK_GH_INSTALLATION_ID
  const keyPath = process.env.ORVK_GH_APP_KEY
  const missing = []
  if (!appId) missing.push('ORVK_GH_APP_ID')
  if (!installationId) missing.push('ORVK_GH_INSTALLATION_ID')
  if (!keyPath) missing.push('ORVK_GH_APP_KEY')
  if (missing.length) {
    throw new Error(
      `GitHub App bot の設定が不足しています: ${missing.join(', ')}\n` +
        '.claude/settings.local.json の "env" に App ID / Installation ID / 秘密鍵パスを設定してください。\n' +
        '詳細: scripts/gh/README.md',
    )
  }
  return { appId, installationId, keyPath }
}

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

function makeJwt({ appId, keyPath }) {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  // iat を 60 秒巻き戻すのは、GitHub 側と時計がずれても弾かれないための定石。
  const payload = b64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }))
  const signingInput = `${header}.${payload}`
  let key
  try {
    key = readFileSync(keyPath, 'utf8')
  } catch (e) {
    throw new Error(`秘密鍵を読めません (ORVK_GH_APP_KEY=${keyPath}): ${e.message}`)
  }
  const sig = b64url(createSign('RSA-SHA256').update(signingInput).sign(key))
  return `${signingInput}.${sig}`
}

function githubRequest(method, path, bearer) {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: 'api.github.com',
        path,
        method,
        headers: {
          Authorization: `Bearer ${bearer}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'orvk-gh-app',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
      (res) => {
        let body = ''
        res.on('data', (c) => (body += c))
        res.on('end', () => resolve({ status: res.statusCode, body }))
      },
    )
    req.on('error', reject)
    req.end()
  })
}

function cachePath({ appId, installationId }) {
  return join(tmpdir(), `orvk-gh-app-token-${appId}-${installationId}.json`)
}

function readCache(cfg) {
  try {
    const cached = JSON.parse(readFileSync(cachePath(cfg), 'utf8'))
    if (cached.token && cached.expiresAtMs - Date.now() > REFRESH_MARGIN_MS) return cached.token
  } catch {
    // キャッシュ無し/壊れ → 発行し直す
  }
  return null
}

function writeCache(cfg, token, expiresAtMs) {
  try {
    writeFileSync(cachePath(cfg), JSON.stringify({ token, expiresAtMs }), { mode: 0o600 })
  } catch {
    // キャッシュ書き込み失敗は致命ではない(毎回発行になるだけ)
  }
}

async function mint(cfg) {
  const jwt = makeJwt(cfg)
  const res = await githubRequest(
    'POST',
    `/app/installations/${cfg.installationId}/access_tokens`,
    jwt,
  )
  if (res.status !== 201) {
    throw new Error(
      `installation token の発行に失敗しました (HTTP ${res.status}). ` +
        'App ID / Installation ID / 秘密鍵と、App がリポジトリにインストール済みかを確認してください。\n' +
        res.body,
    )
  }
  const parsed = JSON.parse(res.body)
  return { token: parsed.token, expiresAt: parsed.expires_at, permissions: parsed.permissions }
}

// GH_TOKEN に渡す installation token を返す。キャッシュがあれば再利用する。
export async function getInstallationToken() {
  const cfg = config()
  const cached = readCache(cfg)
  if (cached) return cached
  const { token, expiresAt } = await mint(cfg)
  writeCache(cfg, token, Date.parse(expiresAt))
  return token
}

// 診断用: 認証情報が有効かを、機密(トークン本体)を出さずに確かめる。
async function check() {
  const cfg = config()
  const jwt = makeJwt(cfg)
  const app = await githubRequest('GET', '/app', jwt)
  if (app.status !== 200) {
    console.error(`App JWT が無効です (HTTP ${app.status}). App ID / 秘密鍵を確認してください。`)
    console.error(app.body)
    process.exit(1)
  }
  const a = JSON.parse(app.body)
  const { expiresAt, permissions } = await mint(cfg)
  console.log(`App: ${a.slug} (App ID ${cfg.appId})`)
  console.log(`Installation: ${cfg.installationId}`)
  console.log(`Token 発行 OK. 失効: ${expiresAt}`)
  console.log(`権限: ${JSON.stringify(permissions)}`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2]
  if (mode === '--check') {
    check().catch((e) => {
      console.error(e.message)
      process.exit(1)
    })
  } else {
    console.error('このスクリプトはモジュールとして使う。診断は: node scripts/gh/app-token.mjs --check')
    console.error('gh を bot 名義で実行するには: node scripts/gh/gh.mjs <gh の引数...>')
    process.exit(2)
  }
}
