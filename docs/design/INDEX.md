# orvk Design Docs 索引

全 design doc の索引。ルールは [README.md](README.md)、テンプレートは [template.md](template.md) を参照。番号は意思決定の時系列順。

## 索引表

| 番号 | タイトル | created | status | 1行説明 |
|---|---|---|---|---|
| [0001](0001_goals-and-non-goals.md) | orvk の目標と非目標 | 2026-07-02 | ready for review | Vulkan 専用ラッパーとしての目標 5 項目・恒久非目標・確定済みの全体決定(単一 crate、1 Device = 1 handle 空間、単一 queue 等)を固定する全 doc の親 |
| [0002](0002_resource-ownership-and-registry.md) | リソースの所有モデルと論理レジストリ | 2026-07-02 | ready for review | 論理/物理の 2 層レジストリ、index+generation+Device タグの handle、生成 rollback、retire の遅延破棄と reclaim、mapped 予約 RAII、test 可能な不変条件 9 項 |
| [0003](0003_bindless-descriptor-heap.md) | bindless descriptor heap と descriptor ABI | 2026-07-02 | ready for review | resource/sampler の 2 ヒープ、DescriptorRef と DescriptorHandle(uint2 = slot + generation)の分離、write-once と retire safety による slot 再利用の安全、publish バリア導出、binding profile |
| [0004](0004_access-declaration-and-sync.md) | access 宣言と同期(barrier)の導出 | 2026-07-02 | ready for review | 同期を access 宣言の一本に集約し、範囲交差ハザード → 記録順安定トポロジカルソート → ResourceTransition 導出。安定 read 抑制・dirty narrowing・ResourceStateTable による batch またぎの状態追跡 |
| [0005](0005_task-graph-and-command-encoder.md) | タスクグラフと command encoder | 2026-07-02 | ready for review | タスク = 宣言 + record closure、17 コマンドの CommandEncoder と記録時静的検証、push data 契約(128B)、checkpoint/truncate の部分ロールバック、unsafe record の接続点 |
| [0006](0006_device-and-execution-model.md) | Device・実行モデルと feature ゲート | 2026-07-02 | ready for review | Device::new の起動列と理由付き reject、単一 queue、closure 形 submit_batch、SubmitTracker(前進のみ)と失敗分類、wait / is_submit_complete、単一 crate + device feature、metadata 見積もり語彙 |
| [0007](0007_pipeline-registration-and-cache.md) | pipeline の登録・解決とキャッシュ | 2026-07-02 | ready for review | 登録(infallible な id 採番)と解決(bind lowering 時の遅延生成)の分離、content hash のみのセッションキャッシュ、空 pipeline layout、SPIR-V 構造検査、検出点を一意に定めたエラー面 |
| [0008](0008_upload-and-readback.md) | upload / readback とデータ転送 | 2026-07-02 | ready for review | UploadBuffer / ReadbackBuffer の型分離、範囲予約 RAII と atom 整列 flush/invalidate、「最後の transfer write の submit 完了」を条件とする非ブロッキング read 契約 |
| [0009](0009_surface-swapchain-present.md) | surface・swapchain・present | 2026-07-02 | ready for review | 中立 SurfaceSource(Win32 / Wayland)、present の DeviceConfig opt-in、決定的な swapchain 生成 plan、同期プリミティブの内包と acquire → 記録 → present の 3 口、世代管理付き再生成 |
| [0010](0010_device-sharing-and-handoff.md) | Device 共有と cross-batch handoff | 2026-07-02 | ready for review | Arc&lt;Device&gt; 共有と publish / consume の 2 宣言、outstanding read 追跡による write-after-read と retire 寿命の担保、検知できる宣言漏れの表と検知の限界 |
| [0011](0011_raw-escape-hatch.md) | raw Vulkan への escape hatch | 2026-07-02 | ready for review | unsafe な raw handle アクセサと raw record タスク、raw access 宣言(最保守)、責務移転の契約 7 項、ambient state 契約、dirty 申告による復帰、語彙昇格の運用 |
| [0012](0012_windowing-crate.md) | windowing クレート orvk-window の新設 | 2026-07-03 | ready for review | window 生成・イベントループ・HDR / 広色域の出力能力観測と safe な surface 供給を担う別クレートを同リポジトリの workspace に新設。コアは windowing を知らないまま、0009 の unsafe 契約を所有側で safe 化する |

## 集計

| status | 本数 |
|---|---|
| approved | 0 |
| ai-approved | 0 |
| ready for review | 12 |
| draft | 0 |
| rejected | 0 |
| 合計 | 12 |

0001〜0011 は同時作成の基盤設計セット、0012 は windowing クレートの新設で、いずれも `ready for review` としてレビューを待っている。
`draft` の運用は [README.md](README.md) の status 節を参照。
