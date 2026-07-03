# エントリの例

全フィールドを備えた、適切にフォーマットされたエントリの具体例である。

## 学び: 訂正（correction）

````markdown
## [LRN-20250115-001] correction

**Logged**: 2025-01-15T10:30:00Z
**Priority**: high
**Status**: pending
**Area**: tests

### 概要
pytest のフィクスチャはデフォルトで関数スコープだと誤って想定していた

### 詳細
テストフィクスチャを書く際、すべてのフィクスチャが関数スコープだと想定していた。
ユーザーから、関数スコープがデフォルトではあるものの、このコードベースの
慣習ではテストパフォーマンス向上のためデータベース接続にモジュールスコープの
フィクスチャを使っている、と指摘を受けた。

### 推奨アクション
高コストなセットアップ（DB、ネットワーク）を伴うフィクスチャを作成する際は、
関数スコープをデフォルトにする前に、既存フィクスチャのスコープのパターンを確認すること。

### メタデータ
- Source: user_feedback
- Related Files: tests/conftest.py
- Tags: pytest, testing, fixtures

---
````

## 学び: 知識のギャップ（解決済み）

````markdown
## [LRN-20250115-002] knowledge_gap

**Logged**: 2025-01-15T14:22:00Z
**Priority**: medium
**Status**: resolved
**Area**: config

### 概要
このプロジェクトはパッケージ管理に npm ではなく pnpm を使う

### 詳細
`npm install` を実行しようとしたが、このプロジェクトは pnpm ワークスペースを使っている。
ロックファイルは `package-lock.json` ではなく `pnpm-lock.yaml` である。

### 推奨アクション
npm だと想定する前に `pnpm-lock.yaml` または `pnpm-workspace.yaml` の有無を確認すること。
このプロジェクトでは `pnpm install` を使う。

### メタデータ
- Source: error
- Related Files: pnpm-lock.yaml, pnpm-workspace.yaml
- Tags: package-manager, pnpm, setup

### 解決
- **Resolved**: 2025-01-15T14:30:00Z
- **Commit/PR**: N/A - knowledge update
- **Notes**: 今後の参照のため CLAUDE.md に追記した

---
````

## 学び: CLAUDE.md へ昇格

````markdown
## [LRN-20250115-003] best_practice

**Logged**: 2025-01-15T16:00:00Z
**Priority**: high
**Status**: promoted
**Promoted**: CLAUDE.md
**Area**: backend

### 概要
API レスポンスにはリクエストヘッダーの相関 ID を含めなければならない

### 詳細
すべての API レスポンスは、リクエストの X-Correlation-ID ヘッダーを
そのまま返さなければならない。これは分散トレーシングに必要である。
このヘッダーを欠いたレスポンスはオブザーバビリティのパイプラインを壊す。

### 推奨アクション
API ハンドラーでは常に相関 ID のパススルーを含めること。

### メタデータ
- Source: user_feedback
- Related Files: src/middleware/correlation.ts
- Tags: api, observability, tracing

---
````

## 学び: AGENTS.md へ昇格

````markdown
## [LRN-20250116-001] best_practice

**Logged**: 2025-01-16T09:00:00Z
**Priority**: high
**Status**: promoted
**Promoted**: AGENTS.md
**Area**: backend

### 概要
OpenAPI 仕様を変更したら API クライアントを再生成しなければならない

### 詳細
API エンドポイントを変更したら、TypeScript クライアントを再生成しなければならない。
これを忘れると、実行時にしか現れない型の不一致を引き起こす。
生成スクリプトはバリデーションも実行する。

### 推奨アクション
エージェントのワークフローに追加すること。API を変更したら必ず `pnpm run generate:api` を実行する。

### メタデータ
- Source: error
- Related Files: openapi.yaml, src/client/api.ts
- Tags: api, codegen, typescript

---
````

## エラーのエントリ

````markdown
## [ERR-20250115-A3F] docker_build

**Logged**: 2025-01-15T09:15:00Z
**Priority**: high
**Status**: pending
**Area**: infra

### 概要
プラットフォームの不一致により M1 Mac で Docker ビルドが失敗する

### エラー
```
error: failed to solve: python:3.11-slim: no match for platform linux/arm64
```

### コンテキスト
- Command: `docker build -t myapp .`
- Dockerfile uses `FROM python:3.11-slim`
- Running on Apple Silicon (M1/M2)

### 修正案
プラットフォームフラグを追加する: `docker build --platform linux/amd64 -t myapp .`
または Dockerfile を更新する: `FROM --platform=linux/amd64 python:3.11-slim`

### メタデータ
- Reproducible: yes
- Related Files: Dockerfile

---
````

## エラーのエントリ: 繰り返し発生する問題

````markdown
## [ERR-20250120-B2C] api_timeout

**Logged**: 2025-01-20T11:30:00Z
**Priority**: critical
**Status**: pending
**Area**: backend

### 概要
チェックアウト中にサードパーティの決済 API がタイムアウトする

### エラー
```
TimeoutError: Request to payments.example.com timed out after 30000ms
```

### コンテキスト
- Command: POST /api/checkout
- Timeout set to 30s
- Occurs during peak hours (lunch, evening)

### 修正案
指数バックオフ付きのリトライを実装する。サーキットブレーカーのパターンも検討する。

### メタデータ
- Reproducible: yes (during peak hours)
- Related Files: src/services/payment.ts
- See Also: ERR-20250115-X1Y, ERR-20250118-Z3W

---
````

## 機能リクエスト

````markdown
## [FEAT-20250115-001] export_to_csv

**Logged**: 2025-01-15T16:45:00Z
**Priority**: medium
**Status**: pending
**Area**: backend

### 要望された機能
分析結果を CSV 形式でエクスポートする

### ユーザーの背景
ユーザーは週次レポートを作成しており、技術者でないステークホルダーと
Excel で結果を共有する必要がある。現在は手作業で出力をコピーしている。

### 複雑度の見積もり
simple

### 実装案
analyze コマンドに `--output csv` フラグを追加する。標準の csv モジュールを使う。
既存の `--output json` のパターンを拡張できる。

### メタデータ
- Frequency: recurring
- Related Features: analyze command, json output

---
````

## 機能リクエスト: 解決済み

````markdown
## [FEAT-20250110-002] dark_mode

**Logged**: 2025-01-10T14:00:00Z
**Priority**: low
**Status**: resolved
**Area**: frontend

### 要望された機能
ダッシュボードのダークモード対応

### ユーザーの背景
ユーザーは深夜に作業しており、明るいインターフェースが目に負担だと感じている。
他の複数のユーザーもこれを非公式に言及している。

### 複雑度の見積もり
medium

### 実装案
色には CSS 変数を使う。ユーザー設定にトグルを追加する。
システムの設定の検出も検討する。

### メタデータ
- Frequency: recurring
- Related Features: user settings, theme system

### 解決
- **Resolved**: 2025-01-18T16:00:00Z
- **Commit/PR**: #142
- **Notes**: システム設定の検出と手動トグルで実装した

---
````

## 学び: スキルへ昇格

````markdown
## [LRN-20250118-001] best_practice

**Logged**: 2025-01-18T11:00:00Z
**Priority**: high
**Status**: promoted_to_skill
**Skill-Path**: skills/docker-m1-fixes
**Area**: infra

### 概要
プラットフォームの不一致により Apple Silicon で Docker ビルドが失敗する

### 詳細
M1/M2 Mac で Docker イメージをビルドすると、ベースイメージに ARM64 の
バリアントが存在しないためビルドが失敗する。これは多くの開発者に影響する
よくある問題である。

### 推奨アクション
docker build コマンドに `--platform linux/amd64` を追加するか、
Dockerfile で `FROM --platform=linux/amd64` を使う。

### メタデータ
- Source: error
- Related Files: Dockerfile
- Tags: docker, arm64, m1, apple-silicon
- See Also: ERR-20250115-A3F, ERR-20250117-B2D

---
````

## 抽出されたスキルの例

上記の学びをスキルとして抽出すると、次のようになる。

**File**: `skills/docker-m1-fixes/SKILL.md`

````markdown
---
name: docker-m1-fixes
description: "Apple Silicon（M1/M2）での Docker ビルド失敗を修正する。docker build がプラットフォーム不一致のエラーで失敗するときに使う。"
---

# Docker M1 Fixes

Apple Silicon Mac での Docker ビルド問題の解決策。

## クイックリファレンス

| エラー | 修正 |
|-------|-----|
| `no match for platform linux/arm64` | ビルドに `--platform linux/amd64` を追加する |
| イメージは動くがクラッシュする | エミュレーションを使うか ARM 互換のベースを探す |

## 問題

多くの Docker ベースイメージには ARM64 バリアントがない。Apple Silicon
（M1/M2/M3）でビルドすると、Docker はデフォルトで ARM64 イメージを
取得しようとし、プラットフォーム不一致のエラーを引き起こす。

## 解決策

### 選択肢1: ビルドフラグ（推奨）

ビルドコマンドにプラットフォームフラグを追加する:

```bash
docker build --platform linux/amd64 -t myapp .
```

### 選択肢2: Dockerfile の変更

FROM 命令でプラットフォームを指定する:

```dockerfile
FROM --platform=linux/amd64 python:3.11-slim
```

### 選択肢3: Docker Compose

サービスにプラットフォームを追加する:

```yaml
services:
  app:
    platform: linux/amd64
    build: .
```

## トレードオフ

| アプローチ | 長所 | 短所 |
|----------|------|------|
| ビルドフラグ | ファイル変更が不要 | フラグを覚えておく必要がある |
| Dockerfile | 明示的でバージョン管理される | すべてのビルドに影響する |
| Compose | 開発に便利 | compose が必要 |

## パフォーマンスに関する注記

ARM64 上で AMD64 イメージを実行すると Rosetta 2 のエミュレーションを使う。
開発には機能するが遅くなる場合がある。本番では、可能であれば ARM ネイティブの
代替を探すこと。

## Source

- Learning ID: LRN-20250118-001
- Category: best_practice
- Extraction Date: 2025-01-18
````
