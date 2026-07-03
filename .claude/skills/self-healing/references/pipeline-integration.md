# パイプライン統合

`self-healing` がより大きなスキルパイプラインにどう組み込まれるか。
スキルを使うのに必須ではない — 単独で成立する。
このドキュメントは、オーケストレーションされたスキルパイプラインを運用するユーザー向けに、*任意の* 統合ポイントを説明する。

## 典型的なパイプラインでの位置

```
[work begins]
  ↓
upstream context loader  →  surfaces relevant prior heals + learnings for the active context
  ↓
intent capture           →  records what the agent is about to do (drift detection)
  ↓
[implementation]
  ↓                          ↳ FAILURE? → self-healing → verify → file HEAL → resume
  ↓
verification gate        →  compile / test / lint
  ↓                          ↳ FAILURE? → self-healing diagnoses; gate re-checks after heal
  ↓
quality pass             →  simplify / harden
  ↓
self-improvement         →  log learnings, promote recurring heals, extract skills
  ↓
[work complete]
```

`self-healing` は **内側ループの回復プリミティブ** だ。
他のスキルは *何か* がおかしいこと（テストの失敗、lint の失敗、監査がリグレッションを指摘）を検出して独自のチェックを実行する。
self-healing は、壊れたものを *修正* する必要があるときに、それらが呼び込む先だ — 明示的にも暗黙的にも。

## 参照統合（このリポジトリ）

`pskoett-skills` パイプラインを運用するユーザー向けに、統合ポイントは次の通り:

| 上流 / 下流スキル                                      | 統合ポイント                                                                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| [`pre-flight-check`](../../pre-flight-check/SKILL.md)  | セッション開始時に `.learnings/HEALS.md` を読み、アクティブなコンテキストでタグ付けされた heal をサーフェスする           |
| [`intent-framed-agent`](../../intent-framed-agent/SKILL.md) | 実行前に意図を確立する。self-healing の HEAL エントリは `Active-Context` 経由でアクティブな意図を参照する             |
| [`verify-gate`](../../verify-gate/SKILL.md)            | build/test/lint を実行する。失敗時、self-healing が診断ループを処理する。heal 後、verify-gate が再実行される。            |
| [`simplify-and-harden`](../../simplify-and-harden/SKILL.md) | heal がコードを安定させた *後* に実行される品質パス。このパス中に現れるリファクタは heal ではなく機能だ。 |
| [`agent-teams-simplify-and-harden`](../../agent-teams-simplify-and-harden/SKILL.md) | マルチエージェント版。監査の発見事項が heal の候補になる。                                          |
| [`self-improvement`](../../self-improvement/SKILL.md)  | Recurrence-Count ≥ 3 で heal のハンドオフを受け取る。蒸留されたルールをメモリファイルや新しいスキルに昇格させる            |
| [`learning-aggregator`](../../learning-aggregator/SKILL.md) | 蓄積された heal + learning のセッション横断分析によるパターン検出                                        |
| [`eval-creator`](../../eval-creator/SKILL.md)          | 昇格された heal を恒久的なリグレッション eval ケースに変える                                                              |
| [`skill-pipeline`](../../skill-pipeline/SKILL.md)      | タスクを分類し、self-healing を含む適切なスキルの組み合わせにルーティングするオーケストレーター            |

## 汎用統合（その他のパイプライン）

このリポジトリのパイプラインを運用していないユーザー向けにも、使うスキル名が何であれ同じ形が当てはまる:

1. **上流コンテキストローダー** — セッション開始時（またはコンテキスト切り替え時）に `.learnings/HEALS.md` を読み、関連する過去の heal をサーフェスするもの。`Pattern-Key`, `Area`, `Active-Context` で照合する。

2. **失敗トリガー** — パイプラインが失敗を観測できるあらゆる箇所（テストランナー、ビルドステップ、lint、監査、エージェントの自己評価）で、そのままリトライしたり取り繕ったりするのではなく、self-healing にルーティングする。

3. **検証ゲート** — パイプラインに別個の「機械検証」ステップがあるなら、self-healing の検証は heal の *最中に* 実行されるものだ。ゲートはフェーズ *の間に* 実行される。互いを補強するが、同じではない。

4. **昇格シンク** — パイプラインが再発する learning を永続メモリや新しいスキルに変えるあらゆる箇所。self-healing が再発エントリに追記する `Handoff` ブロックを読む。

5. **リグレッションテスト生成器** — 昇格された heal は、恒久的なリグレッション eval の優れた候補だ。パイプラインに eval-creator に相当するものがあるなら、昇格された heal を渡す。

## パイプラインがないプロジェクトでは?

このスキルは単独で完全に使える。
上流のサーフェスも、下流の昇格も、verify-gate もなく、ただ:

```
failure observed → diagnose → patch → verify → file HEAL
```

再発検出は依然として機能する（記録前に HEALS.md を grep するだけ）。
昇格も依然として機能する（`Handoff` ブロックを書くだけ。後で手動で CLAUDE.md / AGENTS.md / .github/copilot-instructions.md に昇格できる）。
パイプラインは前提条件ではなく、効果を倍増させるものだ。
