# orvk

Vulkan を使いやすい API にラップする Rust 製の GPU ライブラリ。
複数の GPU API を抽象化する RHI ではなく Vulkan 専用の単体ライブラリ。
`VK_EXT_descriptor_heap` 前提の bindless 記述子運用を核とする。
設計原則は easy ではなく simple(docs/philosophy.md 参照)。

このリポジトリは Claude Code を前提に運用する。
CLAUDE.md には**常時必要な standing 規約だけ**を置く。
特定の作業のときだけ必要な規約は `docs/harness/` 配下の参照ドキュメントに置き、ここからは短いポインタで参照する。
その一覧と「いつ読むか」は [docs/harness/README.md](docs/harness/README.md)。
ハーネス(CLAUDE.md / skill / `docs/harness/` / design doc のルール / `scripts/`)を編集するときは [docs/harness/editing.md](docs/harness/editing.md)(編集の作法・CLAUDE.md を肥大化させない整理の規律)に従う。

## Pre-v1 API 方針

このプロダクトはまだ v1.0.0 前であり、API を正しい形へ試行錯誤している段階である。
互換性維持のために deprecated な旧 API や旧 payload、移行用 alias を残してはいけない。
正しい API 形状が決まったら、古い形は同じ変更で削除または非公開化し、workspace 内の利用箇所を全面的に新 API へ揃える。
メンテナンスフェーズのような段階的 migration や両 API の長期並存を選ばない。

## Design Docs(必読ルール)

設計判断は **docs/design/ の番号付き design doc** に意思決定の記録として残す。
ルールとテンプレートは [docs/design/README.md](docs/design/README.md) と [docs/design/template.md](docs/design/template.md) を参照。
要点:

- 1ファイル = 1意思決定。`NNNN_title.md` の連番(意思決定の時系列順)。
- 代替案と Pros/Cons、なぜその案を選んだかを必ず書く。
- 昔の doc は消さない。設計変更は新番号の doc で記録し、旧 doc を参照する。
- status: `draft`(書きかけ)/ `ready for review`(レビュー待ち)/ `reviewing`(レビュー PR でレビュー中)/ `approved`(ユーザー承認)/ `ai-approved`(委任判断で実装)/ `rejected`。
- レビュー前の doc(`draft` / `ready for review`)も **develop に集約**する(feature → develop を `--no-ff` で PR なし landing。ユーザーがブランチ切替なしに読めるように)。レビューは develop から `reviewing` に変えるだけの **レビュー PR** で行い、PR コメント(差分外の行にも可)でレビューし、承認後にユーザーがマージする(README「レビュープロセス」)。

design doc の執筆・レビューは専用 skill で行う。
`/design-doc-write` で draft を書き、`/design-doc-review` でルール遵拠と設計妥当性を敵対的にレビューする。
両者を束ねて敵対的レビューを収束まで自動で回し、完成した `draft` を提示するワークフローは `/design-doc` で起動する(詳細は各 skill 参照)。

## Markdown の書き方(全 markdown 共通)

Markdown は **文の途中で見た目(行の折り返し)のためだけに改行を入れない**。
長い文を見た目で割らず、折り返しはエディタのソフトラップに任せる(文中の見た目改行は word wrap のあるエディタで中途半端な改行となり読みにくくする)。
改行は意味の区切り(段落・文末・リスト項目など)で行い、日本語の散文は **一文ごとに改行する「一文一行」を標準**とする(→ `japanese-tech-writing` skill)。
詳細・例外と例は [docs/harness/markdown.md](docs/harness/markdown.md)。

## 検証コマンド

- `cargo test --workspace --quiet`(workspace が立ち上がったら)

## Git・Issue・PR(常時のゲート)

作業は **Issue + `feature/hoge` ブランチ + PR** でトラックする。
`main`(動作保証)← `develop`(開発)← `feature/hoge`(機能単位)。
`feature` は `--no-ff` で `develop` に戻す。

- **誰が何をマージするか(重要)**: 実装コード・ハーネス変更・Design Doc レビュー PR の **ゲーティング PR はユーザーがマージする。エージェントは `develop` / `main` に勝手にマージしない。** 唯一の例外はレビュー前 Design Doc(`draft` / `ready for review`)の develop 集約 landing で、これだけは `feature → develop` を `--no-ff` でエージェントがマージしてよい(PR を作らない)。`main` へのマージは常にユーザーの確認を経る。
- **PR はレビューの単位**: 関係ない差分を1 PR に混ぜない。とくにハーネスとプロダクトコード / Design Doc 本文を混ぜない。一方、論理単位を曲げてまで小さく割らない。
- **ハーネスの変更も Issue + PR**: skill・`scripts/`・`docs/harness/`・design doc のルール・本 CLAUDE.md の更新も、`develop` に直接コミットせず Issue + feature ブランチ + ゲーティング PR で行う(中身の書き方は [docs/harness/editing.md](docs/harness/editing.md))。
- **コミットメッセージ**: 1行目は何をやったかの簡潔なサマリー(英語の命令形、72 文字程度まで)、空行をはさんで本文。

ブランチ運用・コミットのシェル渡し・Issue/PR・Design Doc のブランチ運用とレビュー PR・design doc 実装分割・レビュー対応・同期の詳細手順は [docs/harness/git-and-pr.md](docs/harness/git-and-pr.md)、`gh` の具体的コマンドとヘルパーは `/pr-workflow` skill を参照する。

## エージェント向けスクリプト

再利用スクリプト(skill のフック・ヘルパーを含む)は `scripts/` に **Node.js** で置く。
動作確認用の使い捨てスクリプトはリポジトリに残さない。
判断基準と詳細は [docs/harness/scripts.md](docs/harness/scripts.md)。

## skills

エージェントの skill は `.claude/skills/` 以下に置く(grilling / self-healing / self-improvement / japanese-tech-writing、および design-doc 系・pr-workflow など)。
skill が使う再利用スクリプトは `scripts/` に置き skill 本体から呼び出す(特定 skill 専用のフック等は当該 skill 配下に併置してよい。→ [docs/harness/scripts.md](docs/harness/scripts.md))。
skill の編集は [docs/harness/editing.md](docs/harness/editing.md) に従う。

**学びの記録(standing)**: **ユーザーに是正されたら、または非自明なエラーを調査して解決したら、その場で `.learnings/` に記録する**(是正・洞察は `LEARNINGS.md`、コマンド/API 失敗は `ERRORS.md`、検証付き回復は `HEALS.md`。形式は `self-improvement` / `self-healing` skill)。フックが出す `<self-improvement-reminder>` / `<error-detected>` は促すだけで自動記録しないので、記録は**そのターンの成果物**として扱い「後で」に回さない。恒久ルール化すべき学びは CLAUDE.md や該当 skill へ昇格する(status: promoted)。
