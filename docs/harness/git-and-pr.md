# Git ブランチ運用と Issue / PR の詳細

このドキュメントは **Git の分岐・コミット・Issue/PR 作業をするときに読む**。
CLAUDE.md には常時守るべきゲート(誰が何をマージするか、PR はレビュー単位、ハーネスも Issue+PR 等)だけを置き、その手順と細目はここに集約する。
`gh` の具体的コマンドとヘルパーは `/pr-workflow` skill を参照する。

## ブランチ運用

- `main` は動作が保証された状態を保つ。
- 開発は `develop` ブランチで行う。`main` から `develop` を切る。
- `develop` から機能実装単位で `feature/hoge` ブランチを切る。`hoge` は実装する機能を簡潔に表したスネークケースの英数字。
- `feature/hoge` で開発し、一通り完成したら `--no-ff` で `develop` にマージする。
- `main` へのマージも `--no-ff` で行う。
- **`main` へのマージはユーザーの確認を経てから行う。エージェントが勝手に `main` にマージしてはならない。**

## コミットメッセージ

- **1行目は「何をやったか」の簡潔なサマリー**にする。GitHub の UI や `git log --oneline` で表示されるのはこの1行なので、ここだけで概要が掴めるようにする(英語の命令形、72 文字程度まで)。
- 1行目の後は**空行を1つ**空け、必要なら本文で詳細(なぜ・何を・どう)を書く。本文は省略してよいが、書くなら 1行目で完結したサマリーを補足する位置づけにする。
- 余計な記号や引用符・ヒアドキュメントの残骸を先頭・末尾に付けない。1行目が記号だけ、といった状態にしない。
- 複数行メッセージは **stdin かファイルで渡し、コマンド引数(argv)に載せない**(理由は下記「複数行の本文は stdin で渡す」)。`commit.mjs` なら stdin: `printf 'subject\n\n本文' | node scripts/gh/commit.mjs -`、素の git なら `git commit -F <file>`。Bash ツールで PowerShell の here-string(`@'...'@`)を使うと先頭・末尾にリテラルの `@` が混入するので使わない。

## GitHub 操作は bot 名義で行う

Issue/PR の作成・レビュー返信・`gh api` などの **GitHub 操作は、ユーザー個人アカウントではなく bot アカウント(GitHub App `matchachoco010-bot`)名義で行う**。
そのために、素の `gh` ではなく `node scripts/gh/gh.mjs <gh の引数...>` を通す(bot の installation token を発行して `gh` に注入するラッパー)。
`pr-comments.mjs` / `pr-reply.mjs` も同じトークン経由で動く。
**素の `gh` を直接使うとユーザー個人名義になる**ので、GitHub 操作では使わない。

- コミットも bot(`matchachoco010-bot[bot]`)名義にする。`git add` で対象を選んでから、`git commit` の代わりに `node scripts/gh/commit.mjs "メッセージ"` を実行する(ステージ済み変更を Git Data API でコミットし、ブランチを push・ローカルを同期する)。API 経由で作るのでコミットは bot 名義かつ **Verified** になる。手元の `git commit` は author がユーザー個人名義になるので、bot 名義にしたいコミットでは使わない。
- **マージコミット(PR のコンフリクト解消の確定)も bot 名義にする。** `git merge origin/develop` でコンフリクトが出たら、解消して `git add` した後、`git merge --continue` / `git commit` の代わりに `node scripts/gh/merge-commit.mjs "メッセージ"` を実行する(2 親のマージコミットを Git Data API で作り、ref 更新とローカル同期まで行う。`commit.mjs` は単一親固定なのでマージの確定には使えない)。コマンド手順は `/pr-workflow`「PR のコンフリクト解消」。
- 素の `gh`・`git commit`・`git merge --continue` は `.claude/settings.json` の `permissions.deny`(`Bash(gh:*)` / `Bash(git commit:*)` / `Bash(git merge --continue:*)`)で**エージェントの Bash ツールからの直接実行を禁止**し、加えて PreToolUse フック [`scripts/hooks/bash-wrapper-guard.mjs`](../../scripts/hooks/bash-wrapper-guard.mjs) が検知して「代わりに `gh.mjs` / `commit.mjs` / `merge-commit.mjs` を使え」と理由つきで block する(deny がハードゲート、フックが案内)。`scripts/gh/*.mjs` は内部で `gh` / `git` を child_process として起動するが、これは Bash ツール経由ではない(サブプロセス)ため permission・フックの対象外で、影響を受けない。つまり素のコマンドを禁止してもラッパー経由は動く。
- 設定・仕組み・App の再セットアップ手順は [../../scripts/gh/README.md](../../scripts/gh/README.md)。認証情報は環境変数 `ORVK_GH_APP_ID` / `ORVK_GH_INSTALLATION_ID` / `ORVK_GH_APP_KEY` で渡す。設定が未了だと `gh.mjs` はエラーで止まる。

### 複数行の本文は stdin で渡す(argv に載せない)

Issue/PR/コメントの本文やコミットメッセージなど**複数行のテキストを argv(`--body "..."` や `-m "..."`)で渡してはいけない**。
Git Bash(MSYS2)からネイティブ Windows 実行ファイル(`node` / `gh` / `git`)を起動すると、argv の Windows コマンドライン変換で**最初の改行以降が切り捨てられ、本文が先頭1行だけになる**(`Closes #N` を1行目に置くと連携だけは効いてしまい、気づきにくい)。`"$(cat <<'EOF' … EOF)"` や複数行を入れた変数 `"$VAR"` を引数に置いても同じく切れる。切り捨ては gh.mjs 到達前に起きるのでラッパー側では直せない。

複数行本文は次のどれかで渡す。

- **本文をファイルに書いてから** `--body-file <file>`(Issue/PR)や `-F body=@<file>`(`gh api` でのコメント編集)で渡す。ファイルは **Write ツール**で作るとシェルを一切経由せず最も確実。
- **stdin ヒアドキュメント**: `node scripts/gh/gh.mjs pr comment N --body-file - <<'EOF'` … `EOF`(stdin はバイト列なので切れない)。
- コミットは `commit.mjs`(stdin)を使う。

投稿・編集後は `--jq '.body | length'` などで本文が先頭1行に切れていないか確認する。

## Issue と PR

GitHub を用いて Issue と PR で作業をトラックする(操作は上記のとおり `scripts/gh/gh.mjs` 経由)。
コマンドの詳細とヘルパーは `/pr-workflow` skill を参照。

### バグと Issue

- バグやタスクは Issue でトラックする。修正はその Issue に紐づけた `feature/hoge` ブランチの PR で行う。
- 複数のバグをまとめて1つの PR で直さない。
- 1つのバグでも、複数の原因があったり順次直す必要がある場合は PR を分ける。

### PR はレビューの単位

PR はユーザーがコードレビューする単位である。
レビューできる形に保つ。

- 関係ない差分を1つの PR に混ぜない。
- ただし「差分を小さくすればよい」ではない。本質的に1つの機能の実装に大きな差分が必要なら、論理単位を曲げてまで小さく割らない。
- レビューできる単位で割る。必要以上に細かく割って、結局すべての PR を見ないとコードを追えなくなるような分割は禁止。

## Design Doc のブランチ運用(レビュー PR)

Design Doc は status を進めながら、レビューを GitHub の PR 上で行う(README「レビュープロセス」が正)。

- **1 Design Doc(または密結合な 1 設計セット)= 1 つの長命 `feature/design-<topic>` ブランチ。** 執筆は `design-doc` / `design-doc-write` skill で行う。書きかけは `status: draft`、完成してレビューを待てる状態になったら `ready for review` にする。
- **レビュー前 doc は develop に集約(PR なし landing)**: `draft` と `ready for review` のどちらも、`feature → develop` を `--no-ff` でエージェントがマージして landing する(PR なし)。これでレビュー前の doc が develop に集まり、ユーザーはブランチ切替なしに markdown を読める。フィードバックや続きの執筆は同じブランチへ追記し、再度 `--no-ff` で develop にマージする。これは規約どおりのブランチマージで、develop への直接コミット/プッシュではない。
- **レビュー PR(develop から status を変えるだけ)**: ユーザーがレビュー開始を宣言したら、最新 develop から `feature/design-review-<topic>` を切り、対象 doc の `status` を `ready for review` → `reviewing` に変えて develop への PR を立てる(`/pr-workflow`「Design Doc レビュー PR」)。レビュー対象は既に develop にあるので差分は status 行だけだが、GitHub は変更ファイルなら差分外の行にもコメントできるため全文をレビューできる。関連 doc があれば1つの PR にまとめる(PR 作成前に同時提示すべき関連 doc が無いか確認する)。
- **レビューと反映**: 議論は PR のコメントで行い、各スレッドの解決を doc 本文へ反映する(PR ブランチへ追記コミット)。論点を「未解決の論点」節へ移してよいのは、先送り自体を設計判断として根拠付けられる場合だけである(節に書くべき内容は template.md)。議論が収束しないという理由で移さず、本文の決定として書き切る。
- **確定とマージ**: ユーザーが PR で承認したら `status: approved`(承認時に代替案を簡潔形へ整理する)、設計が立たないなら `rejected` + `## 却下理由` 節にして、**ユーザーが PR を develop にマージする**。マージ後にブランチを retire(削除)する。
- **承認後の実装は別物。** approved doc の実装は次の「Design Doc に紐づく実装」に従い、親 Issue + サブ Issue + 各実装の **ゲーティング PR**(コードレビュー)で行う。

エージェントが develop へ PR なしでマージしてよいのは、上記の **レビュー前 doc(`draft` / `ready for review`)の landing に限る**。
レビュー PR(`reviewing` 以降)を含む、それ以外の develop / main へのマージはユーザーが行う。

## Design Doc に紐づく実装

design doc の設計実装は、レビューが approve されてから実装に入る。

1. approve された design doc を、レビューしやすい実装粒度に分割する。
2. 親トラッキング Issue を作り、本文に design doc へのリンクを張る。
3. 各実装単位を **Sub-issue** として親 Issue にぶら下げ、実装順に並べる。(`gh` でのサブイシュー操作は `/pr-workflow` 参照。)
4. 各 Sub-issue に紐づく `feature/hoge` ブランチで PR を作って実装していく。

単一のバグ修正など分割不要なものは、サブイシューを使わず単体 Issue + PR でよい。

## ハーネスの更新も Issue と PR で

`.claude/skills/` の skill、`scripts/` の再利用スクリプト、design doc のルール(`docs/design/README.md`)、`docs/harness/` の参照ドキュメント、CLAUDE.md のようなエージェント向けの恒久的な指示や規約(まとめて「ハーネス」)の更新も、プロダクトコードと同じく **Issue と PR で管理する更新単位**である。

- ハーネスの変更を `develop` に直接コミットしない。Issue を立て、`feature/hoge` ブランチで変更し、PR を作ってユーザーの PR レビューを受ける。
- ハーネス更新も PR がレビューの単位である。関係ないハーネス変更や、ハーネスとプロダクトコード/Design Doc 本文の変更を1つの PR に混ぜない。
- マージはユーザーが行う。エージェントが勝手に `develop` / `main` にマージしない。
- ハーネスの中身をどう書くか(既存とのマージ・整理、CLAUDE.md の整理の規律)は [editing.md](editing.md) に従う。

## レビュー対応

- ユーザーが PR にコメントを付けたら、その内容を `gh` で取得する。
- 修正が必要なら修正し、必要ない場合もコメントに返信してなぜ不要かを示す。
- 質問のコメントには、実装を急がずまず質問に答える。

## マージと同期

- **ゲーティング PR(実装コード・ハーネス変更・Design Doc のレビュー PR)はレビューが通ったら _ユーザーが_ マージする。エージェントは勝手にマージしない。** エージェントが `feature → develop` を `--no-ff` で PR なしマージしてよいのは、**レビュー前 Design Doc(`draft` / `ready for review`)の develop への集約 landing に限る**(上記「Design Doc のブランチ運用」)。`main` へのマージは常にユーザーの確認を経る。
- PR がマージされたか等は `gh` でチェックする。
- `git fetch` / `git pull` でローカルをリモートに追従させ続ける。
