# スキルの出典・クレジット

このディレクトリ配下のスキルには、外部のオープンソーススキルを日本語訳して取り込んだものが含まれる。
出典を記載する。

| スキル | 出典リポジトリ | 元ファイル |
|--------|----------------|------------|
| `self-improvement` | [pskoett/pskoett-ai-skills](https://github.com/pskoett/pskoett-ai-skills) | `skills/self-improvement/` |
| `self-healing` | [pskoett/pskoett-ai-skills](https://github.com/pskoett/pskoett-ai-skills) | `skills/self-healing/` |
| `grilling` | [mattpocock/skills](https://github.com/mattpocock/skills)（MIT License, © 2026 Matt Pocock） | `skills/productivity/grilling/` |
| `japanese-tech-writing` | [k16shikano の gist](https://gist.github.com/k16shikano/fd287c3133457c4fd8f5601d34aa817d) | gist の `SKILL.md` |

## 取り込みにあたっての変更点

- `self-improvement` / `self-healing`: `SKILL.md` および `references/`・`assets/` 配下の Markdown を日本語訳。`scripts/` のフックスクリプトは、原典の bash 実装(`jq` / `python3` 依存)を **OS 非依存の Node.js(`.mjs`、純 Node stdlib)へ移植**した。Windows では `jq` が無く `python3` が Microsoft Store のスタブで動かず、原典の `.sh` ではフックが機能しなかったため。入出力契約(stdin の JSON payload、`hookSpecificOutput.additionalContext` 出力、終了コード、stdout=HEAL-ID 等)は原典と同一に保つ。元リポジトリの `evals/`（ベンチマーク・テストフィクスチャ）はスキル利用に不要なため除外。
- `grilling`: 元の `SKILL.md` を日本語訳した。
- `japanese-tech-writing`: gist の `SKILL.md` をそのまま取り込んだ(日本語技術文書の文体規範)。
