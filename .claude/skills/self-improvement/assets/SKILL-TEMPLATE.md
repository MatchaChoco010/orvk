# Skill Template

学びから抽出したスキルを作成するためのテンプレート。コピーしてカスタマイズする。

---

## SKILL.md Template

````markdown
---
name: skill-name-here
description: "このスキルをいつ・なぜ使うかを簡潔に説明する。トリガー条件を含めること。"
---

# スキル名

このスキルが解決する問題とその由来を説明する短い導入。

## クイックリファレンス

| 状況 | アクション |
|------|-----------|
| [トリガー1] | [アクション1] |
| [トリガー2] | [アクション2] |

## 背景

この知識がなぜ重要か。どんな問題を防ぐか。元の学びからの文脈。

## 解決策

### ステップバイステップ

1. コードまたはコマンドを伴う最初のステップ
2. 2番目のステップ
3. 検証のステップ

### コード例

```language
// 解決策を示すサンプルコード
```

## よくあるバリエーション

- **バリエーションA**: 説明と対処方法
- **バリエーションB**: 説明と対処方法

## 落とし穴

- 警告またはよくある間違い #1
- 警告またはよくある間違い #2

## 関連

- 関連ドキュメントへのリンク
- 関連スキルへのリンク

## ソース

学びのエントリから抽出。
- **Learning ID**: LRN-YYYYMMDD-XXX
- **Original Category**: correction | insight | knowledge_gap | best_practice
- **Extraction Date**: YYYY-MM-DD
````

---

## Minimal Template

すべてのセクションを必要としないシンプルなスキル向け:

````markdown
---
name: skill-name-here
description: "このスキルが何をするか、いつ使うか。"
---

# スキル名

[問題を1文で記述]

## 解決策

[コード／コマンドを伴う直接的な解決策]

## ソース

- Learning ID: LRN-YYYYMMDD-XXX
````

---

## Template with Scripts

実行可能なヘルパーを含むスキル向け:

````markdown
---
name: skill-name-here
description: "このスキルが何をするか、いつ使うか。"
---

# スキル名

[導入]

## クイックリファレンス

| コマンド | 目的 |
|----------|------|
| `./scripts/helper.sh` | [何をするか] |
| `./scripts/validate.sh` | [何をするか] |

## 使い方

### 自動（推奨）

```bash
./skills/skill-name/scripts/helper.sh [args]
```

### 手動ステップ

1. ステップ1
2. ステップ2

## スクリプト

| スクリプト | 説明 |
|------------|------|
| `scripts/helper.sh` | メインのユーティリティ |
| `scripts/validate.sh` | バリデーションチェッカー |

## ソース

- Learning ID: LRN-YYYYMMDD-XXX
````

---

## Naming Conventions

- **Skill name**: 小文字、スペースはハイフン
  - 良い例: `docker-m1-fixes`, `api-timeout-patterns`
  - 悪い例: `Docker_M1_Fixes`, `APITimeoutPatterns`

- **Description**: 動詞から始め、トリガーに言及する
  - 良い例: "Handles Docker build failures on Apple Silicon. Use when builds fail with platform mismatch."
  - 悪い例: "Docker stuff"

- **Files**:
  - `SKILL.md` - 必須、メインのドキュメント
  - `scripts/` - 任意、実行可能なコード
  - `references/` - 任意、詳細なドキュメント
  - `assets/` - 任意、テンプレート

---

## Extraction Checklist

学びからスキルを作成する前に:

- [ ] 学びが検証済み（status: resolved）
- [ ] 解決策が広く適用できる（一度限りでない）
- [ ] 内容が完全である（必要な文脈をすべて持つ）
- [ ] 名前が規則に従う
- [ ] 説明が簡潔でありながら有益
- [ ] Quick Reference テーブルが実行可能
- [ ] コード例がテスト済み
- [ ] 元となる学びのIDが記録されている

作成後:

- [ ] 元の学びを `promoted_to_skill` ステータスに更新
- [ ] 学びのメタデータに `Skill-Path: skills/skill-name` を追加
- [ ] 新しいセッションで読んでスキルをテスト
