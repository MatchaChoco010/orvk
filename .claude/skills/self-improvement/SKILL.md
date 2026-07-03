---
name: self-improvement
description: "学び・エラー・修正・機能要望を記録し、継続的な改善を可能にするスキル。次の場合に使用する: (1) ユーザーがClaudeを訂正したとき（「No, that's wrong...」（「いや、それは違う」）、「Actually...」（「実は…」）など）、(2) ユーザーが存在しない機能を要望したとき、(3) Claudeが自分の知識が古いまたは誤っていることに気づいたとき、(4) 繰り返し発生するタスクに対してより良いアプローチが見つかったとき、(5) self-healingからのHandoffブロック（Recurrence-Count >= 3 で検証済みのヒールが繰り返し発生）を受け取り、それをメモリファイルや新しいスキルに蒸留するとき。タスク途中でエージェントが修正を適用・検証する必要のあるアクティブなランタイム障害には、代わりに `self-healing` を使用する（こちらは証跡付きでHEAL-エントリを記録し、self-improvementは蓄積されたパターンを昇格させる）。大きなタスクの前に学びをレビューする際にも使用する。CIのみ／ヘッドレス環境での学びの記録には self-improvement-ci を使用する。"
---

# Self-Improvement Skill

## Install

```bash
gh skill install pskoett/pskoett-skills self-improvement
```

CIのみで実行する場合は次を使用する:

```bash
gh skill install pskoett/pskoett-skills self-improvement-ci
```

Agent Skills CLI を使ったフォールバック:

```bash
npx skills add pskoett/pskoett-skills/skills/self-improvement
npx skills add pskoett/pskoett-skills/skills/self-improvement-ci
```

学びやエラーをmarkdownファイルに記録し、継続的な改善につなげる。
コーディングエージェントはあとからこれらを処理して修正に変換でき、重要な学びはプロジェクトメモリへ昇格される。

**`self-healing` スキルと組み合わせて使う:** self-healing はアクティブなランタイム復旧のプリミティブであり、タスク途中で何かが壊れたときに診断・パッチ適用・検証を行い、`HEAL-` エントリを `.learnings/HEALS.md` に記録する。
Self-improvement（このスキル）は受動的な蓄積と昇格のレイヤーであり、修正・知識のギャップ・機能要望を記録し、繰り返し発生するヒールのハンドオフを恒久的なメモリへ昇格させる。
両者は `.learnings/` を共有するが、書き込むファイルは異なる。
検証の規律は self-healing 側に、昇格のロジックはこちら側に存在する。

## Quick Reference

| 状況 | アクション |
|-----------|--------|
| タスク途中のアクティブな障害 — エージェントが今すぐ修正する必要がある | **代わりに `self-healing` を使う**（検証済みのHEAL- を `.learnings/HEALS.md` に記録） |
| 過去にコマンド／操作が失敗した（現在ヒール中ではない） | `.learnings/ERRORS.md` に記録 |
| ユーザーがあなたを訂正した | category `correction` で `.learnings/LEARNINGS.md` に記録 |
| ユーザーが欠けている機能を望んでいる | `.learnings/FEATURE_REQUESTS.md` に記録 |
| API／外部ツールが失敗した | 連携の詳細とともに `.learnings/ERRORS.md` に記録 |
| self-healing の Handoff ブロックが昇格ルールを満たす（下記 Promotion Rule 参照） | Distilled Rule を `CLAUDE.md` / `AGENTS.md` / 新しいスキルへ昇格 |
| 知識が古かった | category `knowledge_gap` で `.learnings/LEARNINGS.md` に記録 |
| より良いアプローチが見つかった | category `best_practice` で `.learnings/LEARNINGS.md` に記録 |
| 繰り返し発生するパターンを Simplify/Harden する | `Source: simplify-and-harden` と安定した `Pattern-Key` を付けて `.learnings/LEARNINGS.md` を記録／更新 |
| 既存エントリと類似 | `**See Also**` でリンクし、優先度の引き上げを検討 |
| 広く適用できる学び | `CLAUDE.md`、`AGENTS.md`、`.github/copilot-instructions.md` へ昇格 |

## Setup

プロジェクトルートに `.learnings/` ディレクトリが存在しなければ作成する:

```bash
mkdir -p .learnings
```

`assets/` からファイルテンプレート（`LEARNINGS.md`, `ERRORS.md`, `FEATURE_REQUESTS.md`）をコピーするか、ヘッダー付きでファイルを作成する。

## Logging Format

### Learning Entry

`.learnings/LEARNINGS.md` に追記する:

```markdown
## [LRN-YYYYMMDD-XXX] category

**Logged**: ISO-8601 タイムスタンプ
**Priority**: low | medium | high | critical
**Status**: pending
**Area**: frontend | backend | infra | tests | docs | config

### 概要
何を学んだかを一行で説明する

### 詳細
完全な背景: 何が起きたか、何が誤りだったか、正しくは何か

### 推奨アクション
具体的な修正・改善案

### メタデータ
- Source: conversation | error | user_feedback
- Related Files: path/to/file.ext
- Tags: tag1, tag2
- See Also: LRN-20250110-001（既存エントリと関連する場合）
- Pattern-Key: simplify.dead_code | harden.input_validation（任意。再発パターン追跡用）
- Recurrence-Count: 1（任意）
- First-Seen: 2025-01-15（任意）
- Last-Seen: 2025-01-15（任意）

---
```

### Error Entry

`.learnings/ERRORS.md` に追記する:

````markdown
## [ERR-YYYYMMDD-XXX] skill_or_command_name

**Logged**: ISO-8601 タイムスタンプ
**Priority**: high
**Status**: pending
**Area**: frontend | backend | infra | tests | docs | config

### 概要
何が失敗したかの簡潔な説明

### エラー
```
実際のエラーメッセージまたは出力
```

### コンテキスト
- 試みたコマンド・操作
- 使用した入力やパラメータ
- 関連する場合は環境の詳細

### 修正案
特定できる場合、何が解決につながりそうか

### メタデータ
- Reproducible: yes | no | unknown
- Related Files: path/to/file.ext
- See Also: ERR-20250110-001（再発する場合）

---
````

### Feature Request Entry

`.learnings/FEATURE_REQUESTS.md` に追記する:

```markdown
## [FEAT-YYYYMMDD-XXX] capability_name

**Logged**: ISO-8601 timestamp
**Priority**: medium
**Status**: pending
**Area**: frontend | backend | infra | tests | docs | config

### 要望された機能
ユーザーが何をしたかったか

### ユーザーの背景
なぜ必要としたか、どんな問題を解決しようとしているか

### 複雑度の見積もり
simple | medium | complex

### 実装案
どう実装できそうか、何を拡張する形になりそうか

### メタデータ
- Frequency: first_time | recurring
- Related Features: existing_feature_name

---
```

## ID Generation

形式: `TYPE-YYYYMMDD-XXX`
- TYPE: `LRN`（learning）、`ERR`（error）、`FEAT`（feature）
- YYYYMMDD: 現在の日付
- XXX: 連番またはランダムな3文字（例: `001`, `A7B`）

例: `LRN-20250115-001`, `ERR-20250115-A3F`, `FEAT-20250115-002`

## Resolving Entries

問題が修正されたら、エントリを更新する:

1. `**Status**: pending` → `**Status**: resolved` に変更
2. Metadata の後に解決ブロックを追加:

```markdown
### 解決
- **Resolved**: 2025-01-16T09:00:00Z
- **Commit/PR**: abc123 or #42
- **Notes**: 実施内容の簡潔な説明
```

その他の status 値:
- `in_progress` - 現在対応作業中
- `wont_fix` - 対応しないと判断（理由を Resolution notes に記載）
- `promoted` - CLAUDE.md、AGENTS.md、または .github/copilot-instructions.md へ昇格済み
- `promoted_to_skill` - 再利用可能なスキルとして抽出（Automatic Skill Extraction 参照）

## Promoting to Project Memory

学びが広く適用できる（一度限りの修正でない）場合は、恒久的なプロジェクトメモリへ昇格する。

### When to Promote

- 学びが複数のファイル／機能にまたがって適用できる
- 貢献者（人間でもAIでも）が知っておくべき知識
- 繰り返しのミスを防ぐ
- プロジェクト固有の慣習を文書化する

### Promotion Targets

| ターゲット | 何が属するか |
|--------|-------------------|
| `CLAUDE.md` | プロジェクトの事実、慣習、すべてのClaudeとのやり取りに関わる落とし穴 |
| `AGENTS.md` | エージェント固有のワークフロー、ツール利用パターン、自動化ルール |
| `.github/copilot-instructions.md` | GitHub Copilot 向けのプロジェクト文脈と慣習 |

### How to Promote

1. 学びを簡潔なルールや事実に**蒸留する**
2. ターゲットファイルの適切なセクションに**追加する**（必要ならファイルを作成）
3. 元のエントリを**更新する**:
   - `**Status**: pending` → `**Status**: promoted` に変更
   - `**Promoted**: CLAUDE.md`、`AGENTS.md`、または `.github/copilot-instructions.md` を追加

### Promotion Examples

**学び**（冗長）:> プロジェクトは pnpm workspaces を使用している。
`npm install` を試したが失敗した。
> ロックファイルは `pnpm-lock.yaml`。
`pnpm install` を使わなければならない。

**CLAUDE.md 内**（簡潔）:
```markdown
## Build & Dependencies
- Package manager: pnpm (not npm) - use `pnpm install`
```

**学び**（冗長）:> APIエンドポイントを変更するときは、TypeScriptクライアントを再生成しなければならない。
> これを忘れると実行時に型の不一致が起きる。

**AGENTS.md 内**（実行可能）:
```markdown
## After API Changes
1. Regenerate client: `pnpm run generate:api`
2. Check for type errors: `pnpm tsc --noEmit`
```

## Recurring Pattern Detection

既存エントリと類似したものを記録する場合:

1. **まず検索する**: `grep -r "keyword" .learnings/`
2. **エントリをリンクする**: Metadata に `**See Also**: ERR-20250110-001` を追加
3. 問題が繰り返し発生するなら**優先度を引き上げる**
4. **システム的な修正を検討する**: 繰り返し発生する問題はしばしば次を示す:
   - ドキュメント不足（→ CLAUDE.md または .github/copilot-instructions.md へ昇格）
   - 自動化不足（→ AGENTS.md に追加）
   - アーキテクチャ上の問題（→ 技術的負債のチケットを作成）

## Simplify & Harden Feed

このワークフローを使って `simplify-and-harden` スキルから繰り返し発生するパターンを取り込み、永続的なプロンプトガイダンスに変換する。

### Ingestion Workflow

1. タスクサマリーから `simplify_and_harden.learning_loop.candidates` を読む。
2. 各候補について、`pattern_key` を安定した重複排除キーとして使う。
3. `.learnings/LEARNINGS.md` でそのキーを持つ既存エントリを検索する:
   - `grep -n "Pattern-Key: <pattern_key>" .learnings/LEARNINGS.md`
4. 見つかった場合:
   - `Recurrence-Count` をインクリメントする
   - `Last-Seen` を更新する
   - 関連するエントリ／タスクへの `See Also` リンクを追加する
5. 見つからなかった場合:
   - 新しい `LRN-...` エントリを作成する
   - `Source: simplify-and-harden` を設定する
   - `Pattern-Key`、`Recurrence-Count: 1`、`First-Seen`/`Last-Seen` を設定する

### Promotion Rule (System Prompt Feedback)

次のすべてが真のとき、繰り返し発生するパターンをエージェントのコンテキスト／システムプロンプトファイルへ昇格する:

- `Recurrence-Count >= 3`
- 少なくとも2つの異なるタスクにまたがって観測された
- 30日間のウィンドウ内で発生した

昇格先:
- `CLAUDE.md`
- `AGENTS.md`
- `.github/copilot-instructions.md`

この3条件ルールが、このスキルにおける唯一の昇格しきい値である。
self-healing の Handoff ブロックに関する Quick Reference の行も、アグリゲータースキル（`learning-aggregator`, `learning-aggregator-ci`）も、すべてこの同じルールを使う。

昇格したルールは、長いインシデントの記録ではなく、短い予防ルール（コーディング前／コーディング中に何をすべきか）として書く。

## Periodic Review

自然な区切りで `.learnings/` をレビューする:

### When to Review
- 新しい大きなタスクを始める前
- 機能を完成させた後
- 過去の学びがある領域で作業するとき
- アクティブな開発期間中は週次で

### Quick Status Check
```bash
# Count pending items
grep -h "Status\*\*: pending" .learnings/*.md | wc -l

# List pending high-priority items
grep -B5 "Priority\*\*: high" .learnings/*.md | grep "^## \["

# Find learnings for a specific area
grep -l "Area\*\*: backend" .learnings/*.md
```

### Review Actions
- 修正済みの項目を解決する
- 適用可能な学びを昇格する
- 関連エントリをリンクする
- 繰り返し発生する問題をエスカレーションする

## Detection Triggers

次に気づいたら自動的に記録する:

**修正**（→ category `correction` の学び）:
- "No, that's not right..."（「いや、それは違う」）
- "Actually, it should be..."（「実は、こうあるべきだ」）
- "You're wrong about..."（「…について間違っている」）
- "That's outdated..."（「それは古い」）

**機能要望**（→ feature request）:
- "Can you also..."（「…もできる？」）
- "I wish you could..."（「…できたらいいのに」）
- "Is there a way to..."（「…する方法はある？」）
- "Why can't you..."（「なぜ…できないの？」）

**知識のギャップ**（→ category `knowledge_gap` の学び）:
- ユーザーがあなたの知らなかった情報を提供した
- 参照したドキュメントが古い
- APIの挙動があなたの理解と異なる

**エラー**（→ error エントリ）:
- コマンドが非ゼロの終了コードを返した
- 例外またはスタックトレース
- 予期しない出力や挙動
- タイムアウトまたは接続失敗

## Priority Guidelines

| 優先度 | 使うとき |
|----------|-------------|
| `critical` | コア機能をブロックする、データ損失リスク、セキュリティ問題 |
| `high` | 影響が大きい、よく使うワークフローに影響、繰り返し発生する問題 |
| `medium` | 影響は中程度、回避策がある |
| `low` | 軽微な不便、エッジケース、あれば嬉しい程度 |

## Area Tags

コードベースの領域で学びをフィルタするために使う:

| Area | 範囲 |
|------|-------|
| `frontend` | UI、コンポーネント、クライアントサイドコード |
| `backend` | API、サービス、サーバーサイドコード |
| `infra` | CI/CD、デプロイ、Docker、クラウド |
| `tests` | テストファイル、テストユーティリティ、カバレッジ |
| `docs` | ドキュメント、コメント、README |
| `config` | 設定ファイル、環境、設定 |

## Best Practices

1. **すぐに記録する** - 問題の直後がもっとも文脈が新鮮
2. **具体的に書く** - 将来のエージェントが素早く理解できるように
3. **再現手順を含める** - 特にエラーについては
4. **関連ファイルをリンクする** - 修正が容易になる
5. **具体的な修正を提案する** - 単なる「調査する」ではなく
6. **一貫したカテゴリを使う** - フィルタが可能になる
7. **積極的に昇格する** - 迷ったら CLAUDE.md または .github/copilot-instructions.md に追加
8. **定期的にレビューする** - 古びた学びは価値を失う

## Gitignore Options

**学びをローカルに留める**（開発者ごと）:
```gitignore
.learnings/
```

**学びをリポジトリで管理する**（チーム全体）:.gitignore に追加しない - 学びが共有知識になる。

**ハイブリッド**（テンプレートは追跡、エントリは無視）:
```gitignore
.learnings/*.md
!.learnings/.gitkeep
```

## Hook Integration

エージェントフックを通じて自動リマインダーを有効にする。
これは**オプトイン**であり、明示的にフックを設定する必要がある。
同じ2つのスクリプトが Claude Code と Codex CLI の両方で動作する（どちらも stdin に JSON を渡し、同じ `additionalContext` の出力形式を受け付ける）。
Copilot のフックはログは取れるがコンテキストの注入はできないため、Copilot は instructions-file チャネルを使う。
Codex と Copilot を含むエージェントごとの完全なセットアップは `references/hooks-setup.md` を参照。

### Quick Setup (Claude Code)

プロジェクトに `.claude/settings.json` を作成する。
コマンドパスは、スキルが実際にインストールされている場所を指す必要がある: `gh skill install` / `npx skills add` では `.claude/skills/self-improvement/`、このリポジトリがプロジェクトにベンダリングされている場合は `skills/self-improvement/`。
相対パスはプロジェクトルートから解決される。

```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "hooks": [{
        "type": "command",
        "command": "node \"${CLAUDE_PROJECT_DIR}/.claude/skills/self-improvement/scripts/activator.mjs\""
      }]
    }]
  }
}
```

これは各プロンプトの後に学び評価のリマインダーを注入する（オーバーヘッドは約50〜100トークン）。

### Full Setup (With Error Detection)

```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "hooks": [{
        "type": "command",
        "command": "node \"${CLAUDE_PROJECT_DIR}/.claude/skills/self-improvement/scripts/activator.mjs\""
      }]
    }],
    "PostToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "command",
        "command": "node \"${CLAUDE_PROJECT_DIR}/.claude/skills/self-improvement/scripts/error-detector.mjs\""
      }]
    }]
  }
}
```

フックはイベントのペイロードを stdin 上の JSON として受け取る。
エラー検出器はその JSON から `tool_response` をパースし、リマインダーを `additionalContext` の JSON 出力として返す。
これは PostToolUse の出力をモデルに届けるために必須である。

### Available Hook Scripts

| スクリプト | フックタイプ | 目的 |
|--------|-----------|---------|
| `scripts/activator.mjs` | UserPromptSubmit (Claude Code, Codex) | タスク後に学びを評価するよう促す（このイベントでは両エージェントとも素のstdoutがコンテキストに追加される） |
| `scripts/error-detector.mjs` | PostToolUse (Claude Code, Codex), postToolUse (Copilot, ログのみ) | 3つすべてのエージェントのペイロード形式についてstdinのJSONペイロードからエラーパターンをパースし、`additionalContext` のリマインダーを発行する |

詳細な設定とトラブルシューティングは `references/hooks-setup.md` を参照。

## Automatic Skill Extraction

学びが再利用可能なスキルにするだけの価値があるとき、提供されているヘルパーを使って抽出する。

### Skill Extraction Criteria

次のいずれかに該当する場合、学びはスキル抽出の対象になる:

| 基準 | 説明 |
|-----------|-------------|
| **Recurring** | 2件以上の類似する問題への `See Also` リンクがある |
| **Verified** | Status が `resolved` で、動作する修正がある |
| **Non-obvious** | 発見するために実際のデバッグ／調査が必要だった |
| **Broadly applicable** | プロジェクト固有でなく、コードベースをまたいで有用 |
| **User-flagged** | ユーザーが「これをスキルとして保存して」などと言う |

### Extraction Workflow

1. **候補を特定する**: 学びが抽出基準を満たす
2. **ヘルパーを実行する**（または手動で作成する）:
   ```bash
   node ./skills/self-improvement/scripts/extract-skill.mjs skill-name --dry-run
   node ./skills/self-improvement/scripts/extract-skill.mjs skill-name
   ```
3. **SKILL.md をカスタマイズする**: テンプレートに学びの内容を埋める
4. **学びを更新する**: status を `promoted_to_skill` にし、`Skill-Path` を追加する
5. **検証する**: 新しいセッションでスキルを読み、自己完結していることを確認する

### Manual Extraction

手動作成を好む場合:

1. `skills/<skill-name>/SKILL.md` を作成する
2. `assets/SKILL-TEMPLATE.md` のテンプレートを使う
3. [Agent Skills spec](https://agentskills.io/specification) に従う:
   - `name` と `description` を持つ YAML フロントマター
   - Name はフォルダ名と一致させる
   - スキルフォルダ内に README.md を置かない

### Extraction Detection Triggers

学びがスキルになるべき次のシグナルに注意する:

**会話の中で:**
- "Save this as a skill"（「これをスキルとして保存して」）
- "I keep running into this"（「これに何度もぶつかる」）
- "This would be useful for other projects"（「これは他のプロジェクトでも役立つ」）
- "Remember this pattern"（「このパターンを覚えておいて」）

**学びのエントリの中で:**
- 複数の `See Also` リンク（繰り返し発生する問題）
- 高優先度 + resolved ステータス
- Category: 広く適用できる `best_practice`
- 解決策を称賛するユーザーフィードバック

### Skill Quality Gates

抽出前に検証する:

- [ ] 解決策がテスト済みで動作する
- [ ] 元の文脈なしでも説明が明確である
- [ ] コード例が自己完結している
- [ ] プロジェクト固有のハードコード値がない
- [ ] スキル命名規則に従う（小文字、ハイフン）

## Multi-Agent Support

このスキルはエージェント固有の有効化方法とともに、さまざまなAIコーディングエージェントで動作する。

### Claude Code

**有効化**: フック（UserPromptSubmit, PostToolUse）**セットアップ**: フック設定付きの `.claude/settings.json`**検出**: フックスクリプトによる自動

### Codex CLI

**有効化**: フック（`UserPromptSubmit`, `PostToolUse`） — 実験的、`config.toml` の `codex_hooks = true` の背後にある**セットアップ**: `<repo>/.codex/hooks.json` または `~/.codex/hooks.json`。
Claude Code と同じスクリプト、同じペイロード／出力形式**検出**: フックスクリプトによる自動。
設定は `references/hooks-setup.md` を参照**フォールバック**: フックが使えない場合は self-improvement のガイダンスを `AGENTS.md` に追加する

### GitHub Copilot

**有効化**: instructions ファイル（Copilot のフックは `.github/hooks/*.json` に存在するが、その出力はプロンプト／ツールイベントでは無視される — ログは取れるがコンテキストの注入はできない）**セットアップ**: `.github/copilot-instructions.md` に追加:

```markdown
## Self-Improvement

After solving non-obvious issues, consider logging to `.learnings/`:
1. Use format from self-improvement skill
2. Link related entries with See Also
3. Promote high-value learnings to skills

Ask in chat: "Should I log this as a learning?"
```

**検出**: セッション終了時の手動レビュー

### Agent-Agnostic Guidance

どのエージェントであっても、次のときに self-improvement を適用する:

1. **自明でないことを発見した** - 解決策がすぐには出なかった
2. **自分を訂正した** - 最初のアプローチが間違っていた
3. **プロジェクトの慣習を学んだ** - 文書化されていないパターンを発見した
4. **予期しないエラーにぶつかった** - 特に診断が難しかった場合
5. **より良いアプローチを見つけた** - 元の解決策を改善した

### Copilot Chat Integration

Copilot ユーザー向けに、関連する場合はプロンプトに次を追加する:

> このタスクを完了したら、self-improvement スキルの形式で `.learnings/` に記録すべき学びがあるか評価する。

または、簡単なプロンプトを使う:
- "Log this to learnings"（「これを学びに記録して」）
- "Create a skill from this solution"（「この解決策からスキルを作って」）
- "Check .learnings/ for related issues"（「.learnings/ で関連する問題を確認して」）
