# Learnings

開発中に捕捉した修正、洞察、知識のギャップ。

**Categories**: correction | knowledge_gap | best_practice
**Areas**: frontend | backend | infra | tests | docs | config
**Statuses**: pending | in_progress | resolved | wont_fix | promoted | promoted_to_skill

## ステータスの定義

| Status | 意味 |
|--------|---------|
| `pending` | 未対応 |
| `in_progress` | 現在対応作業中 |
| `resolved` | 問題が修正済み、または知識が統合済み |
| `wont_fix` | 対応しないと判断（理由を Resolution に記載） |
| `promoted` | CLAUDE.md、AGENTS.md、または copilot-instructions.md へ昇格済み |
| `promoted_to_skill` | 再利用可能なスキルとして抽出済み |

## スキル抽出時のフィールド

学びがスキルへ昇格されたら、次のフィールドを追加する:

```markdown
**Status**: promoted_to_skill
**Skill-Path**: skills/skill-name
```

例:
```markdown
## [LRN-20250115-001] best_practice

**Logged**: 2025-01-15T10:00:00Z
**Priority**: high
**Status**: promoted_to_skill
**Skill-Path**: skills/docker-m1-fixes
**Area**: infra

### 概要
Apple Silicon でプラットフォーム不一致により Docker ビルドが失敗する
...
```

---
