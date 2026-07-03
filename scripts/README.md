# scripts/ — エージェント向けワークフロースクリプト

AI エージェント(Claude Code)が使う skill やハーネスの再利用スクリプトを置くディレクトリ。
一度使っただけの使い捨てスクリプトはここにもリポジトリにも残さない。
何度も使うワークフロー用のスクリプトだけを、再利用手段ごと整備する。

## 言語は Node.js で統一する(方針)

scripts/ のスクリプトは **Node.js (ESM, `.mjs`)** で書く。
今後もこれで揃える。

### なぜ Node か(Python ではなく)

- **activate が要らない。** Python だとグローバルにパッケージを入れられず `.venv` を作って毎回 activate する必要がある。Node なら scripts/ に `package.json` と `node_modules/` を置いておくだけで、どのシェルからでも `node scripts/...` で即実行できる。
- **Windows(PowerShell 主体)で摩擦が少ない。** venv の activate スクリプトやパス周りで OS 差が出にくい。
- **ハーネスと一貫する。** Claude Code 本体や skill の hook も JS/TS 系。
- 本ディレクトリの用途(gh / git のラップ、テキスト処理、JSON 整形)は Node の標準機能と `gh` への child_process 呼び出しで十分まかなえる。

Python の方がデータ解析系の便利なパッケージは多いが、scripts/ の用途では上記の運用上の利点が勝る。

ここに置くのは「何度も使う」と確信できる再利用スクリプトだけ。
その場の動作確認用の使い捨てスクリプトはリポジトリに残さず、スクラッチパッドなどリポジトリ外で扱う。
継続的に守りたい回帰は Rust のテスト(`cargo test`)にする。
判断基準は [../docs/harness/scripts.md](../docs/harness/scripts.md) を参照。

## セットアップと実行

依存が増えたら scripts/ で一度だけインストールする。
`node_modules/` は `.gitignore` 済みで、コミットしない。

```sh
cd scripts && npm install     # 依存が増えたときだけ。activate は不要。
node scripts/gh/pr-comments.mjs <PR番号>
```

## 構成

- `gh/` — GitHub 操作を **bot アカウント(GitHub App)名義**で行うためのヘルパー。`gh.mjs` が installation token を発行して `gh` に注入し、Issue/PR/レビューを bot 名義で実行する。`pr-comments.mjs` / `pr-reply.mjs` は `gh api graphql` が冗長になるレビューコメント操作を薄くラップする。設定と仕組みは [gh/README.md](gh/README.md)。

## 新しいスクリプトを足すとき

- 使い捨てではなく「何度も使う」と確信できるものだけ追加する。
- ESM(`.mjs`)で書き、ファイル冒頭にコメントで用途と使い方を書く。
- どの skill / ワークフローから呼ばれるかを skill 側にも明記する。
