# scripts/gh — GitHub 操作(bot 名義)のヘルパー

コーディングエージェント(Claude Code)からの GitHub 操作を、ユーザー個人アカウントではなく **bot アカウント(GitHub App `matchachoco010-bot`)名義**で行うためのヘルパー群。
PR/Issue の作成・レビュー返信・コミットは「その操作に使われたトークンの持ち主」に紐づくので、bot の installation token を使えば、GitHub 上の操作が `matchachoco010-bot[bot]` 名義になる。

## いつ何を使うか

| やること | コマンド |
|---|---|
| Issue/PR の作成・閲覧・`gh api` など汎用の GitHub 操作 | `node scripts/gh/gh.mjs <gh の引数...>` |
| コミットを bot 名義(Verified)で作る(`git commit` の代わり) | `git add ...` してから `node scripts/gh/commit.mjs "メッセージ"` |
| コンフリクト解消済みマージを bot 名義の 2 親マージコミットで確定(`git merge --continue` の代わり) | 解消して `git add ...` してから `node scripts/gh/merge-commit.mjs "メッセージ"` |
| PR レビューコメントの取得(未解決スレッド + 会話) | `node scripts/gh/pr-comments.mjs <PR番号> [--all] [--json]` |
| PR レビューコメントへのスレッド内返信 | `node scripts/gh/pr-reply.mjs <PR番号> <コメントID> <本文>` |
| 認証情報の疎通確認(トークンは出力しない) | `node scripts/gh/app-token.mjs --check` |

`gh.mjs` は素の `gh` と同じ引数をそのまま受け取り、bot トークンを注入して実行するだけの薄いラッパー。
`gh issue create` / `gh pr create` / `gh pr view` / `gh api graphql` などをこれ経由で呼ぶ。
**素の `gh` を直接使うとユーザー個人アカウント名義になる**ので、GitHub 操作は必ず `gh.mjs` 経由にする。

**複数行の本文は `--body-file`(ファイル)か stdin(`--body-file - <<'EOF'` / `-F body=@<file>`)で渡す。`--body "..."` の argv に複数行を載せない** — Git Bash → ネイティブ Windows exe の argv 変換で先頭1行しか渡らず本文が切れる(理由と手順は `docs/harness/git-and-pr.md`「複数行の本文は stdin で渡す」)。

これを担保するため、`.claude/settings.json` の `permissions.deny` で素の `gh`(`Bash(gh:*)`)・`git commit`(`Bash(git commit:*)`)・`git merge --continue`(`Bash(git merge --continue:*)`)を禁止し、加えて PreToolUse フック `scripts/hooks/bash-wrapper-guard.mjs` が検知して「代わりに `gh.mjs` / `commit.mjs` / `merge-commit.mjs` を使え」と理由つきで block する(deny がハードゲート、フックが案内)。
これらはエージェントが **Bash ツールで直接** 素のコマンドを叩くのを止めるだけで、ラッパーが内部で `gh` / `git` を child_process として起動する分には影響しない(permission もフックも Bash ツール呼び出しにかかり、スクリプト内のサブプロセス起動は対象外)。
したがって「素のコマンドは禁止・ラッパー経由は許可」が両立する。

コミットも bot 名義にする。通常の `git commit` はコミットの author を `git` の `user.name` / `user.email` で決めるためユーザー個人名義になるが、`commit.mjs` は installation token で GitHub の Git Data API を叩いてサーバ側にコミットを作らせるので、author が bot になり **Verified** が付く。`git add` で対象を選んでから `node scripts/gh/commit.mjs "メッセージ"` を実行する(`git commit` の代わり)。複数行メッセージは stdin で渡す(`printf 'subject\n\n本文' | node scripts/gh/commit.mjs -`)。前提として、カレント HEAD が remote に存在するコミットであること(`commit.mjs` はコミットのたびにローカルを remote の新 head へ同期してこの不変条件を保つ)。

マージコミットも同様に bot 名義にする。PR のコンフリクト解消(`git merge origin/develop` → 解消 → `git add`)の確定は、`git merge --continue` の代わりに `node scripts/gh/merge-commit.mjs "メッセージ"` を実行する。2 親(`[HEAD, MERGE_HEAD]`)のマージコミットを Git Data API で作り、作成したツリーの sha がローカル `git write-tree` と一致することを検証してから ref を更新し、ローカルのマージ状態終了(`merge --quit`)と同期まで行う(`commit.mjs` は単一親固定でマージ確定には使えず、マージ中はエラーで merge-commit.mjs へ誘導する)。前提は HEAD と MERGE_HEAD の両方が remote に存在するコミットであること。手順の使いどころは `/pr-workflow`「PR のコンフリクト解消」。

## 仕組み

- `app-token.mjs` が、GitHub App の秘密鍵で JWT を署名し、installation access token を発行する(`getInstallationToken()`)。
- token は 1 時間で失効するため、OS の一時ディレクトリに短命キャッシュし、失効 5 分前で発行し直す。純 Node stdlib(依存ゼロ)。
- `gh.mjs` / `pr-comments.mjs` / `pr-reply.mjs` はこの token を `GH_TOKEN` に入れて `gh` を実行する。
- `commit.mjs` / `merge-commit.mjs` はこの token で Git Data API(blob → tree → commit → ref 更新)を直接呼び、コミットを bot 名義かつ Verified で作る(共通ロジックは `git-data.mjs`)。author/committer を指定せずに作るのがポイント(指定しなければ token の持ち主 = bot 名義になり、GitHub がサーバ署名する)。

## 設定(環境変数)

`.claude/settings.local.json` の `"env"` に置く(このファイルは追跡対象外・マシンローカル)。

```json
{
  "env": {
    "ORVK_GH_APP_ID": "<App ID>",
    "ORVK_GH_INSTALLATION_ID": "<Installation ID>",
    "ORVK_GH_APP_KEY": "<秘密鍵 .pem の絶対パス>"
  }
}
```

- **App ID / Installation ID は機密ではない**ので平文で置いてよい。
- **機密は秘密鍵 `.pem` だけ**。リポジトリ外(例: `C:\Users\<user>\.github\...pem`)に置き、絶対にコミットしない。
- `settings.local.json` の `env` はセッション開始時に読まれる。設定を変えたら Claude Code を再起動する。

## GitHub App の作り直し・再セットアップ

GitHub App(`matchachoco010-bot`)は GitHub の Web UI で作成する(`gh` に App 作成コマンドは無い)。

1. https://github.com/settings/apps → **New GitHub App**。Webhook の Active を外し、Repository permissions を **Contents / Issues / Pull requests = Read and write**(Metadata は自動)、"Only on this account" で作成。
2. 作成後ページの **App ID** を控える。
3. **Generate a private key** で `.pem` を落とし、リポジトリ外に置く。
4. 左メニュー **Install App** → 対象リポジトリのみにインストール。インストール後 URL `settings/installations/<数字>` の数字が **Installation ID**。
5. 上記 3 値を `.claude/settings.local.json` の `env` に設定し、`node scripts/gh/app-token.mjs --check` で疎通確認する。

秘密鍵を紛失/漏洩したら、App 設定ページで古い鍵を削除して新しい鍵を発行し、`ORVK_GH_APP_KEY` を差し替える。
