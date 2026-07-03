---
name: design-doc-write
description: docs/design/ のルールに従って新しい design doc の draft を執筆する。dynamic workflow で多角度の設計提案を競作・敵対的相互批判させ、orchestrator が決定を骨子(skeleton)に確定し、同一骨子からの執筆競作+統合で1つの一貫した doc に書き上げる。設計判断を記録する番号付き design doc を書きたいとき、または「design doc を書いて」「設計ドキュメントを作って」などの依頼で使用する。執筆後の敵対的レビューまで自動で回したい場合は design-doc スキルを使う。
---

orvk の設計判断を記録する番号付き design doc を執筆する。
このスキルは **着想から draft 完成まで** を担当する。
敵対的レビューは `design-doc-review`、執筆+レビューの収束ループは `design-doc` を使う。

## ルールの参照先(必ず読む。都度)

design doc の中身のルール(何を書くか・高度・簡潔さ・自己完結・残骸禁止・既存実装の存在理由・図・status・運用)は次の 2 つのドキュメントが正であり、このスキルには再掲しない。
執筆前に毎回読み直す(記憶に頼らない)。

1. `docs/design/README.md` — ルール全体。
2. `docs/design/template.md` — 章立てと各セクションの書き方。

あわせて `docs/philosophy.md`(設計原則)、`docs/design/INDEX.md`(既存 doc と最新番号)、`.claude/skills/japanese-tech-writing/SKILL.md`(日本語文章規範。一文一行)を読む。
このスキルが指示するのは **執筆の進め方(ワークフロー)** だけである。

## 執筆の原則

- **初稿は執筆側が完成させる。** 執筆前の問題設定すり合わせ(曖昧なら `grilling` で1問ずつ)だけが例外で、書き始めた後は設計判断・doc の分割・粒度・スコープ・番号体系をすべて自分で決め、完成前にユーザーへ設計判断を仰がない(`AskUserQuestion` で尋ねない)。迷うほど有望だった候補は Pros/Cons とともに代替案へ残す。設計が根本的に立たないと判断したら、reject 推奨とその理由を決めた立場として doc に記録して仕上げる。正: README「初稿は執筆側が完成させる」。
- **多観点の統合は骨子で行う。** 複数エージェントの視点は、散文のマージではなく **決定レベルの骨子(skeleton)** に統合してから、骨子に沿って書く。骨子が doc(セットなら全 doc)の一貫性の単一の源である。
- **執筆はフル稿の競作+統合。** 同一骨子から複数候補がフル稿を書き、最良を base に他候補の良い箇所を graft して1つにする。候補は本物の doc を編集せず、リポジトリ外(セッションの scratchpad)に書く。
- **骨子は決定を固定する。** 執筆候補は骨子の決定・代替案・セクション別の主張に従い、決定の追加・変更・削除をしない(表現・構成・例の選び方だけが候補の裁量)。

## 手順

1. `docs/design/README.md`・`docs/design/template.md`・`docs/philosophy.md`・`docs/design/INDEX.md` と、設計が触れる実コード・既存 doc を読み、記録する意思決定を1つに定める。問題設定が曖昧ならユーザーと執筆前にすり合わせる。
2. **設計競作 workflow(スクリプト A)を実行**し、多角度の設計提案・相互批判・改訂案を得る。
3. **骨子を確定する(orchestrator である自分の仕事)。** 提案と批判を読み、メイン設計・代替案・セクション別の主張を、哲学・各案の Pros/Cons・コードベースの一貫性で自分が決め、骨子ファイルを scratchpad に Write する(下記「骨子の形式」)。ユーザーに問わない。
4. INDEX.md で次の連番を決め、骨子に doc パス・ヘッダー情報を確定させて、**執筆競作+統合 workflow(スクリプト B)を実行**する。
5. 統合結果を通読し、「完成チェック」で自己確認する。INDEX.md の索引と件数を更新する。
6. `feature/design-<topic> → develop` を `--no-ff`(PR なし)で landing し、レビュー前 doc を develop に集約する(docs/harness/git-and-pr.md「Design Doc のブランチ運用」)。
7. 敵対的レビューまで回すなら `design-doc` の収束ラウンドに進む(骨子ファイルは以降のラウンドでも使うので残す)。

## 骨子(skeleton)の形式

scratchpad に markdown で書く。
例:

```md
# 骨子: 0042_buffer_suballocation

対象 doc: docs/design/0042_buffer_suballocation.md
ヘッダー: created: 2026-07-02 / status: draft / implementation: not-started

## 問題とスコープ
- 解決したい問題(効果で書く): 小さなバッファの大量確保によるメモリ断片化と確保コストを、利用者側の管理コードなしに解消する。
- この文書では書かないこと: <箇条書き>
- やらないこと: <箇条書き>

## 決定(design 高度の意思決定とデータ契約)
- D1: <決定の一文> — 根拠: <一文>
- D2: ...

## 代替案
- A1: <どういう設計か> — Pros: <要点> / Cons: <要点> / なぜメイン案を選んだか: <一文>

## セクション別の主張
- 概要: <10〜20 行で立てる core claim の要点>
- シナリオ: <トレースする具体ユースケース>
- 詳細設計: <D1..Dn をどの順で、どの型・契約を示して説明するか>
- 落とし穴: <仕様として認める既知の負>
- 負荷・コスト: <ランタイム負荷の主張(測定可能な形で)>

## セット横断契約(セットのときのみ)
- <doc 間で共有する型・境界・責務と、どの doc がその説明のホームか>
```

## スクリプト A: 設計競作

実行前に `brief`(と必要なら `ANGLES`)を直接書き換える(Workflow の `args` に頼らない)。

```js
export const meta = {
  name: 'design-doc-explore',
  description: 'Fan out orvk design proposals from diverse angles, adversarially cross-critique, revise; return material for the orchestrator to decide',
  phases: [{ title: 'Propose' }, { title: 'Attack' }, { title: 'Revise' }],
}

// orchestrator がユーザーとのすり合わせ結果から書く: 問題意識・スコープの外枠・制約・読むべきコード/既存 doc のパス。
const brief = `<問題意識・スコープ・制約・関連コード/既存 doc のパス>`
// 角度は対象に応じて入れ替えてよい(互いに別解になる角度を選ぶ)。持続並列は 6 まで。
const ANGLES = [
  '最小変更: 既存機構の組み合わせ・より小さい変更で問題を解けないか。「やらない」も候補に含める。',
  '型と契約: データ契約・型の形・API 意味論の正しさを最優先に設計する。',
  '利用者の使い勝手: このライブラリでレンダラやアプリケーションを組む人の書き味を最優先に設計する。',
  '低レベル制御の自由度: Vulkan の機能へ細かく到達したい人の制御性・逃げ道・Vulkan 概念との対応の見通しを最優先に設計する。',
]
const MAX_TRIES = 2

const PROPOSAL = {
  type: 'object',
  properties: {
    problem: { type: 'string' },   // 問題の立て直し(実装手段でなく効果で書く)
    approach: { type: 'string' },  // 設計の要点
    decisions: { type: 'array', items: { type: 'string' } },  // design 高度の決定(境界・phase 構造・データの流れ・型の形・API 意味論)
    contracts: { type: 'string' }, // 主要な型・データ契約の形
    pros: { type: 'array', items: { type: 'string' } },
    cons: { type: 'array', items: { type: 'string' } },
    failure_modes: { type: 'array', items: { type: 'string' } },
    needed: { type: 'boolean' },   // そもそもこの設計が要るか
    needed_reason: { type: 'string' },
  },
  required: ['problem', 'approach', 'decisions', 'contracts', 'pros', 'cons', 'failure_modes', 'needed', 'needed_reason'],
}

async function withRetry(fn, label) {
  for (let t = 1; t <= MAX_TRIES; t++) { const r = await fn(); if (r) return r; log(`${label} try ${t} failed, retrying`) }
  return null
}

phase('Propose')
const proposals = (await parallel(ANGLES.map((angle, i) => () => withRetry(
  () => agent(
    `orvk の design doc の執筆準備として、次の問題に対する設計案を1つ立てる。\n` +
    `brief: ${brief}\n` +
    `まず docs/design/README.md・docs/philosophy.md と、brief が指すコード・既存 doc を読む。\n` +
    `あなたの角度: ${angle} 他の角度とは別解になるよう、この角度を最優先した設計を出す。\n` +
    `決定は design 高度で書き、実装手順(関数名・呼び出し順・変更ファイル一覧)は書かない。`,
    { schema: PROPOSAL, phase: 'Propose', label: `propose#${i}` },
  ), `propose#${i}`)))).filter(Boolean)

phase('Attack')
const pjson = JSON.stringify(proposals)
const critiques = (await parallel(proposals.map((p, i) => () => withRetry(
  () => agent(
    `orvk の設計案の敵対的批判。全案: ${pjson}\n` +
    `あなたは案 #${i} を除く全案を攻撃するレビュアー。各案の失敗モード・docs/philosophy.md 違反・甘い前提・見落としを、必要なら関連コードを読んで具体的に突く。` +
    `案ごとに最も強い反論を返す。`,
    { phase: 'Attack', label: `attack#${i}` },
  ), `attack#${i}`)))).filter(Boolean)

phase('Revise')
const revised = (await parallel(proposals.map((p, i) => () => withRetry(
  () => agent(
    `あなたの設計案: ${JSON.stringify(p)}\n批判(全案向け): ${JSON.stringify(critiques)}\n` +
    `自案に当たる批判へ応答し、案を最強の形に改訂して返す(反論できるものは反論し、直すべきものは直す)。`,
    { schema: PROPOSAL, phase: 'Revise', label: `revise#${i}` },
  ), `revise#${i}`)))).filter(Boolean)

return { proposals: revised.length ? revised : proposals, critiques }
```

## スクリプト B: 執筆競作+統合

初回執筆と、レビュー後の再執筆(`design-doc` の収束ラウンド)の両方で使う。
実行前に `docPaths` / `skeletonPath` / `findingsJson` / `CAND_ROOT` を直接書き換える(Workflow の `args` に頼らない)。

```js
export const meta = {
  name: 'design-doc-compose',
  description: 'Write full candidate drafts per doc from a fixed skeleton, compare, integrate into the real doc',
  phases: [{ title: 'Draft' }, { title: 'Compare' }, { title: 'Integrate' }],
}

const docPaths = ['docs/design/NNNN_title.md']    // 本物の doc(セットなら全 doc を列挙)
const skeletonPath = `<scratchpad>/skeleton.md`   // orchestrator が確定した骨子(絶対パス)
const findingsJson = 'null'                       // 再執筆時: 直前レビューの findings の JSON 文字列。初回執筆は 'null'
const CAND_ROOT = `<scratchpad>/design-compose`   // 候補置き場(リポジトリ外の絶対パス。git を汚さない)
const K = 3        // 候補数(コスト理由で減らさない)
const RETRY = 4    // フル稿を書く長時間エージェントは一時 529/ECONNRESET に弱い

const CANON =
  `docs/design/README.md と docs/design/template.md(design doc のルール)、docs/philosophy.md、` +
  `.claude/skills/japanese-tech-writing/SKILL.md(一文一行)を必ず読み、全ルールに従う。`

async function withRetry(fn, label) {
  for (let t = 1; t <= RETRY; t++) { const r = await fn(); if (r) return r; log(`${label} try ${t} failed (529/net?), retrying`) }
  return null
}

// セットは骨子(セット横断契約)で整合を取り、執筆は doc ごとに回す(セット全体を1エージェントに書かせない)。
const results = []
for (const [d, docPath] of docPaths.entries()) {
  phase('Draft')
  const cands = (await parallel(Array.from({ length: K }, (_, i) => () => withRetry(
    () => agent(
      `design doc のフル候補稿を1つ書く。対象: ${docPath}。まず骨子 ${skeletonPath} を読む。\n` + CANON + `\n` +
      `骨子の決定・代替案・セクション別の主張・ヘッダー指定に従って書く。決定の追加・変更・削除はしない(表現・構成・例の選び方だけがあなたの裁量)。` +
      `骨子に無いセクション・概念を増やさない。セットの他 doc に関する記述は骨子の「セット横断契約」を正とする。\n` +
      (findingsJson !== 'null' ? `直前レビューの指摘(kind=design は骨子に反映済みなので骨子が正。kind=writing はあなたが解消する): ${findingsJson}\n` : ``) +
      `本物の ${docPath} は編集しない。全文を ${CAND_ROOT}/d${d}/c${i}/ 配下に同じファイル名で Write する(ディレクトリ作成可)。`,
      { phase: 'Draft', label: `draft:${docPath}#c${i}` },
    ), `draft d${d}c${i}`)))).filter(Boolean)
  if (!cands.length) { results.push({ docPath, step: 'draft', incomplete: true }); log(`${docPath}: 全候補が失敗。docs 未更新のまま停止。`); break }

  phase('Compare')
  const dirs = Array.from({ length: K }, (_, i) => `${CAND_ROOT}/d${d}/c${i}`).join(' , ')
  const cmp = await withRetry(() => agent(
    `${docPath} の候補稿が次の各ディレクトリにある: ${dirs}。骨子: ${skeletonPath}。\n` +
    `各候補を、骨子への忠実さ・明快さ・簡潔さ・ルール(docs/design/README.md)への適合で敵対的に比較し、` +
    `最良の候補番号(base)と、他候補から移植すべき箇所(grafts: どの候補のどのセクション/説明を、なぜ)を具体的に列挙して返す。全体の混ぜ合わせは提案しない。`,
    {
      schema: { type: 'object', properties: { base: { type: 'number' }, grafts: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } }, required: ['base', 'grafts'] },
      phase: 'Compare', label: `compare:${docPath}`,
    },
  ), `compare d${d}`)
  if (!cmp) { results.push({ docPath, step: 'compare', incomplete: true }); break }

  phase('Integrate')
  const integ = await withRetry(() => agent(
    `${CAND_ROOT}/d${d}/c${cmp.base}/ の候補稿を base に、次の graft を適用して、本物の ${docPath} に統合稿を Write する: ${JSON.stringify(cmp.grafts)}\n` + CANON + `\n` +
    `骨子(${skeletonPath})の決定とヘッダー指定に従い、graft 以外を書き足さない。同じ根拠の反復を作らない(正: README「同じ根拠を複数セクションで繰り返さない」)。`,
    { phase: 'Integrate', label: `integrate:${docPath}` },
  ), `integrate d${d}`)
  results.push({ docPath, step: integ ? 'done' : 'integrate', incomplete: !integ })
  if (!integ) break
}
// incomplete の doc は未更新。収束・完了扱いにせず、原因(サーバ過負荷等)が解けてから回し直す。
return { results, incomplete: results.some(r => r.incomplete), skeletonPath }
```

## 完成チェック(統合結果の通読時)

- docs/design/README.md と template.md のルールをすべて満たす。とくに README の「Design Doc は『何のためにどんな設計か』と『その妥当性の判断根拠』を主張する文書」「design doc は design の高度で書く」「同じ根拠を複数セクションで繰り返さない」「自己完結の原則」「却下・不在の概念を本文に残さない」「変更対象の既存実装は『なぜそうなっているか』まで本文に書く」「図は単体で誤読なく伝わること」に照らして通読する。
- テンプレートのプレースホルダ(説明文)が1つも残っていない。ヘッダー3項目が埋まり、created が実日付。
- 骨子の決定がすべて本文に反映され、骨子に無い決定・セクションが紛れ込んでいない。
- 代替案が self-contained で「なぜメイン案か」がある。
- 初稿を執筆側が完成させた(分割・スコープ・番号体系も自分で決め、完成前にユーザーへ設計判断を尋ねていない)。
- 一文一行(文中の見た目改行が無い)。

## 注意

- **持続並列は 6 まで。** ワークフローを2本以上同時に起動しない(サーバ側スロットルの HTTP 429 を誘発する)。上記スクリプトの同時数(ANGLES ≤ 4、K = 3)はこの範囲に収まっている。増やすときは 6 を超えない。
- **Workflow の `args` に頼らない。** 対象 doc・骨子パス等はスクリプト定数を直接書き換え、実行結果の `docPaths` が意図と一致するか確認する。
- スクリプト B が `incomplete` を返したら docs は未更新なので、完了扱いにせず回し直す。
