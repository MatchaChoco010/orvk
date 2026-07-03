---
name: self-healing
description: "コーディングエージェントのためのアクティブなランタイム回復: タスクの途中で何かが壊れたら、根本原因を診断し、修正を書き、壊れたものを再実行して検証（VERIFY）し、証拠とともに `HEAL-` エントリを `.learnings/HEALS.md` に記録する。コマンド・テスト・ビルド・lint が失敗したり非ゼロで終了したとき、ツールの不足・依存関係/ロックファイルの不一致・ランタイムバージョンの誤り・venv やパーミッションのエラー・ポート競合・git の汚れた状態・`.env` の欠如が起きたとき、エージェントがまだ存在しないヘルパーや使い捨てスクリプトを必要とするとき、外部 API・ツール・MCP がエラーやレート制限を返したとき、あるいはテストが不安定（flake）なときに、いつでも使用する。まず `Pattern-Key` で `HEALS.md` を検索すること。ほとんどの heal は再発なので、重複させるのではなく `Recurrence-Count` をインクリメントする。検証は必須: サンドボックス環境なら正直に `pending-verify` と記し、修正がどうしても動かないなら `abandoned` とする。`self-improvement`（再発する heal を永続的なメモリへ昇格させる）と組み合わせて使うが、self-improvement にはない「永続化する前に検証する」という規律を担う。"
---

# Self-Healing

コーディングエージェントのためのアクティブなランタイム回復。
何かが壊れたら、ループを回す: **診断 → 修正 → 検証 → 記録**。
隠蔽された失敗ではなく、再利用可能で検証済みの成果物を残す。

この前提は [browser-use/browser-harness](https://github.com/browser-use/browser-harness) を反映している。
*ハーネスは実行のたびに自己改善する* というものだ。
ギャップにぶつかったエージェントは失敗するのではなく、実行中に修正を書き、それが動くことを検証し、将来の実行のために永続的な成果物を記録する。
コーディングタスクにも同じループがふさわしい。

## このスキルの目的

コーディングエージェントがタスクの途中で壁にぶつかったとき、デフォルトの失敗モードは次の通りだ:

1. **取り繕う** — 「別のアプローチを試そう」 — そして回復を失う
2. **修正できたふりをする** — 壊れたものを再実行せずに
3. **症状だけ直す** — テストをスキップし、エラーを握りつぶし、グリーンになるまでリトライする

この3つはいずれも、一度きりの失敗を再発に変えてしまう。
同じプロジェクトに取り組む次のエージェントが、同じ壁にぶつかる。

このスキルは1つの規律を強制する: **永続化する前に検証する**。
失敗した操作を再実行し、それが成功するのを見届けるまで、修正は本物ではない。
成功したら、検証済みの修正を記録し、次の実行が恩恵を受けられるようにする。

## self-improvement との関係

この2つのスキルは意図的に分割されている。
両方を回すこと — 互いを補い合うが、重複はしない。

| 観点        | `self-healing`（このスキル）                                          | `self-improvement`                                            |
| ----------- | -------------------------------------------------------------------- | ------------------------------------------------------------- |
| **いつ**    | 実行中、失敗がライブで起きているとき                                  | 事後、自然な区切りのタイミングで                              |
| **動詞**    | 今すぐ heal する — 動作する状態を復元する                             | 後のために記憶する — 知識を蓄積する                           |
| **成果**    | 検証済みの修正 +（任意で）再利用可能な成果物                          | 記録された学び・修正・要望                                    |
| **検証**    | **必須** — 証拠なしに永続化しない                                     | 不要                                                          |
| **ファイル**| `.learnings/HEALS.md` + `.learnings/heals/<HEAL-ID>/`（遅延生成）     | `.learnings/ERRORS.md`, `LEARNINGS.md`, `FEATURE_REQUESTS.md` |
| **トリガー**| タスク途中で観測された失敗                                            | 修正・知識ギャップ・機能要望・再発                            |

**境界ルール:** 事実・修正・願望を捕捉しているなら、それは `self-improvement`。
ライブな失敗に対して修正を適用し検証しているなら、それは `self-healing`。

## Heal Loop

```
  ● failure observed
  │
  ● 1. DIAGNOSE  capture context — command, error, env, what was attempted
  │              search HEALS.md for the same Pattern-Key first
  │              (most heals are recurrences; don't reinvent)
  │
  ● 2. PATCH     write the fix — script, helper, env tweak, alt command
  │              artifacts → .learnings/heals/<HEAL-ID>/  (only if needed)
  │
  ● 3. VERIFY    re-run the failing op — must succeed
  │              ↻ if still failing: refine and retry, cap at 3 attempts
  │              ✗ if uncrackable: file Status: abandoned with notes
  │
  ● 4. FILE      write HEAL-YYYYMMDD-XXX to .learnings/HEALS.md
  │              with Pattern-Key, status, verification proof
  │
  ✓ working state restored, heal persisted

  (conditional) PROMOTE  if Pattern-Key recurrence ≥ 3 across distinct tasks,
                          append a Handoff block → self-improvement promotes to memory
```

ループの途中で heal を断念する場合、成功したふりをしてはいけない。
`Status: abandoned` とした `HEAL-` エントリを、何がうまくいかなかったかのメモとともに記録する。
次のエージェントは行き止まりからも学ぶ。

## トリガーするタイミング

self-healing は **実行中のアクティブな失敗** で発火する — エージェントが何かが動作していないことをたった今観測し、続行するためにそれを動作させる必要がある状況だ。
次の5つの形がある:

### 1. ツールの失敗（コマンド / テスト / ビルド / lint）
何らかの呼び出しが非ゼロで終了するか、誤った出力を生成する。それを認識してそのままリトライするのではなく、診断し、修正し、検証する。

*例:* `pnpm-lock.yaml` が存在するのに `npm install` がエラーになる（ツールを切り替える）。
`pytest` が `ModuleNotFoundError` で失敗する（venv をアクティブにする）。
`tsc` が古い型を指摘する（クライアントを再生成する）。
`eslint` が設定エラーを報告する（不足しているパーサーをインストールする）。

### 2. 機能の不足 / ツールのギャップ
エージェントがまだ存在しないもの — スクリプト、ヘルパー、ラッパー、グルー関数 — を必要とする。その場で書く。これは browser-harness の `agent_helpers.py` に最も近いアナロジーだ。

*例:* カスタムキーで CSV を重複排除する（小さな Python ヘルパーを書く）。
12 個のマイクロサービスを同じ手順でブートストラップする（`scripts/bootstrap-all.sh` を書く）。
パターンに一致するブランチを一括リネームする（`gh` ベースのシェルヘルパーを書く）。

### 3. 環境の問題
ローカル環境がプロジェクトの想定と異なる。検出し、修正し、検証する。

*例:* ランタイムバージョンの不一致（`nvm use`, `pyenv local`, `rustup override`）。
ブランチ切り替え後の古い依存キャッシュ。
チェックアウトを妨げる汚れた git の状態。
`.env` の欠如（`.env.example` からコピーし、不足箇所を明らかにする）。

### 4. 外部サービス / API の変更
エージェントが依存するサービスが、予期しないものを返す。回避策を見つけて捕捉する。

*例:* スキーマが変わって MCP ツールが `InputValidationError` を返す（呼び出しの形を修正する）。
公開 API がレート制限に達する（バックオフ、エンドポイント切り替え、バッチ化）。
上流のライブラリがデフォルトを変更してスクリプトを壊した（バージョンを固定する）。

### 5. 同じ壊れたアプローチを繰り返そうとしている
エージェントが、失敗したステップをやり直そうとしている自分に気づく。その自己認識は heal が形になりつつある証拠だ — 代替アプローチを修正として捕捉する。

### 注意すべき検出シグナル

- 非ゼロの終了コード
- ツール出力中のスタックトレース
- 同じ操作が同じエラーで2回失敗する
- 「別のアプローチを試そう」 — それを heal として捕捉する
- `command not found` / `module not found` / `permission denied`
- 以前はなかった古いアサーション、スナップショットの不一致、型エラー
- 論理バグではなく環境的なバグを示唆する「変な」出力

## HEAL エントリのフォーマット

`.learnings/HEALS.md` に追記する（なければ作成する）:

```markdown
## [HEAL-YYYYMMDD-XXX] short_kebab_name

**Logged**: ISO-8601 タイムスタンプ
**Status**: verified | pending-verify | abandoned
**Trigger**: tool-failure | missing-capability | env-issue | external-change | <free-form>
**Active-Context**: （任意）— 現在のスキル、タスクフェーズ、ワークフローの段階。該当しなければ省略
**Area**: 自由記述のタグ — システムのどの部分か（`build`, `tests`, `ci`, `auth`, `data-pipeline`, `mobile`, ...）
**Priority**: low | medium | high | critical

### 失敗
何が壊れたか — 具体的に: コマンド、エラーメッセージ、ブロックされた操作。終了コードとエラー行は逐語的に含める。

### 診断
調査の結果として理解した根本原因。なぜ明白なアプローチではうまくいかなかったか。推測ではなく、heal の最中に実際に検証した内容。

### 修正
適用したパッチ。逐語的なコマンド、コード片、または `.learnings/heals/<HEAL-ID>/` 配下のファイルへのポインタ。最小限に — 再現できる分だけ。

### 検証
修正後に何を実行し、何が返ってきたか。終了コード、出力の抜粋、テストの合格数。**これが証拠である。** これがなければエントリは `pending-verify` か `abandoned`。

### 成果物
（生成ファイルがなければこのセクションを省略。あれば `.learnings/heals/<HEAL-ID>/` 配下の相対パスを列挙）

### メタデータ
- Related Files: path/to/file.ext
- See Also: HEAL-... | LRN-... | ERR-...（関連エントリ）
- Pattern-Key: 再発検出用の lower.snake.case キー（例: `env.lockfile_mismatch`）
- Recurrence-Count: 1
- First-Seen / Last-Seen: YYYY-MM-DD

---
```

### 各フィールドのガイダンス

- **Status** — `verified` = 検証ステップが通った。`pending-verify` = 修正は適用したが完全には証明できなかった（サンドボックス/オフライン/CI 専用） — ユーザーに明示する。`abandoned` = 修正が動かなかった、または診断が誤っていた — 試したことを記録する。
- **Trigger** — 自由記述でよい。列挙された値はよくある形だが、重要なのは失敗の形が将来のエージェントが照合できる程度に記述されていることだ。
- **Active-Context** — 任意。環境に意味のある「何をしていたか」タグ（アクティブなスキル、現在のタスクフェーズ、ビルドステージ、エージェントの役割）があれば使う。該当しなければ省略する。browser-harness 上のアナロジーは `domain-skills/<site>/` のドメインごとのスコープだ。
- **Area** — 自由記述。将来のエージェントがこれを見つけやすくなるものを選ぶ。`frontend`, `data-pipeline`, `ci`, `auth`, `terraform`, `mobile`, `embedded` — プロジェクトの形に合うものなら何でもよい。
- **Pattern-Key** — lower.snake.case、安定的で、プロジェクト間で再利用可能なもの。同じキーを持つ2つの heal は再発だ。`env.lockfile_mismatch` は良く、`fixed_thing_tuesday` はダメだ。

## ID の生成

フォーマット: `HEAL-YYYYMMDD-XXX`。
`XXX` は連番の3桁、または3文字のランダムな英数字。
例: `HEAL-20260524-001`, `HEAL-20260524-A7B`。

## 成果物ディレクトリ（遅延生成）

heal が保存に値する何かを生成したときにのみ `.learnings/heals/<HEAL-ID>/` を作成する。
1行の修正にフォルダは不要 — HEAL エントリのテキストで十分だ。
修正を適用しなかった abandoned な heal もフォルダをスキップする。

```
.learnings/
├── HEALS.md
├── ERRORS.md / LEARNINGS.md / FEATURE_REQUESTS.md  (self-improvement)
└── heals/
    └── HEAL-20260524-001/
        ├── helper.sh
        ├── patch.diff
        └── notes.md
```

**ここに置くもの:** 生成したスクリプト/ヘルパー、パッチファイル、補足メモ、診断を裏付ける出力キャプチャ。
**ここに置かないもの:** プロジェクトのソース変更（それらはプロジェクトツリーに置き、Related Files で参照する）。
秘密情報。
HEAL テキストに既に記録した出力。

## 検証ルール

検証は耐力壁だ。
self-healing が self-improvement と異なる核心は、修正が *証明される* ことであり、理屈で済ませないことだ。

### 何が証拠になるか

| 失敗の形                              | 検証                                                              |
| ------------------------------------- | ----------------------------------------------------------------- |
| ツール / コマンド / テスト / ビルド / lint | 元の呼び出しを再実行する。exit 0 / pass を期待する                |
| 機能の不足                            | 実際の入力でヘルパーをエンドツーエンドに実行する。意図通りを期待する |
| 環境のドリフト                        | 診断のきっかけとなった操作を再実行する                            |
| 外部サービスの回避策                  | 修正を当てて失敗した呼び出しを再実行する。使える応答を期待する     |

### サンドボックス / オフライン / CI 専用の失敗

検証ステップを本当に実行できないとき（ネットワークなし、実リモートなし、サンドボックス化されたシェル、CI でしか再現できない）、`Status: pending-verify` で次を記録する:

- ユーザー / CI が実行すべき正確なコマンド
- 受け入れ基準 — 何が証拠となるか
- 構築できるなら模擬的な証拠（例: ドライランモード、失敗する呼び出しのスタブ、サンドボックススクリプト）

`pending-verify` は正直だ。
`verified` を偽装することこそ、このスキルが防ごうとしている失敗モードだ。

### 証明スクリプトに投資すべきとき

ほとんどの heal に別個の証明スクリプトは不要だ — 検証ステップは単に失敗したものを再実行するだけだ。
きちんとした証明スクリプトを作るのは次の場合だ:

- heal が、複数のケースで実行する必要のある再利用可能なヘルパーを生成する
- 失敗をライブで再現できないが、サンドボックス（クリーンな git リポジトリ、モックサービス、偽の入力）で再現できる
- heal が複数プロジェクトで再適用されると見込まれる — そのとき証明スクリプトはリグレッションチェックを兼ねる

### 検証が失敗したら

1. **1回目** — 修正を改善してリトライする。最初の診断はしばしば誤っている。
2. **2回目** — 一歩引いて診断を再考する。根本原因は別の場所にあるかもしれない。
3. **3回目** — 止める。試したことのメモとともに `Status: abandoned` を記録する。ユーザーに明示する。やみくもに足掻かない。

### 検証として認められないもの

- 「正しそう」/「これで動くはず」
- 元々失敗した *別の* コマンドを再実行する
- 失敗を抑制する（`|| true`, `--ignore-errors`） — それは隠蔽だ
- 失敗するテストをスキップまたは削除する — それはリグレッションだ
- 修正前からキャッシュが温まっていたために通った

### 可逆性

可逆な修正を優先する。
heal がプロジェクトファイルを変更するなら、`patch.diff` に diff を記録する。
heal が破壊的（生成ファイルを削除する、ロックを書き換える）なら、それを明示的に記す — HEAL を読む将来のエージェントは、何が破壊されたかを知る必要がある。

## 再発と昇格

ほとんどの heal は再発だ。
新しい HEAL を記録する前に検索する:

```bash
grep -n "Pattern-Key: <your-pattern-key>" .learnings/HEALS.md
```

見つかったら:

- `Recurrence-Count` をインクリメントする
- `Last-Seen` を更新する
- 今回の発生を See Also リンクとして追加する
- 重複エントリを **作らない**

### 昇格の閾値

次の **すべて** が真のとき、既存エントリに `Handoff` ブロックを追加する:

- `Recurrence-Count >= 3`
- 少なくとも2つの異なるタスクで観測された
- 30日のウィンドウ内（`self-improvement` およびアグリゲーターの昇格ルールと一致する）
- 修正が一般化可能（メモリファイルに既にあるようなプロジェクト固有のものでない）

```markdown
### Handoff
- **Promoted To**: self-improvement at YYYY-MM-DD
- **Promotion Target**: CLAUDE.md | AGENTS.md | .github/copilot-instructions.md | new-skill
- **Distilled Rule**: heal から導いた一行の予防ガイダンス
```

その後、`self-improvement`（または学習アグリゲーター）が引き継ぐ: ルールを蒸留し、適切なコンテキストファイルに書き込むか、再利用可能なスキルを抽出する。
HEAL はトレーサビリティのために残る。

## アンチパターン

1. **検証せずに記録する。** 修正が証明される前に記録された HEAL は、これをノイズの多い self-improvement に変えてしまう。検証が通っていないなら、エントリは `pending-verify` または `abandoned` だ。
2. **原因ではなく症状を heal する。** 失敗するテストはスキップ（`pytest.skip`, `it.skip`, `xit`）では heal されない。不安定な CI は `--retry` では heal されない。根本原因を見つける。見つけられないなら正直に abandon する。
3. **既存のものを先に試さずに新しい修正を生成する。** Pattern-Key で `HEALS.md` を検索する。ほとんどの heal は再発だ。
4. **プロジェクトに既にあるのにヘルパーを発明する。** まず `scripts/`, `Makefile`, `justfile`, `package.json`, `pyproject.toml` を見る。heal とは、無いものを書くことであって、有るものを書くことではない。
5. **スコープクリープ。** heal は1つの失敗にスコープされる。クリーンアップは品質パスに属し、リファクタは機能だ。スコープクリープは heal をレビュー不能にする。
6. **空の成果物フォルダ。** 中身が何も入らないなら `.learnings/heals/<HEAL-ID>/` を作らない。

## ベストプラクティス

1. **積極的に heal し、常に記録する。** abandoned な heal でさえ、何がうまくいかないかを次のエージェントに教える。
2. **永続化する前に検証する。** 譲れないルール。
3. **最小かつ可逆な修正。** 3行の修正は heal だが、300行のリファクタは機能だ。
4. **安定した Pattern-Key。** `env.node_version_mismatch` は再利用可能だが、`fixed_the_thing_on_tuesday` はそうではない。
5. **複製せず参照する。** 関連する HEAL/LRN/ERR を See Also でクロスリンクする。
6. **再発を引き継ぐ。** 3回見られた heal は、プロジェクトの恒久メモリに入れる価値がある。
7. **メインツリーを heal 成果物に依存させない。** `.learnings/heals/` 配下のファイルは参照資料だ。スクリプトが耐力的になったら `scripts/` に昇格させる。

## セットアップ

```bash
mkdir -p .learnings        # heals/ is lazy — created only when artifacts exist
touch .learnings/HEALS.md
```

Gitignore の選択は `self-improvement` と一致する。
heal をローカルに保つ（`.gitignore` に `.learnings/`）か、チームの知識として共有する（gitignore しない — レビュー可能な永続コンテキストになる）かを選ぶ。

## フック統合

コマンド失敗時の自動トリガーは任意であり、エージェント固有だ。
Claude Code / Codex の設定については [`references/hooks.md`](references/hooks.md) を参照。

## マルチエージェント利用

このスキルはエージェント非依存だ。
`.learnings/HEALS.md` のフォーマットはプレーンな markdown であり、どのエージェント（Claude Code, Codex CLI, Copilot, Cursor, Aider, ...）も読み書きできる。
フックをサポートしないエージェントは、その指示ファイル（例: `.github/copilot-instructions.md`）でリマインドできる。
例については [`references/hooks.md`](references/hooks.md) を参照。

## パイプライン統合

self-healing がより大きなスキルパイプラインにどう組み込まれるか（上流での過去 heal のサーフェス、下流での再発の昇格、機械検証ゲートを含む）は [`references/pipeline-integration.md`](references/pipeline-integration.md) に記載されている。
このスキルを使うのに必須ではない — 単独で成立する。

## 関連項目

- [`references/examples.md`](references/examples.md) — 標準的な HEAL エントリの形（コマンド失敗、機能の不足、環境ドリフト、外部 API の回避策、abandoned な heal）
- [`references/interop-with-self-improvement.md`](references/interop-with-self-improvement.md) — 2つのスキル間の決定テーブルとハンドオフペイロード
- [`references/pipeline-integration.md`](references/pipeline-integration.md) — より大きなパイプラインにおいて self-healing が上流/下流スキルとどう関係するか
- [`references/hooks.md`](references/hooks.md) — Claude Code / Codex 向けの自動トリガー設定
