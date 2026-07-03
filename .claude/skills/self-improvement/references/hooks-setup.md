# Hook セットアップガイド（マルチエージェント）

AIコーディングエージェント全体で自己改善トリガーを自動的に設定する。
サポートされるすべてのエージェントで、同じ2つのスクリプトを利用できる。

- `scripts/activator.mjs` — プロンプト送信時に、学びを評価するよう促すリマインダー
- `scripts/error-detector.mjs` — シェルコマンドに対するツール実行後のエラー検出

スクリプトは Node 標準ライブラリだけで JSON を解析する（jq / python3 不要、OS 非依存）。
フックは `node "<スクリプトパス>.mjs"` の形で起動する。
サポートされるすべてのエージェントは、フックのペイロードを**標準入力上のJSON**として渡す（`CLAUDE_TOOL_OUTPUT` 環境変数はどのエージェントにも存在しない）。
エージェントごとに異なるのは、設定ファイルの場所、イベント名、そしてフックの出力でモデルにコンテキストを注入できるかどうかである。

| エージェント | 設定ファイルの場所 | プロンプト送信イベント | ツール実行後イベント | コンテキストを注入できるか? |
|-------|----------------|--------------------:|----------------:|---------------------|
| Claude Code | `.claude/settings.json`（プロジェクト）または `~/.claude/settings.json` | `UserPromptSubmit`（プレーンな標準出力 → コンテキスト） | `PostToolUse`、matcher `Bash`（`additionalContext` JSONが必要） | はい |
| Codex CLI | `<repo>/.codex/hooks.json` または `~/.codex/hooks.json`、`config.toml` の `[features] codex_hooks = true` が前提 | `UserPromptSubmit`（プレーンな標準出力 → developerコンテキスト） | `PostToolUse`、matcher `Bash`（`additionalContext` JSONが必要） | はい |
| Copilot CLI / コーディングエージェント | `.github/hooks/*.json`（リポジトリ）または `~/.copilot/hooks/*.json`（個人） | `userPromptSubmitted`（出力は無視される） | `postToolUse`、matcherなし（出力は無視される） | いいえ — フックはロギングとポリシー用途のみ。リマインダーには `.github/copilot-instructions.md` を使う |

`error-detector.mjs` はペイロードの差異をスクリプト自身で吸収する。
Node 標準ライブラリだけで stdin の JSON を解析し（jq / python3 不要、OS 非依存）、`tool_response`（Claude Code / Codex）または `toolResult.textResultForLlm` と `resultType`（Copilot）を読み取り、matcherを持たないエージェント向けにスクリプト内でシェルツールへのフィルタリングを行い、リマインダーを `hookSpecificOutput.additionalContext` JSONとして出力する。
この形式はClaude CodeとCodexのいずれも受け入れ、Copilotは安全に無視する。

## インストール場所とパス

フックの `command` は、スキルが実際にインストールされている場所を指している必要がある。

| インストール方法 | スクリプトの場所 |
|----------------|-----------------|
| `gh skill install` / `npx skills add` | `.claude/skills/self-improvement/scripts/` |
| プラグインバンドル（Claude Code） | `${CLAUDE_PLUGIN_ROOT}/skills/self-improvement/scripts/`（プラグインフックのみ） |
| プロジェクトに同梱したリポジトリ | `skills/self-improvement/scripts/` |

Claude Codeでは、プロジェクト相対パスを `${CLAUDE_PROJECT_DIR}` でアンカーすること。
作業ディレクトリに関係なくプロジェクトルートに展開される。
Codexはセッションの `cwd` からフックコマンドを実行するが、これはサブディレクトリの場合がある。
gitルート（`$(git rev-parse --show-toplevel)/...`）から解決するか、ホームディレクトリを起点とするパスを使うこと。

## Claude Code のセットアップ

プロジェクトルートに `.claude/settings.json` を作成する（パスは `gh skill install` のレイアウトを想定している。上の表に従って調整すること）。

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PROJECT_DIR}/.claude/skills/self-improvement/scripts/activator.mjs\""
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PROJECT_DIR}/.claude/skills/self-improvement/scripts/error-detector.mjs\""
          }
        ]
      }
    ]
  }
}
```

補足:

- `matcher` はツール名でフィルタリングし、`PostToolUse` のようなツールイベントに適用される。`UserPromptSubmit` はmatcherをサポートしておらず、すべてのプロンプトで発火する。
- ユーザーレベルで有効化するには、同じ構造を `~/.claude/settings.json` に `~/.claude/skills/...` のパスで記述すること。
- オーバーヘッドを抑えたい場合は、UserPromptSubmitフックのみを登録すること。

## Codex CLI のセットアップ

Codexはライフサイクルフックをサポートしている（実験的機能で、現在Windowsでは利用できない）。
`~/.codex/config.toml` でフィーチャーフラグを有効にする。

```toml
[features]
codex_hooks = true
```

次に `<repo>/.codex/hooks.json`（プロジェクトの `.codex/` レイヤーが信頼されている場合に読み込まれる）または `~/.codex/hooks.json` を作成する。

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$(git rev-parse --show-toplevel)/.claude/skills/self-improvement/scripts/activator.mjs\""
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$(git rev-parse --show-toplevel)/.claude/skills/self-improvement/scripts/error-detector.mjs\"",
            "statusMessage": "Checking for command errors"
          }
        ]
      }
    ]
  }
}
```

補足:

- Codexの `UserPromptSubmit` はプレーンな標準出力をdeveloperコンテキストとして追加するため、`activator.mjs` はそのまま動作する。
- Codexの `PostToolUse` はプレーンな標準出力を無視するが、Claude Codeと同じ `hookSpecificOutput.additionalContext` JSON形式を受け入れる。これは `error-detector.mjs` が出力する形式である。
- スクリプトのパスは、自身のインストールレイアウトに合わせて調整すること（例ではスキルが `.claude/skills/` 配下にインストールされていることを想定している）。

## GitHub Copilot のセットアップ

Copilotは `.github/hooks/*.json`（リポジトリ全体）または `~/.copilot/hooks/*.json`（Copilot CLIの個人用）でフックをサポートしているが、フックの出力は `userPromptSubmitted` と `postToolUse` の両方で**無視される**。
フックはロギングとポリシーの適用はできるが、コンテキストの注入はできない。
そのためCopilotでは次のようにする。

1. リマインダーは `.github/copilot-instructions.md` に記述する（これがモデルに届く唯一の経路である）。

```markdown
## Self-Improvement

After completing tasks that involved:
- Debugging non-obvious issues
- Discovering workarounds
- Learning project-specific patterns
- Resolving unexpected errors

Consider logging the learning to `.learnings/` using the format from the self-improvement skill.

For high-value learnings that would benefit other sessions, consider skill extraction.
```

2. 必要に応じて、監査ロギング用にディテクターを登録する（そのJSON出力は破棄されるが、無害である）。

```json
{
  "version": 1,
  "hooks": {
    "postToolUse": [
      { "type": "command", "bash": "node ./.claude/skills/self-improvement/scripts/error-detector.mjs" }
    ]
  }
}
```

## 検証

### アクティベーターフックのテスト（Claude Code / Codex）

1. フックの設定を有効にする
2. 新しいセッションを開始する
3. 任意のプロンプトを送信する
4. コンテキストに `<self-improvement-reminder>` が表示されることを確認する

### エラーディテクターフックのテスト

Claude Code / Codex のダミーペイロードを使った単体テスト:

```bash
echo '{"tool_name":"Bash","tool_response":"ls: /nonexistent/path: No such file or directory"}' \
  | node scripts/error-detector.mjs
```

Copilotのダミーペイロード（ツールフィルター＋失敗パス）を使ったテスト:

```bash
echo '{"toolName":"bash","toolResult":{"resultType":"failure","textResultForLlm":"npm ERR! missing script"}}' \
  | node scripts/error-detector.mjs
```

期待される結果: いずれの場合も `additionalContext` を含むJSONオブジェクト。
実際のClaude CodeまたはCodexのセッションでは、リマインダーは次のターンで注入コンテキストとしてモデルに届き、トランスクリプトに表示される出力としては現れない。

### 抽出スクリプトのドライラン

```bash
node scripts/extract-skill.mjs test-skill --dry-run
```

期待される出力には、作成されるスキルのscaffoldが表示される。

## トラブルシューティング

### フックが発火しない

1. **`node` が使えることを確認する**: `node` が PATH にあること（`node --version`）。フックは `node "<スクリプトパス>.mjs"` で起動するため、スクリプトに実行権限を付ける必要はない。
2. **パスを検証する**: スクリプトのパスがインストール方法に一致していること（「インストール場所とパス」を参照）、そしてアンカーされていること（`${CLAUDE_PROJECT_DIR}`、gitルート、または絶対パス）を確認する
3. **Codexのみ**: `codex_hooks = true` が設定され、プロジェクトの `.codex/` レイヤーが信頼されていることを確認する
4. **設定ファイルの場所を確認する**: プロジェクトレベルかユーザーレベルか
5. **セッションを再起動する**: フックはセッション開始時に読み込まれる

（スクリプトを `.sh` / python3 から純 Node の `.mjs` に移植したのは、Windows では `python3` が Microsoft Store のスタブで壊れることがあり、`chmod +x` のような Unix 前提も避けたいためである。）

### オーバーヘッドが大きすぎる

最小構成（プロンプト送信フックのみ）を使うか、`activator.mjs` を編集して出力テキストを減らすこと。
プロンプト内容によるフィルタリングは、3つのエージェントのいずれでも実現できない。
どれもプロンプト送信イベントでのmatcherをサポートしていないためである。

## フック出力のバジェット

アクティベーターは軽量になるよう設計されている。

- **目標**: 1回のアクティベーションあたり約50〜100トークン
- **内容**: 冗長な指示ではなく、構造化されたリマインダー
- **形式**: 解析しやすいXMLタグ

## セキュリティ上の考慮事項

- フックスクリプトはエージェントの権限で実行される
- スクリプトは標準入力のペイロードを読み取り、テキスト/JSONを標準出力に書き出すだけである。ファイルを変更したり、プロジェクトのコマンドを実行したりはしない
- すべてのフックはオプトインである（明示的に設定する必要がある）
- Codexのプロジェクトローカルなフックは、プロジェクトの `.codex/` レイヤーが信頼されている場合にのみ読み込まれる

## フックの無効化

フック設定ファイルから該当するイベントキーを削除するか、ファイルそのものを削除すること。
JSONはコメントをサポートしていないため、セクションを「コメントアウト」するとファイル全体の解析が壊れる。
