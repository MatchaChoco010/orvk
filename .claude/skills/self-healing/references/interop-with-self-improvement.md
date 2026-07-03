# 相互運用: self-healing ↔ self-improvement

なぜ分割するのか、それぞれが何を担うのか、どうハンドオフするのか。
self-healing にログ記録を入れたくなったり、self-improvement に修正を入れたくなったりしたら、これを読むこと — それこそが避けたい重複だ。

## メンタルモデル

```
       failure observed (during work)
                  ↓
            self-healing
       (diagnose → patch → verify → file)
                  ↓
      HEAL-XXX entry, working state restored
                  ↓
   if recurrence ≥ 3 across distinct tasks:
                  ↓
          self-improvement
   (distill rule → promote to CLAUDE.md / new skill)
```

self-healing は **内側のループ**: ライブな失敗回復、必須の検証、成果物の生成。
self-improvement は **外側のループ**: パターンの集約、永続メモリへの昇格、スキルの抽出。

## 決定テーブル

| 状況 | どちらのスキル |
|-----------|-------------|
| たった今コマンドが 1 で終了し、動作させる必要がある | self-healing |
| ユーザーが「実は X であるべき」と言った | self-improvement（`LRN-` 修正） |
| テストが失敗し、パッチを当てた。pass を検証済み | self-healing（`HEAL-` verified） |
| テストが失敗し、原因が分からない。ユーザーに見せる必要がある | self-improvement（`ERR-` pending） |
| タスク途中で CSV を重複排除するヘルパースクリプトを書いた | self-healing（`HEAL-` missing_capability） |
| ユーザーが存在しない機能を要望した | self-improvement（`FEAT-`） |
| API 呼び出しのスキーマが変わった。呼び出しにパッチを当てた | self-healing（`HEAL-` external_api_failure） |
| プロジェクトが npm ではなく pnpm を使うと判明 — 失敗を伴わない観測 | self-improvement（`LRN-` knowledge_gap） |
| 再発する heal を CLAUDE.md に昇格させた | self-improvement（ルール昇格） |
| セッション開始時に既知の事項を確認するために読む | self-improvement（レビュー）または pre-flight-check |

## ハンドオフペイロード（heal → self-improvement）

heal が少なくとも2つの異なるタスクで `Recurrence-Count >= 3` に達し、かつ修正が一般化可能なとき、Handoff ブロックを追加する:

```markdown
### Handoff
- **Promoted To**: self-improvement at 2026-05-24
- **Promotion Target**: CLAUDE.md  (or AGENTS.md / .github/copilot-instructions.md / new-skill)
- **Distilled Rule**: One-line prevention guidance derived from the heal
```

その後、`self-improvement`（または `learning-aggregator`）が蒸留されたルールを取り、適切なコンテキストファイルに書き込む。
HEAL はトレーサビリティのために `HEALS.md` に残る — それがルールの存在理由についての真実の出所だ。

### 昇格先の選択

| Heal パターン            | 昇格先                                              |
| ------------------------ | -------------------------------------------------- |
| プロジェクト固有の慣習（npm ではなく pnpm を使う） | `CLAUDE.md` — 「pnpm を使う。npm を実行しない」 |
| エージェントのワークフロー（API クライアント再生成後に検証） | `AGENTS.md` — ワークフロールール |
| Copilot に関連するコンテキスト                        | `.github/copilot-instructions.md` |
| プロジェクト間で再利用可能（env.node_version）     | 新しいスキル、または既存スキルへの追加（例: `verify-gate`） |
| ツールの落とし穴（gh のレート制限パターン）             | スキルの SKILL.md |

## self-healing が *しない* こと（self-improvement が *する* こと）

- **修正を記録しない。** 「ユーザーが no と言った、別の方法でやれ」は self-improvement の `LRN-` だ。
- **機能要望を追跡しない。** 「X もできる？」 → self-improvement の `FEAT-` だ。
- **失敗を伴わない学びを蓄積しない。** 失敗を伴わずに「ビルドが Bazel を使うと判明」 → `LRN-` knowledge_gap だ。
- **何かを自分で昇格しない。** heal は `HEALS.md` に残る。昇格は self-improvement の仕事だ — self-healing は候補にフラグを立てるために `Handoff` ブロックを追記するだけだ。

## self-improvement が *しない* こと（self-healing が *する* こと）

- **検証ループを実行しない。** `LRN-` は証明されなくてよいが、`HEAL-` は証明されなければならない。
- **実行可能な成果物を生成しない。** heal でないエントリには `.learnings/heals/<HEAL-ID>/` フォルダがない（heal の場合でも、フォルダは遅延生成 — 入れるファイルがあるときだけ作られる）。
- **リアルタイムで物事を修正しない。** self-improvement は事後に記録される。self-healing は回復のプリミティブだ。

## エントリ間のクロスリファレンス

heal が既存の学びに関連するとき、双方向にリンクする:

`HEALS.md` 内:
```markdown
### Metadata
- See Also: LRN-20260520-007 (previous knowledge gap about this same lockfile)
```

`LEARNINGS.md` 内:
```markdown
### Metadata
- See Also: HEAL-20260524-001 (verified fix for this gap)
```

`learning-aggregator` は両側を読んで昇格の優先度を重み付けする — それを指す検証済みの heal を持つ学びは、どちらか単独よりも強い昇格候補だ。

## 統合を検討すべきとき（通常はすべきでない）

この2つのスキルは原理的には統合できる。
それでも分離しているのは:

1. **検証の規律が異なる。** heal は検証を要求するが、learning は要求しない。混ぜると検証の期待が弱まるリスクがある。
2. **成果物のスコープが異なる。** heal はファイルを生成し、learning はテキストを生成する。フォルダを混ぜると、どちらも監査しにくくなる。
3. **トリガーのタイミングが異なる。** heal はタスク途中で発火し、learning は事後に発火する。トリガー基準を混ぜると、過剰なログ記録か過少な heal のどちらかになる。
4. **昇格経路が異なる。** heal は self-improvement を *経由して* 昇格し、直接ではない。それを明示しておくことでパイプラインがトレース可能になる。

統合したくなったら、そう仕向けている失敗の形を見てみること — おそらくそれは learning フックを必要とする heal（See Also を使う）であって、欠けているプリミティブではない。
