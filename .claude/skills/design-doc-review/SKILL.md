---
name: design-doc-review
description: 既存の design doc を「設計自体の妥当性」を主眼に、多数のエージェント・多数の観点で敵対的にレビューする(規約遵守は前提)。書き上げた design doc をレビューしたいとき、別エージェントが書いた doc の妥当性を確かめたいとき、または「design doc をレビューして」「設計ドキュメントを批評して」などの依頼で使用する。執筆から自動で回したい場合は design-doc スキルを使う。
---

対象の design doc を **敵対的に** レビューする。
粗探しをする側に立ち、「この doc を通すべきでない理由」を能動的に探す。
問題が無ければ無いと正直に言う。
このスキルはレビュー単体で、doc を修正しない(レビュー後の修正の回し方は `design-doc`)。

## 主眼は「設計自体の妥当性」(規約遵守は前提ゲート)

規約(`docs/design/README.md` / `docs/design/template.md`)への適合は合格の必要条件にすぎず、レビューの本題ではない。
本当に確かめるのは、**その設計が、現状からの変更として、今後の orvk の Vulkan ラッパーライブラリの基盤として妥当に立つか**である。
API 設計なら立場の違うユーザー(ライブラリでレンダラやアプリケーションを組む人・低レベル制御が要る人)のユースケースで使い勝手をトレースし、内部設計なら性能・保守性を疑い、**問題の立て方そのもの**(そもそも要るか、別の手段で済まないか)までさかのぼって問う。

## ルールの参照先(再掲しない)

規約の本文はこのスキルに書かない。
正は `docs/design/README.md` と `docs/design/template.md` である。
各レビュアーは、対象 doc 全文(セットなら全部)・`docs/design/README.md`・`docs/design/template.md`・`docs/philosophy.md`・対象が参照する既存 design doc・設計が触れる実コードを読んでからレビューする。

## 関連する doc はセットでレビューする

対象 doc が他の(とくに未承認 draft の)doc を相互参照している、または同じ設計テーマを分担しているときは、1つのセットとして `docPaths` に列挙してまとめてレビューする(分割粒度・doc 間整合もレビュー対象になる)。
独立した doc は単体でよい。
正: README「関連する design doc はまとめてレビューする」。

## レビュー workflow(スクリプト)

観点ごとに独立したレビュアーを Workflow ツールでファンアウトする(1人のレビュアーでは網羅できない)。
実行前に `docPaths`(と必要なら `LENSES` の replicate)を直接書き換える(Workflow の `args` に頼らない)。
難所(API の中核・性能の要・メタな是非)は同一観点の replicate を増やして見落としを減らす。

```js
export const meta = {
  name: 'design-doc-review',
  description: 'Adversarial multi-lens review of an orvk design doc (or related set); returns structured findings',
  phases: [{ title: 'Review' }],
}

// 対象 doc。関連する draft はセットで列挙する。独立した doc は1要素でよい。
const docPaths = ['docs/design/NNNN_title.md']
const docList = docPaths.join(' , ')
const isSet = docPaths.length > 1
const CHUNK = 6      // 持続並列の実測上限(サーバ側スロットルの HTTP 429 回避)。超えない。
const MAX_TRIES = 2

// 観点は「立場+判断テスト+ルールへのポインタ」で短く保つ(詳細な基準は docs/design/README.md / template.md をレビュアー自身が読む)。
const LENSES = [
  { key: 'usability-user', replicate: 1, prompt: 'このライブラリでレンダラやアプリケーションを組む人の視点で、実際のユースケースの書き味をトレースし、書きにくさ・冗長・驚き・誤用しやすさを探す。' },
  { key: 'usability-lowlevel', replicate: 1, prompt: '低レベル制御が要る利用者の視点。必要な Vulkan の機能に到達できるか、抽象が生の Vulkan へのアクセスや制御の細かさを塞いでいないか、Vulkan 概念との対応が見通せるか、ボイラープレートが過大でないか。' },
  { key: 'performance', replicate: 1, prompt: '内部設計の性能。hot path・毎 frame コスト・メモリ・スケールで性能が出るか。「上乗せは小さい」等の主張を実測観点で疑い、主張が測定可能な形で立っているかを確かめる。' },
  { key: 'maintainability', replicate: 1, prompt: '保守性。結合度・概念の増え方・10 年保守される基盤として老いに耐えるか。将来の変更で破綻しやすい箇所を探す。' },
  { key: 'simplicity', replicate: 1, prompt: 'シンプルさ・学習容易性。概念数・認知負荷・初見の学習コスト。simple over easy(構造的な絡みを増やして easy を足していないか)。' },
  { key: 'philosophy', replicate: 1, prompt: 'docs/philosophy.md の各原則と Pre-v1 API 方針(CLAUDE.md)への整合を敵対的に検証する。' },
  { key: 'edge-cases', replicate: 1, prompt: '重箱の隅。失敗モード・エッジケース・拡張性の限界・他 design doc との矛盾を細部まで能動的に探す。「落とし穴」章が誠実か。' },
  { key: 'meta', replicate: 1, prompt: 'メタ。そもそもこの設計は orvk の将来に必要か。問題の立て方は正しいか。既存機構の組み合わせ・より小さい変更・やらない選択で済まないか。妥当に立たないなら reject 推奨と理由を出す。' },
  { key: 'examples', replicate: 1, prompt: '実在の examples(または現実的ユースケース)をこの設計の API でどう書くことになるかを具体的にトレースし、書き味・破綻・ハックの要否を評価する。doc のコード引用・signature・定数値が実コードと一致するかも検証する。' },
  { key: 'core-claim', replicate: 1, prompt: '「(1) 何のためにどんな設計か」と「(2) その妥当性の判断根拠」が簡潔に筋を通して立つか。概要 10〜20 行で (1) が読み取れるか。(2) の不足(簡潔さを口実にした削りを含む)は major。(1)(2) に寄与しない水増し・同じ根拠の複数セクション反復・レビュー単位などの運用判断の混入も指摘する。正: README「Design Doc は『何のためにどんな設計か』と『その妥当性の判断根拠』を主張する文書(簡潔に書く)」。' },
  { key: 'altitude', replicate: 2, prompt: 'design の高度に留まっているか。各記述への判断テストは「取り違えると大きな手戻りになるか、それとも PR レビューで気づいて直せるか」——後者(実装高度: 関数名・関数分割・呼び出し順・編集レシピ・変更ファイル/関数インベントリ・テストカバレッジ)は正確に書けていても major。「負荷・コスト」が実装工数になっていないか。複数コード箇所にまたがる不変条件の単一出所の配置が design 判断として書かれているか(欠落は不足)。正: README「design doc は design の高度で書く(実装は PR レビューへ)」「『負荷・コスト』はランタイムの負荷であって実装工数ではない」。' },
  { key: 'rules', replicate: 1, prompt: '規約遵守の前提ゲート。docs/design/README.md / template.md の全ルールへの適合を機械的に検査する: 1意思決定・連番・ヘッダー・プレースホルダ残り・自己完結・代替案と「なぜメイン案か」・却下/不在概念の残骸(本文の否定・対比表現を走査し、引き合いの概念がリポジトリに実在するか確かめる)・一文一行。正: README、とくに「自己完結の原則」「却下・不在の概念を本文に残さない」。' },
  { key: 'context-zero', replicate: 1, prompt: '文脈ゼロの読者として読む。既存の実装・挙動・プロトコル・ビルド基盤を変更する doc で、既存挙動の存在理由(その形を強いている制約)が本文だけで読み取れ、変更の是非を doc 単体で判断できるか。additive・自明な doc への過剰要求はしない。正: README「変更対象の既存実装は『なぜそうなっているか』まで本文に書く」。' },
  { key: 'diagram', replicate: 1, prompt: 'doc の文脈を一切共有しない状態で図だけを見て、何を表すか・各矢印の意味が誤読なく伝わるか。矢印の意味の混在・凡例の欠落を指摘する。正: README「図(mermaid 等)は単体で誤読なく伝わること」。' },
  // セットのときだけ意味を持つ観点(docPaths が1つなら findings 空でよい)。
  { key: 'split-granularity', replicate: 1, prompt: 'セットの分割粒度。境界の引き方は妥当か。統合・再分割した方がよくないか。詰め込みすぎ/割りすぎはないか。' },
  { key: 'cross-doc', replicate: 1, prompt: 'doc 間の整合性。共有する概念・型・契約の食い違い、境界の隙間(どの doc も書いていない)や重複(複数 doc が別々に書いている)、相互参照の正しさ。' },
]

const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['blocker', 'major', 'minor', 'nit'] },
          kind: { type: 'string', enum: ['design', 'writing'] },
          lens: { type: 'string' },
          doc: { type: 'string' },
          location: { type: 'string' },
          problem: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['severity', 'kind', 'lens', 'doc', 'location', 'problem', 'fix'],
      },
    },
    reject_recommended: { type: 'boolean' },
    reject_reason: { type: 'string' },
  },
  required: ['findings'],
}

const TASKS = LENSES.flatMap(l => Array.from({ length: l.replicate }, (_, i) => ({ ...l, idx: i })))

async function reviewTask(task) {
  for (let t = 1; t <= MAX_TRIES; t++) {
    const r = await agent(
      `次の design doc を「${task.key}」観点で敵対的にレビューする: ${docList}。` +
      (isSet ? `これらは関連する1つのセットなので、各 doc 単体に加え doc 間の整合・分担も見る。` : ``) +
      `まず対象 doc 全部・docs/design/README.md・docs/design/template.md・docs/philosophy.md、対象が参照する既存 doc、設計が触れる実コード/examples を読む。\n` +
      `観点: ${task.prompt}\n` +
      `粗探しをする側に立ち、問題が無ければ findings は空配列で返す。各 finding に対象 doc のパスと kind を入れる。` +
      `kind は design(決定・構造・スコープの再検討を要する。表現を直しても解けない)か writing(表現・構成・規約適合の修正で足りる)。` +
      `設計妥当性の指摘は「規約違反」ではなく「設計としてどう立たないか」を述べる。確証の無い推測を major 以上にしない。` +
      `設計が妥当に立たないと判断したら reject_recommended=true と reject_reason を返す。`,
      { schema: FINDINGS, phase: 'Review', label: `review:${task.key}#${task.idx}t${t}` },
    )
    if (r) return r
    log(`review:${task.key}#${task.idx} try ${t} failed (429?), retrying`)
  }
  return null
}

// CHUNK 個ずつのバッチで流し、瞬間同時数を抑える(持続並列 >6 は 429 が多発する)。
const results = []
for (let i = 0; i < TASKS.length; i += CHUNK) {
  results.push(...await parallel(TASKS.slice(i, i + CHUNK).map(t => () => reviewTask(t))))
}
const valid = results.filter(Boolean)
const findings = valid.flatMap(r => r.findings)
return {
  docPaths,
  ran: valid.length,
  planned: TASKS.length,
  // 誤収束ガード: 実走が過半に満たないラウンドの「指摘ゼロ」を信用しない(429 全滅を収束と誤認しない)。
  complete: valid.length >= Math.ceil(TASKS.length * 0.6),
  blockerMajor: findings.filter(f => f.severity === 'blocker' || f.severity === 'major'),
  minors: findings.filter(f => f.severity === 'minor' || f.severity === 'nit'),
  rejects: valid.filter(r => r.reject_recommended).map(r => r.reject_reason),
}
```

## findings の扱い

- severity: blocker(承認前に必ず直す)/ major / minor / nit。確証の無い推測は major 以上に上げない。
- kind: `design` は決定レベルの再検討を要する指摘(修正の前に orchestrator が再決定する。`design-doc` の収束ラウンド)。`writing` は再執筆・整形で解ける指摘。
- レビュアーは読み取り専用で、doc を修正しない。
- `complete` が false のときは収束判定に使わず、原因(サーバ過負荷)が解けてから回し直す。

## reject の扱い

レビューは reject を推奨できる(findings と `reject_recommended` で理由を出す)。
`rejected` への確定は原則ユーザーの仕事で、`## 却下理由` セクションの書き方は README「reject 時の却下理由セクション」に従う。

## 単体で使うときの出力

`design-doc` を経由せず単体で使うときは、findings を重大度順に整理してユーザーに報告し、最後に総評(このまま承認に出してよいか、blocker/major があるか、設計として立つか・reject 推奨か)を述べる。
問題が無ければ「指摘なし」と明記する。
