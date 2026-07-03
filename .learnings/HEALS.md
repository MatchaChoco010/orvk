# Heals

self-healing が記録する、タスク中に起きた障害の根本原因・修正・検証の記録。
エントリは `new-heal.mjs` が生成し、`## [HEAL-YYYYMMDD-XXX]` 形式で追記される。

**Statuses**: pending-verify | verified | abandoned
**Triggers**: tool-failure | missing-capability | env-issue | external-change

検証(VERIFY)が通った後にのみ Status を `verified` にする。サンドボックス等で検証
できない場合は `pending-verify`、修正がどうしても動かない場合は `abandoned` とする。
再発時は重複エントリを作らず、該当エントリの `Recurrence-Count` をインクリメントする。

エントリ形式の詳細は self-healing スキルを参照。

---
