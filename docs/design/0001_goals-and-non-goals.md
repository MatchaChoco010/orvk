# orvk の目標と非目標

- created: 2026-07-02
- updated: 2026-07-02
- status: ready for review
- implementation: not-started

## 解決したい問題

Rust で Vulkan を直接使ってレンダラーや GPU アプリケーションを書くと、descriptor set の管理、barrier と image layout 遷移の手書き、リソース lifetime の追跡という 3 種類の boilerplate が本質的なコードを覆い隠し、しかも誤りが「たまたま動く」形で潜伏する。
orvk はこれらを、bindless descriptor heap・access 宣言からの同期導出・handle と論理レジストリによる lifetime 管理として引き受け、利用者が描画・計算の記述に集中できる Vulkan 専用ラッパーを提供する。

この doc は、その orvk が **何を目標とし、何を恒久的に目標としないか** の境界を確定する。
以降の全 design doc(0002〜0011)はこの枠内で個別領域の詳細を決めるため、この doc は全 doc の親にあたる。
ここで境界を固定しておかないと、個別 doc の議論のたびに「そもそも RHI にすべきでは」「fallback を持つべきでは」という土台の議論が再燃し、設計が収束しない。

## 問題の背景

orvk の要件は、複数の実利用シナリオの横断整理から来ている。
すなわち、(1) window を持たないヘッドレスなテスト・オフライン GPU 計算、(2) 単独の GPU アプリケーションが window に present する形態、(3) レンダラー・GUI 層・アプリケーション本体のような複数のサブシステムが 1 つの Device とリソースレジストリを共有する形態、の 3 つである。
とくに (3) は、サブシステムごとに Device や descriptor 管理を別個に持つと、リソースの受け渡しのたびに所有権と同期の契約を場当たりで発明することになり、これが既存の Vulkan ラッパー群では一貫した契約として提供されていない。

設計の思想的前提は [../philosophy.md](../philosophy.md) にまとめてある。
要点は、対象を Vulkan かつ `VK_EXT_descriptor_heap` の使える環境に絞ることで初めて「descriptor バインドという概念の消去」「access 宣言からの同期の一意導出」が成立する、という立場である。
Vulkan 専用の使いやすいラッパーという同種の立場のライブラリが既に成立していること(参考事例: C++ の Daxa)は、この路線の実行可能性の参考になる。

いまこの doc を書くのは、orvk がこれから 0002〜0011 の設計を一斉に固める段階にあり、全 doc が共有する前提(目標・非目標・確定済みの全体決定)を先に 1 箇所へ固定する必要があるからである。

## この文書では書かないこと

- 各領域の詳細設計。リソースレジストリは [0002](0002_resource-ownership-and-registry.md)、descriptor heap は [0003](0003_bindless-descriptor-heap.md)、同期導出は [0004](0004_access-declaration-and-sync.md)、タスクグラフと記録は [0005](0005_task-graph-and-command-encoder.md)、Device と実行モデルは [0006](0006_device-and-execution-model.md)、pipeline は [0007](0007_pipeline-registration-and-cache.md)、転送は [0008](0008_upload-and-readback.md)、present は [0009](0009_surface-swapchain-present.md)、Device 共有の契約は [0010](0010_device-sharing-and-handoff.md)、escape hatch は [0011](0011_raw-escape-hatch.md) に委ねる。
- 具体的な API シグネチャや型のフィールド構成(各担当 doc で決める)。
- crate 内部のモジュール分割・ファイル構成(実装で安定するまで遅延する。→ [../philosophy.md](../philosophy.md)「正しさを後から補わない」)。
- ライセンスの選定(pre-v1 の間に別途決定する)。

## やらないこと

以下は「今はやらない」ではなく **恒久的な非目標** である。
それぞれ、何を解こうとする案で、なぜ orvk では今後もやらないのかを書く。

- **Vulkan 以外の GPU API backend(RHI 化)をしない。**
  複数 API を抽象する RHI は、1 つのコードベースを Metal / D3D12 等へ移植可能にすることを解く。
  しかし複数 API の最大公約数に合わせた抽象は、descriptor バインド・リソース状態遷移・同期モデルの差異を利用者へ漏らすか、最も貧しい API に合わせて表現力を削るかの二択を迫る。
  orvk の核である「descriptor バインド概念の消去」「access 宣言からの同期の一意導出」は Vulkan(とその拡張)に深く依存して成立しており、backend を足した瞬間にこの核が壊れる(移植性が要る利用者の受け皿は「代替案」の wgpu 参照)。
- **`VK_EXT_descriptor_heap` が使えない環境への fallback(descriptor set ベースの代替経路)を持たない。**
  fallback は古い GPU / driver での動作を解くが、descriptor set の管理を内部に持ち込むと「bindless 前提で消したはずの概念」がライブラリ内部と ABI 契約(shader が受け取る handle の意味)に二重化し、全設計が二枚腰になる。
  対応環境で起動できないことは、起動時の明示エラー(gate)として報告する。黙って劣化経路に落とすことはしない。
- **descriptor set layout / pipeline layout を利用者 API に出さない。**
  これらを出せば Vulkan の生の柔軟性(set 分割による更新頻度の階層化など)が使えるが、bindless heap + push data だけで同じ用途を賄えるのが descriptor heap 前提の利点そのものであり、両方を出すと利用者は常に二方式の選択を迫られる。
  layout は内部の固定形(詳細は [0007](0007_pipeline-registration-and-cache.md))に閉じる。
- **window の生成・管理をしない。**
  windowing はイベントループ・DPI・入力と不可分で、windowing ライブラリ(winit 等)の責務である。
  orvk は surface 生成の入力として自身が定義する中立な native handle 型(Win32 / Wayland)を受け取るだけにする(詳細は [0009](0009_surface-swapchain-present.md))。
- **シェーダのコンパイルをしない。**
  シェーダ言語の選定・コンパイラの同梱はツールチェーンの重い依存を持ち込み、言語ごとの semantics 差異をライブラリが背負うことになる。
  orvk は SPIR-V バイナリを受け取る境界に固定し、どの言語からどう SPIR-V を作るかは利用者の責務とする(詳細は [0007](0007_pipeline-registration-and-cache.md))。
- **uniform ring / staging ring allocator を組み込まない。**
  frame ごとの一時データ用リングアロケータは便利だが、frame の概念・in-flight 数・寿命ポリシーという利用者側の構造への仮定をライブラリに埋め込む。
  orvk は upload / readback の明示的なプリミティブ([0008](0008_upload-and-readback.md))だけを提供し、ring は利用者がその上に自分の frame 構造に合わせて組む。
- **bulk retire / resource bundle(リソースをまとめて破棄する束)を組み込まない。**
  一括破棄はリソースのグルーピングという寿命ポリシーの仮定を持ち込む。
  handle 単位の retire(SubmitId による安全判定つき。→ [0002](0002_resource-ownership-and-registry.md))があれば、束ねる層は利用者側で薄く書ける。
- **複数 Device 間のリソース共有をしない。**
  1 Device = 1 handle 空間・1 レジストリという不変条件([0002](0002_resource-ownership-and-registry.md))が orvk の正しさ保証の土台であり、Device をまたぐ共有はこの土台に external memory・複数タイムラインの整合という別次元の問題を接木する。
  マルチ GPU が必要な利用者は Device を複数作り、転送は自前で組む。
- **別プロセスとのリソース共有(external memory / external semaphore)をしない。**
  プロセス境界を越えた寿命・同期の契約は OS 依存が強く、単一プロセス内のレジストリ整合という orvk の保証モデルの外にある。

なお、記録語彙への「コマンドや記述の追加」(image→image blit、compute の indirect dispatch、specialization constants など)は上記の恒久非目標には含めない。
これらは列挙済み項目とは別カテゴリであり、実需が証明されたときに各担当 doc の枠内で追加を検討してよい(→ [0005](0005_task-graph-and-command-encoder.md) / [0007](0007_pipeline-registration-and-cache.md))。

## 概要

orvk は、C++ における Daxa と同じ立場の **Vulkan 専用ラッパーライブラリ**(Rust、単一 crate)である。
複数の GPU API を抽象する RHI ではなく、対象を Vulkan 1.3 + `VK_EXT_descriptor_heap` に絞ることで、浅く広い互換性ではなく深い一貫性を取る。

目標は次の 5 つである。

1. **bindless 前提**: descriptor set のバインド操作を利用者から消し、リソースは handle、shader へは `DescriptorHandle`(uint2)で渡す(→ [0003](0003_bindless-descriptor-heap.md))。
2. **宣言的同期**: 描画・計算は TaskGraph にタスクとして記録し、各タスクの access 宣言から barrier・semaphore・layout 遷移を導出する。手書き barrier を通常経路に置かない(→ [0004](0004_access-declaration-and-sync.md) / [0005](0005_task-graph-and-command-encoder.md))。
3. **headless 完結**: リソース生成 → 記録 → submit → 完了観測 → readback が window なしで完結する。present は選択機能であって前提ではない(→ [0006](0006_device-and-execution-model.md) / [0008](0008_upload-and-readback.md) / [0009](0009_surface-swapchain-present.md))。
4. **Device 共有**: 単一プロセス内の複数サブシステムが 1 つの Device とレジストリを共有し、batch をまたぐリソースの受け渡しを publish / consume の契約で行える(→ [0010](0010_device-sharing-and-handoff.md))。
5. **raw への escape hatch**: 記録語彙に無い Vulkan 機能は、raw handle への unsafe な口から使える。安全な語彙の内側と利用者責任の外側を型の境界で分ける(→ [0011](0011_raw-escape-hatch.md))。

実行モデルの語彙は次の積み重ねになっている。
描画・計算はタスクとして TaskGraph に記録し、タスク内のコマンド発行は CommandEncoder が担う。
記録された仕事は Batch という submit の単位にまとめられ、1 回の submit が 1 つの SubmitId を返す(→ [0005](0005_task-graph-and-command-encoder.md) / [0006](0006_device-and-execution-model.md))。

非目標(他 backend、fallback、layout 露出、window 管理、シェーダコンパイル、ring allocator、bulk retire、マルチ Device 間共有、プロセス間共有)は「やらないこと」で確定した。
pre-v1 の間は API を正しい形へ試行錯誤し、互換性維持のための旧 API・移行 alias を残さない(「詳細設計」参照)。

## シナリオ / ユースケース

orvk が支える利用形態は次の 3 つで、いずれも同じ記録語彙・同じ同期導出の上に立つ。

1. **standalone(headless)**。
   CI 上の GPU テストやオフラインの画像処理が、window を作らずに Device を生成し、compute を dispatch して結果を readback する。
   完了待ちはブロッキングの `wait(SubmitId)` で足りる。
   headless が「もう一つの入口」として一級である(mock ではない)ことが、ライブラリ自身と利用者のテスト容易性を決める。
2. **単独アプリケーション**。
   1 つのアプリが winit 等で window を作り、その native handle を orvk に渡して surface / swapchain を作り、frame ごとに TaskGraph を記録して submit / present する。
   frame をまたぐ readback(ピッキングやスクリーンショット)は `is_submit_complete(SubmitId)` によるポーリングで待たずに回収する。
3. **複数サブシステムによる Device 共有**。
   レンダラー・GUI 層・アプリケーション本体のようなサブシステムが 1 つの Device を共有する。
   たとえばレンダラーが自分の Batch(submit の単位。「概要」)でオフスクリーン image に描画し、その image handle と最終 access 状態を publish し、GUI 層が自分の Batch でそれを consume してテクスチャとして合成する。
   handle 空間とレジストリが 1 つなので、受け渡しは handle のコピーで済み、同期は publish / consume の宣言から導出される(→ [0010](0010_device-sharing-and-handoff.md))。

## 詳細設計

この doc の「詳細設計」は、個別領域の設計ではなく、全 doc が従う **確定済みの全体決定** とその根拠である。
各項目の深掘りは括弧内の担当 doc が行う。

### ライブラリの立場: Vulkan 専用ラッパーであって RHI ではない

orvk が提供するのは「Vulkan を安全で simple な語彙に写像した API」であり、「GPU 一般を抽象した API」ではない。
利用者は自分が Vulkan の上にいることを知っており、Vulkan の概念(queue、submit、SPIR-V、image layout の存在)を前提にしてよい。
ラッパーが消すのは概念そのものではなく、その **手動管理**(descriptor バインド、barrier の手書き、lifetime の目視追跡)である。
この立場の根拠と、RHI との比較は [../philosophy.md](../philosophy.md) と「代替案」に書いた。

### 確定済みの全体決定

1. **単一 crate**。記録語彙・レジストリ・検証は feature なしでコンパイル可能とし、Vulkan 実行(instance / device 生成、submit)は device feature(既定 on)でゲートする。これにより、GPU の無い CI でも記録と検証のテストが回る([0006](0006_device-and-execution-model.md))。
2. **1 Device = 1 handle 空間**。リソースの論理レジストリは Device が所有し、handle は index + generation の u64 パックで retire 後の誤用を検出する([0002](0002_resource-ownership-and-registry.md))。
3. **実行は Batch 単位の submit**。`SubmitId` で完了を追跡し、`wait`(ブロッキング)と `is_submit_complete`(ポーリング)の両方を公開する([0006](0006_device-and-execution-model.md))。
4. **シェーダは SPIR-V を受け取る**。descriptor set / pipeline layout は利用者 API に出さず、bindless + push data のみを契約とする([0007](0007_pipeline-registration-and-cache.md))。
5. **`VK_EXT_descriptor_heap` 必須**(fallback なし、起動 gate で明示エラー)。Vulkan 1.3 を前提とする(dynamic rendering / synchronization2 は 1.3 で必須 feature のため自動的に含まれる。[0006](0006_device-and-execution-model.md))。
6. **combined image sampler は語彙に入れない**。image と sampler は独立に publish し、storage image descriptor は sampled と同格に扱う([0003](0003_bindless-descriptor-heap.md))。
7. **window は所有しない**。surface 入力は orvk 自身が定義する中立 native handle 型(Win32 / Wayland)で受け取る([0009](0009_surface-swapchain-present.md))。
8. **silent trap を残さない**。対応しない入力・使えない機能は黙って無視せず明示エラーにする。正しさ(handle の世代検証、access 宣言と記録の整合、retire の安全判定)は最初から test 可能な不変条件として固定する(→ [../philosophy.md](../philosophy.md)「正しさを後から補わない」)。この保証の範囲は **CPU 側 API サーフェス** である。GPU 可視データに埋め込まれた `DescriptorHandle` の stale 使用は CPU 側では検出できない(「落とし穴」参照。緩和策の有無は [0003](0003_bindless-descriptor-heap.md) が扱う)。
9. **queue は単一**。v1 スコープでは graphics + compute + transfer を兼ねる単一 queue を使い、async compute / transfer queue は語彙に入れない(必要になったら本 doc を supersede する)。queue モデルとスレッド安全性(Device の Send/Sync、並行記録・並行 submit の可否)の確定は [0006](0006_device-and-execution-model.md) が行い、[0004](0004_access-declaration-and-sync.md) / [0010](0010_device-sharing-and-handoff.md) はその決定に従属する。

これらは覆す代償が最も大きい決定なのでこの doc で確定し、各 doc はこの枠内で自領域の詳細を決める。
個別 doc の議論でこの 9 項目を覆したくなった場合は、その doc 内で覆すのではなく、この doc を supersede する新番号の doc を立てる。

### 目標と基盤機構の責務分担

表の「記録と実行」は目標の 1 項目ではなく、目標 2(宣言的同期)と目標 3(headless 完結)を支える基盤機構である。

| 目標 / 基盤機構 | 中心となる契約 | 担当 doc |
|---|---|---|
| bindless 前提 | DescriptorRef / DescriptorHandle、resource heap / sampler heap の 2 ヒープ | [0003](0003_bindless-descriptor-heap.md) |
| 宣言的同期 | AccessSet / access 宣言 / ResourceTransition の導出 | [0004](0004_access-declaration-and-sync.md) |
| 記録と実行 | TaskGraph / CommandEncoder、Batch / submit / SubmitTracker | [0005](0005_task-graph-and-command-encoder.md) / [0006](0006_device-and-execution-model.md) |
| headless 完結 | upload / readback、present の選択機能化 | [0008](0008_upload-and-readback.md) / [0009](0009_surface-swapchain-present.md) |
| Device 共有 | publish / consume による cross-batch handoff | [0010](0010_device-sharing-and-handoff.md) |
| escape hatch | raw handle への unsafe アクセスと責務移転の境界 | [0011](0011_raw-escape-hatch.md) |

### pre-v1 の進め方

orvk は pre-v1 であり、API を正しい形へ試行錯誤している段階である。
この段階の規律を次のとおり固定する。

- **互換性維持のための旧 API・旧契約・移行用 alias を残さない。** 正しい形が決まったら、古い形は同じ変更で削除または非公開化し、利用箇所を全面的に新 API へ揃える。deprecated を積む段階的 migration は取らない。
- **正しさの仕様(handle の同一性、retire の遅延規則、submit 失敗時の状態、完了観測の意味論)は最初から不変条件として定義し、test で固定する。** 「後で仕様化する」を正しさについては認めない。
- **構造の物理的な形(モジュール分割、将来の crate 分割)と最適化は、実需と実装の安定が証明するまで遅延する。** 固定すべきもの(正しさ)と遅延すべきもの(形と速度)の区別が simple over easy の実践である(→ [../philosophy.md](../philosophy.md))。
- 設計変更は design doc の新番号で記録し、旧 doc は残す(→ [README.md](README.md))。

## 落とし穴

- **対応環境が狭い。** `VK_EXT_descriptor_heap` 必須のため、拡張を実装しない GPU / driver では orvk はまったく起動しない(明示エラーで停止する)。利用者は自分のターゲット環境の driver 対応状況を先に確認する必要があり、「とりあえず古いマシンでも動く」ことを期待できない。
- **移植の道が無い。** RHI ではないので、将来 Metal / D3D12 で動かす必要が生じた場合、orvk の上に書いたコードは orvk ごと別の基盤へ書き直しになる(移植性が要る利用者の受け皿は「代替案」の wgpu 参照)。
- **GPU 可視データに埋め込まれた stale `DescriptorHandle` は検出できない。** `DescriptorHandle` は buffer 等の GPU 可視データに書き込まれて frame をまたいで生存し得るため、retire 後に heap slot が再利用されると、古い handle 経由のシェーダアクセスは CPU 側の世代検証では検出されず silent に誤った資源を読む。全体決定 8 の保証は CPU 側 API サーフェスに限られる。GPU 側での緩和策(slot 再利用の遅延、debug 時の generation 照合)の有無は [0003](0003_bindless-descriptor-heap.md) が扱う。
- **X11 セッションでは present が使えない。** surface 対応は Win32 / Wayland のみで、Linux の X11(xlib / xcb)セッションでは present 経路が使えない(headless 実行は可能)。
- **シェーダツールチェーンは利用者持ち。** SPIR-V を作る手段(コンパイラの選定、ビルド統合、リフレクション)を orvk は提供しない。push data の ABI([0003](0003_bindless-descriptor-heap.md))とシェーダ側コードの整合は利用者が保つ。
- **surface の native handle の有効性は利用者責任。** orvk は渡された Win32 / Wayland handle が window の生存中であることを検証できない。window 破棄後の handle 使用は未定義動作になり得る([0009](0009_surface-swapchain-present.md))。
- **escape hatch は保証の放棄と引き換え。** raw handle に触れた瞬間、そのリソースに関するレジストリ整合・同期の保証は利用者へ移る([0011](0011_raw-escape-hatch.md))。「少しだけ raw を混ぜる」使い方は、混ぜた範囲の hazard 管理を丸ごと引き受けることを意味する。raw で状態(layout / access)を変えたリソースを安全な語彙へ戻すには現在状態の再宣言が必要であり、その復帰契約と、pipeline 生成のような記録語彙外の面をどこまで raw で賄えるかの境界は [0011](0011_raw-escape-hatch.md) が定義する。
- **pre-v1 の破壊的変更。** 上記「pre-v1 の進め方」のとおり、v1 まで API は予告なく形を変える。追従コストを払えない利用者にはまだ勧められない。

## 代替案

- **wgpu 等の既存 RHI を使う(ライブラリを新規に書かない)。**
  wgpu は WebGPU 仕様に基づく Rust の成熟した GPU 抽象で、Vulkan / Metal / D3D12 / GL の上で同一 API を提供する。
  - Pros: 移植性が最初から手に入る。実績・エコシステム・ドキュメントが豊富。自前実装の保守コストがゼロ。
  - Cons: WebGPU の抽象は複数 API の共通部分に合わせるため、`VK_EXT_descriptor_heap` のような Vulkan 固有拡張を核に据えた設計ができない。bind group という descriptor バインド概念が API の中心にあり、「バインド操作を利用者から消す」という orvk の第一目標と正面から衝突する。Device やリソースの共有自体は wgpu でも可能だが、access 状態の明示的な handoff 契約(publish / consume)と cross-batch の完了追跡を利用者制御の一級 API として提供する形にはできない。
  - 見送り理由: orvk の目標(bindless の徹底、宣言からの同期導出、Device 共有契約)は Vulkan 専用に絞って初めて成立するもので、RHI の上に後付けできない。移植性という RHI の対価は、orvk の想定利用者(Vulkan を選び切ったレンダラー開発)には目標より優先度が低い。
- **raw Vulkan ユーティリティ集に留める(instance 生成 helper、allocator 統合、swapchain helper 程度の薄い層)。**
  Vulkan API はそのまま露出し、初期化の boilerplate だけを削る案である。
  - Pros: 実装が小さく、Vulkan の全機能が常にそのまま使える。ライブラリの設計判断が利用者を縛らない。学習コストは Vulkan 本体の知識にほぼ一致する。
  - Cons: descriptor 管理・barrier・lifetime という 3 大 boilerplate と silent trap(誤った barrier がたまたま動く等)がそのまま残る。同期・寿命の正しさをライブラリが不変条件として保証できず、テストで固定する対象が存在しない。複数サブシステムの Device 共有も、契約を定義する主体がいないため場当たりの取り決めになる。
  - 見送り理由: orvk が解こうとしている問題(「解決したい問題」)のほぼ全部が残る。helper 集は既存の ash エコシステムで足りており、新規ライブラリを立てる意味がない。
- **複数 GPU API を抽象する RHI を自作する。**
  wgpu を使わず、自分の設計思想で Metal / D3D12 まで覆う抽象を書く案である。
  - Pros: 移植性と自前の設計思想を両立できる可能性がある。
  - Cons: 「やらないこと」冒頭に書いたとおり、API 差異を利用者へ漏らすか表現力を削るかの二択に加えて、実装・検証コストが backend 数に比例して膨らむ。orvk の核となる契約はいずれも Vulkan の機能に立脚しており、抽象化した時点で核が薄まる。
  - 見送り理由: 得られる移植性は wgpu の劣化再発明にしかならず、失うもの(核の一貫性)が大きすぎる。

## セキュリティ・プライバシー

orvk が受け取る外部入力は SPIR-V バイナリと native surface handle であり、機微な個人データは扱わない。
SPIR-V の内容の検証(悪意あるシェーダの検出)はスコープ外で、信頼できるシェーダを渡すのは利用者の責務である(GPU driver 側の保護に委ねる)。
unsafe の境界(escape hatch、native handle の受け取り)は API 上で明示し、安全な語彙の内側ではメモリ安全と handle の有効性検証を保証する。
個別領域での具体的な検討は各担当 doc で行う。

## 負荷・コスト

この doc 自体は方針の確定であり、単独ではランタイムの hot path に何も足さない。
ただし確定した方針が全体として背負うコストの枠を明示しておく。

- **レジストリと access 宣言のオーバーヘッドは「リソース数・タスク数・宣言数に比例する CPU 仕事」として現れる。** 導出される barrier は手書きの最適解(split barrier、stage mask の最小化)より保守的になり得るが、正しい手書きと同等を目標とし、過剰同期の度合いは [0004](0004_access-declaration-and-sync.md) / [0005](0005_task-graph-and-command-encoder.md) が測定可能な形で扱う。各コストの見積もりと設計トレードオフは [0002](0002_resource-ownership-and-registry.md) / [0004](0004_access-declaration-and-sync.md) / [0005](0005_task-graph-and-command-encoder.md) が持つ。
- **handle の世代検証・記録時の整合検証は記録経路の定数オーバーヘッドである。** 違反が未定義動作や黙った誤動作に化ける検証(handle の世代検証、retire の安全判定、access 宣言と記録の整合)は release ビルドでも維持する。間引いてよいのは、間引いても違反が別経路の明示エラーとして検出される補助診断に限る。
- **fallback を持たないことはランタイムコストを削る方向に働く。** 実行時の経路分岐(heap 方式 / set 方式)が存在しないため、descriptor 更新は常に単一の直書き経路で済む。
