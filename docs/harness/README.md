# docs/harness — ハーネス参照ドキュメントの索引

ここは **ハーネス**(エージェント向けの恒久的な規約・指示・道具立て)のうち、CLAUDE.md に常駐させるほど常時必要ではないが、特定の作業のときに**必ず読む**べき規約を置く場所である。
CLAUDE.md は常時必要な standing ゲートだけを持ち、ここへポインタを張る。

## 一覧と「いつ読むか」

| ドキュメント | 何の規約か | **読むべきタイミング(必須)** |
|---|---|---|
| [editing.md](editing.md) | ハーネス編集の作法・CLAUDE.md の整理の規律・読まれる仕組みの作り方 | CLAUDE.md / skill / `docs/harness/` / design doc のルール / `scripts/` を**編集・新設するとき(必須)** |
| [markdown.md](markdown.md) | Markdown 執筆の作法(見た目のための行中改行を入れない、全 markdown 共通) | **markdown を書く・編集するとき(design doc・harness・README・SKILL.md など全 markdown)** |
| [git-and-pr.md](git-and-pr.md) | ブランチ運用・コミット・Issue/PR・Design Doc のブランチ運用とレビュー PR・実装分割・レビュー対応・同期 | Git の分岐・コミット・Issue/PR 作業をするとき。`gh` の具体コマンドは `/pr-workflow` skill |
| [scripts.md](scripts.md) | 再利用スクリプトは `scripts/` に Node・一時検証スクリプトは残さない | スクリプトを書く/置き場所を決めるとき |

## 読むのを保証する仕組み

ポインタは受動的なので、読まれることを**仕組みで担保する**:

- **ハーネス編集**: ハーネスのファイル(CLAUDE.md / `.claude/skills/**` / `.claude/settings.json` / `docs/harness/**` / `docs/design/README.md` / `docs/design/template.md` / `scripts/**`)を Edit / Write しようとすると、PreToolUse フック [`scripts/hooks/harness-edit-guard.mjs`](../../scripts/hooks/harness-edit-guard.mjs) が editing.md と本索引を読むよう促す(`.claude/settings.json` に登録)。
- **素の `gh` / `git commit` の禁止**: これらを Bash ツールで直接叩くと、`permissions.deny` と PreToolUse フック [`scripts/hooks/bash-wrapper-guard.mjs`](../../scripts/hooks/bash-wrapper-guard.mjs) が block し、bot 名義になる `scripts/gh/gh.mjs` / `commit.mjs` を使うよう案内する(→ [git-and-pr.md](git-and-pr.md))。
- **作業トリガーの規約**: 作業内容で発火する規約(Issue/PR、design doc など)は、その作業を description でトリガーする skill(`/pr-workflow`、`/design-doc` 系)から参照させる。
- **常時必要なゲート**: 事実上どの作業でも関わるゲートだけ CLAUDE.md に置く。

新しい規約を足すときに、この「読まれる仕組み」まで用意するのが必須である(→ [editing.md](editing.md))。
