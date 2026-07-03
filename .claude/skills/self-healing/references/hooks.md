# フック統合

コマンド失敗などのシグナルに対する、self-healing の任意の自動トリガー。

## Claude Code / Codex CLI

### Bash の PostToolUse（推奨）

非ゼロの終了コードを検出し、heal ループのリマインダーを `hookSpecificOutput.additionalContext` の JSON として返す — これが必要なのは、どちらのエージェントでも PostToolUse のプレーンな stdout はモデルに表示されないからだ。
フックのペイロードは JSON として stdin に届く。

Claude Code, `.claude/settings.json`（コマンドはスキルがインストールされている場所を指す — `gh skill install` なら `.claude/skills/self-healing/`、ベンダリングしているなら `skills/self-healing/`）:

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "command",
        "command": "node \"${CLAUDE_PROJECT_DIR}/.claude/skills/self-healing/scripts/detect-failure.mjs\""
      }]
    }]
  }
}
```

Codex CLI は `<repo>/.codex/hooks.json` または `~/.codex/hooks.json` 経由で、同じ `PostToolUse` イベントと出力形をサポートする（実験的、`config.toml` の `codex_hooks = true` の背後）。
Codex はフックコマンドをセッションの cwd から実行するため、スクリプトのパスは git ルートまたはホームディレクトリから解決すること。

トークンオーバーヘッド: Bash の失敗時にのみ約 80 トークンが注入される。
成功時は何も出さない。

### self-improvement との併用

self-improvement の `PostToolUse` フックも使っているなら、それらを連鎖させる。
どちらもツール結果に対して読み取り専用なので順序は問わないが、self-healing のトリガーがより広い self-improvement のリマインダーより先に発火するよう、self-healing を先に置く。

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Bash",
      "hooks": [
        { "type": "command", "command": "node \"${CLAUDE_PROJECT_DIR}/.claude/skills/self-healing/scripts/detect-failure.mjs\"" },
        { "type": "command", "command": "node \"${CLAUDE_PROJECT_DIR}/.claude/skills/self-improvement/scripts/error-detector.mjs\"" }
      ]
    }]
  }
}
```

### new-heal.mjs に Active-Context を渡す

スキルフローの中からヘルパースクリプトを呼び出すとき、`ACTIVE_CONTEXT` を設定すると、それが HEAL エントリの `Active-Context` フィールドに反映される:

```bash
ACTIVE_CONTEXT=verify-gate node .claude/skills/self-healing/scripts/new-heal.mjs node_version_mismatch env_drift
```

スクリプトは環境から `$ACTIVE_CONTEXT` を読み取る。
未設定の場合、`Active-Context` の行は省略される。

## GitHub Copilot

Copilot はフック（`.github/hooks/*.json`, `~/.copilot/hooks/*.json`）をサポートするが、ツールイベントではその出力が無視される — ログは取れるが、モデルにコンテキストを注入することはできない。
そのためリマインダーは `.github/copilot-instructions.md` に置く必要がある:

```markdown
## Self-Healing

When a command, test, or build fails during a task, don't paper over it. Run the heal loop:

1. Diagnose the root cause from the error output
2. Search `.learnings/HEALS.md` for an existing fix (Pattern-Key match)
3. Apply or write the patch (artifacts go under `.learnings/heals/<HEAL-ID>/`)
4. Verify by re-running the failing operation; require success
5. File a `HEAL-YYYYMMDD-XXX` entry to `.learnings/HEALS.md` with status `verified`

Ask in chat: "Should I run the self-healing loop on this failure?"
```

## トラブルシューティング

### 「detect-failure フックは発火するが、エージェントが heal ループを実行しない」

このフックは助言的だ — 強制されたワークフローではなく、リマインダーを注入する。
エージェントが無視しているなら、次を確認する:

1. スキルがアクティブなプラグインセットで有効になっている（`gh skill list`）
2. スキルの description が現在のタスクタイプでトリガーする（description を読み直す）
3. 「とにかくリトライしろ」とエージェントに指示する競合する命令が `CLAUDE.md` やアクティブなスキルにない

### 「フックが発火するたびに不要な heal プロンプトが出る」

フックは非ゼロの終了時にのみ発火する。プロンプトが多すぎるなら、それは失敗しているコマンドが多すぎるからだ — それらを直せばノイズは減る。特定のコマンドが正当に非ゼロで終了する場合（例: ミスを想定した `grep`）、それをラップする: `grep ... || true`。

### 「プロジェクトごとに異なるトリガーが欲しい」

フックスクリプトのパスをプロジェクトごとに上書きする。
各 `.claude/settings.json` は、プロジェクト固有のロジックを持つ `detect-failure.mjs` のローカルコピーを指せる。
