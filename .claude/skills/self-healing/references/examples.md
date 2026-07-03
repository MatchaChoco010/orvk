# Self-Healing Examples

実際の失敗パターンに対してフォーマットを適用した具体的なHEALエントリ集である。
自分でhealを記録する際のテンプレートとして利用すること。
すべての例はiteration-2スキーマ（自由形式の`Trigger` / `Area`、オプションの`Active-Context`、`Source`フィールドなし、遅延生成のアーティファクトフォルダ）を使用している。

---

## Example 1 — Tool failure (lockfile mismatch)

````markdown
## [HEAL-20260524-001] npm_install_pnpm_lockfile

**Logged**: 2026-05-24T14:22:01Z
**Status**: verified
**Trigger**: tool-failure
**Area**: build
**Priority**: medium

### 失敗
`npm install` が `npm ERR! code EUSAGE` で 1 を返し、`pnpm-lock.yaml` は存在するが `package-lock.json` が無いという通知が出た。プロジェクトは pnpm workspaces を使っており、npm は pnpm のロックファイルに対するインストールを拒否する。

### 診断
プロジェクトルートに `pnpm-lock.yaml` がある。README と CI はどちらも `pnpm` を呼び出している。`npm` は以前のプロジェクトからの習慣であり、このプロジェクト本来のパッケージマネージャではなかった。

### 修正
代わりに pnpm を使う:
```bash
pnpm install
```

### 検証
```
$ pnpm install Lockfile is up to date, resolution step is skipped Already up to date✓ Done in 1.4s
```
終了コード 0。

### メタデータ
- Related Files: package.json, pnpm-lock.yaml
- See Also: (none yet)
- Pattern-Key: env.lockfile_mismatch
- Recurrence-Count: 1
- First-Seen: 2026-05-24
- Last-Seen: 2026-05-24

---
````

Pattern-Key `env.lockfile_mismatch` はプロジェクトをまたいで再利用できる（yarn.lock、bun.lockb など）。
Recurrence が 3 以上になったら、検証ステップとして `CLAUDE.md` または `AGENTS.md` へ昇格させるべきである。

Artifacts セクションはない。
修正はツールの置き換えだけで、生成されたファイルはない。
遅延フォルダパターン: `.learnings/heals/HEAL-20260524-001/` に入れるものがないため、フォルダは作成されない。

---

## Example 2 — Missing capability (helper written on the fly)

````markdown
## [HEAL-20260524-002] bulk_rename_branches_helper

**Logged**: 2026-05-24T15:10:44Z
**Status**: verified
**Trigger**: missing-capability
**Area**: ci
**Priority**: low

### 失敗
12 個のフィーチャーブランチを `feat-XXX-name` から `feat/XXX-name` へリネームする必要がある。これを扱う既存のプロジェクトスクリプトは無く、`gh` には一括リネームのプリミティブが無い。

### 診断
これはプロジェクトのバグではなく、繋ぎ込み（glue）作業である。ブランチごとに `gh api` を使う小さなシェルヘルパーがちょうどよい粒度だ。トップレベルのスクリプトにするほどではないが、次に誰かが同じことを頼んだときのためにファイルを残しておく価値はある。

### 修正
`.learnings/heals/HEAL-20260524-002/rename-branches.sh` を作成:

```bash
#!/usr/bin/env bash
set -euo pipefail
git fetch --all
for branch in $(git branch -r | grep 'origin/feat-' | sed 's|origin/||'); do
  new="${branch/feat-/feat/}"
  echo "$branch → $new"
  gh api -X POST "repos/{owner}/{repo}/git/refs" \
    -f "ref=refs/heads/$new" \
    -f "sha=$(git rev-parse "origin/$branch")"
  gh api -X DELETE "repos/{owner}/{repo}/git/refs/heads/$branch"
done
```

### 検証
ドライラン（API 呼び出しをコメントアウト）で、期待される 12 件のマッピングが出力された。
本番実行で 12 件すべてをリネームし、`git branch -r | grep 'feat-' | wc -l` は 0 を返す。

### 成果物
- `.learnings/heals/HEAL-20260524-002/rename-branches.sh`

### メタデータ
- Related Files: (none — operates on git refs)
- See Also: (none)
- Pattern-Key: tool.gh.bulk_branch_rename
- Recurrence-Count: 1
- First-Seen: 2026-05-24
- Last-Seen: 2026-05-24

---
````

ヘルパースクリプトは `.learnings/heals/<HEAL-ID>/` の下に置かれる。
参照可能だが、必須の構成要素とは見なされない。
頻繁に再利用されるようになったら、`scripts/` へ昇格させること。

---

## Example 3 — Environment issue (runtime version)

````markdown
## [HEAL-20260524-003] nvm_use_project_node

**Logged**: 2026-05-24T16:01:12Z
**Status**: verified
**Trigger**: env-issue
**Active-Context**: verify-gate
**Area**: tests
**Priority**: medium

### 失敗
`pnpm test` が `engine "node" is incompatible with this module. Expected version "^20.10.0". Got "18.19.0"` で 1 を返した。

### 診断
`.nvmrc` は node 20.10.0 を要求しているが、現在のシェルには以前のプロジェクトコンテキストから 18.19.0 が入っている。リポジトリへ `cd` した後、シェルの nvm が切り替えられていなかった。

### 修正
```bash
nvm use   # reads .nvmrc
```

### 検証
```
$ node --version v20.10.0$ pnpm test✓ 47 tests passed
```

### メタデータ
- Related Files: .nvmrc, package.json
- See Also: (none)
- Pattern-Key: env.node_version_mismatch
- Recurrence-Count: 1
- First-Seen: 2026-05-24
- Last-Seen: 2026-05-24

---
````

`Active-Context: verify-gate` としているのは、テストステップが失敗したときにエージェントが置かれていたワークフローのフェーズがそれだからである。
上流のコンテキストローダーがあれば、次に node プロジェクトで `verify-gate` が実行される際にこのエントリを提示できるだろう。
パイプラインに類似の概念がない場合は、このフィールドを省略すること。

---

## Example 4 — External service workaround

````markdown
## [HEAL-20260524-004] gh_api_rate_limit_backoff

**Logged**: 2026-05-24T17:33:08Z
**Status**: verified
**Trigger**: external-change
**Area**: ci
**Priority**: high

### 失敗
200 件の issue に対して `gh api repos/.../issues` をループさせたところ、約 60 回の呼び出し後に `403 rate limit exceeded` が返り始めた。未認証のバースト制限（高速な連続呼び出しに対する不正利用検知）。

### 診断
スクリプトはバッチ処理なしで `gh api` の REST を使っていた。`gh` は認証済みだが、高速な連続呼び出しに対しては二次レート制限が発動する。これは一次の 5000/時 制限ではない。単一のページネーション付き GraphQL クエリに切り替えると、二次制限を完全に回避できる。

### 修正
```bash
gh api graphql -f query='
  query($owner:String!,$repo:String!,$cursor:String) {
    repository(owner:$owner,name:$repo) {
      issues(first:100,after:$cursor) { ... }
    }
  }' -F owner=... -F repo=...
```
合計で約 3 回の呼び出しで済んだ（200 回ではなく）。

### 検証
全実行が 4.8 秒で完了し、403 は発生せず、200 件すべての issue を取得できた。出力を元の issue ごとの呼び出しのサンプルと比較したところ、フィールドは一致した。

### 成果物
- `.learnings/heals/HEAL-20260524-004/fetch-issues.sh`

### メタデータ
- Related Files: (none — ad-hoc query)
- See Also: (none)
- Pattern-Key: api.gh.rate_limit
- Recurrence-Count: 1
- First-Seen: 2026-05-24
- Last-Seen: 2026-05-24

---
````

---

## Example 5 — Abandoned heal (diagnosis was wrong)

````markdown
## [HEAL-20260524-005] vitest_flaky_snapshot

**Logged**: 2026-05-24T18:14:22Z
**Status**: abandoned
**Trigger**: tool-failure
**Active-Context**: verify-gate
**Area**: tests
**Priority**: medium

### 失敗
`vitest` のスナップショットテスト `Card > renders default` が 3 回中 2 回 flake した。差分はタイムスタンプ文字列が約 3 秒ずれていることを示していた。

### 診断（初回・誤り）
flake はスナップショットフィクスチャのタイムゾーンのずれだと想定した。固定の `Date.now()` スタブを使うようフィクスチャにパッチを当てた。

### 診断（現在・正しい）
スナップショットは複数の非決定的な値に依存している。タイムスタンプと `crypto.randomUUID()` の両方だ。クロックのスタブはそのうち一方しか対処していない。UUID はレンダリングごとに依然としてランダムなため、後続の実行でスナップショットがずれ続ける。

### 修正（試行）
テストのセットアップに `vi.useFakeTimers({ now: 1700000000000 })` を追加した。

### 検証
テストは 2 回通ったが、3 回目で再び flake した。同じ `Card > renders default` で、今度は差分が異なる（今回は UUID が変わった）。初回の診断は不完全だった。

### 中断メモ
正しい修正は、グローバルにスタブするのではなく、依存性注入（`clock` と `idGen` を prop として渡す）によってコンポーネントを決定的にすることだ。それはコンポーネントの契約に対する本物の変更であり、heal の範囲外である。self-improvement 経由で `FEAT-20260524-001` を起票し、ユーザーに共有した。

### メタデータ
- Related Files: src/components/Card.tsx, src/components/Card.test.tsx
- See Also: FEAT-20260524-001
- Pattern-Key: tests.flaky_snapshot_multi_nondeterminism
- Recurrence-Count: 1
- First-Seen: 2026-05-24
- Last-Seen: 2026-05-24

---
````

Abandoned な heal は第一級の存在である。
行き止まりを記録しておくことで、次のエージェントが同じ道を再びたどらずに済む。
本当の修正が heal ではなく機能（feature）である場合、self-improvement 経由で `FEAT-` エントリへ引き継ぐのが正しい次の一手である。

Artifacts セクションはない。
試みたパッチは差し戻され、再利用できるものは何も生成されなかった。
