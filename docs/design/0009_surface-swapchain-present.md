# surface・swapchain・present

- created: 2026-07-02
- updated: 2026-07-03
- status: ready for review
- implementation: not-started

## 解決したい問題

window へ描画結果を表示するには、Vulkan の surface・swapchain・present を正しく運用する必要がある。
しかし swapchain は Vulkan の中でも落とし穴が多い領域であり、image count の選定、present mode と surface format の選択、resize や画面遷移に伴う再生成(OutOfDate / Suboptimal)、acquire と present をまたぐ semaphore / fence の同期を、利用者が生で書くと同じ判定が複数箇所に分散して drift する。
本 doc は、orvk が surface 入力をどう受け取り、swapchain の生成・acquire・present・再生成をどの範囲で内包し、利用者にどの口だけを見せるかを決める。
これにより利用者は「acquire → 記録 → present」という 3 つの口だけで window 表示を書け、swapchain 固有の同期と再生成の正しさは orvk 側の test 可能な不変条件になる。

## 問題の背景

orvk は window を所有しない(0001)。
window の生成・イベントループ・寿命管理は利用者(windowing ライブラリ)の責務であり、orvk は表示先の識別情報だけを受け取って VkSurfaceKHR と swapchain を作る。
一方で orvk は headless 実行(window なしの submit → readback)も第一級の入口として支える(0001 / 0006)。
つまり present は「常に在る前提」ではなく、Device 生成時に選択される機能である。
present を選択しない Device では surface 用 instance extension や `VK_KHR_swapchain` を要求しないため、swapchain API はそもそも実行できない。
この「選択されていない機能の呼び出し」を黙って無視したり未定義動作にしたりせず、明示エラーとして報告する境界を仕様として固定する必要がある(philosophy「正しさを後から補わない」)。

また、swapchain image は利用者が生成したリソースではないのに、タスクグラフの access 宣言(0004)と論理レジストリ(0002)の枠内で他のリソースと同じように扱えなければならない。
「swapchain image だけ別の同期経路」を作ると、同期の判断点を access 宣言に一本化した設計(philosophy)が崩れる。
swapchain image をレジストリ・access 宣言・Batch submit(0006)の語彙へどう接続するかも本 doc の担当である。

## この文書では書かないこと

- window の生成・イベントループ・DPI / スケーリングの扱い。windowing は orvk の責務外である(0001)。
- readback 経路そのもの(readback buffer の型、flush / invalidate、完了待ち)。0008 が担当する。本 doc は swapchain image を readback 元にするための TRANSFER_SRC opt-in だけを決める。
- access 宣言から barrier を導出する仕組み(0004)と、TaskGraph / CommandEncoder の記録語彙(0005)。swapchain image はそれらの既存語彙に乗る側であり、語彙自体は変えない。
- Device 生成・queue 選定・submit / SubmitId の実行モデル(0006)。本 doc は present 用途の opt-in フラグが DeviceConfig に載ることと、present が submit にどう接続するかだけを書く。
- HDR メタデータや色空間の高度な管理。surface format の選択(colorSpace を含む)までを本 doc で決め、それ以上の色管理はライブラリ外の関心とする。

## やらないこと

- **外部 windowing ライブラリとの統合(専用の変換 trait や feature をコア側に持つこと)はやらない。**
  特定の windowing crate の handle 型をコアの API が直接受け取れるようにすると、依存のバージョン結合が生まれ、コアが特定エコシステムを知ることになる。
  orvk 自身が定義する中立 handle 型への変換は利用者側の数行で書けるため、統合の便益は依存コストに見合わない。
  エコシステム側の handle 標準が十分安定した将来に、feature ゲート付きの変換実装として再検討しうる(この設計の枠は変えない)。
  なお同リポジトリの orvk-window([0012](0012_windowing-crate.md))はコアの外の利用者側に立つ別クレートであり、この非目標(コアが windowing を知らない)と矛盾しない。
- **exclusive fullscreen の制御、present timing / latency 制御(present wait 等)、frame pacing はやらない。**
  これらは拡張 extension と OS 依存の挙動が絡む領域であり、必要になった時点で新しい doc として設計する。
  それまでは raw escape hatch(0011)で利用者が直接扱う。
- **swapchain image の descriptor publish(sampled / storage としてシェーダから参照させること)はやらない。**
  swapchain image の用途は color attachment(と readback 元)に限定する。
  swapchain image をシェーダ入力にしたい場合は、利用者が自前の image に描いてから swapchain image へ転送・描画すればよい。
  present engine が所有権を持つ image を bindless heap(0003)へ載せると、有効期間の追跡が acquire / present の世代と絡み合うため、実需が出るまで導入しない。
- **1 つの Device に対する swapchain 数の制限はしないが、複数 window の同時 present を 1 回の submit にまとめる最適化はやらない。**
  swapchain ごとに独立に acquire / present すればよく、まとめ present は実需が証明されてから検討する。

## 概要

surface 入力は、orvk 自身が定義する中立な native handle 型 `SurfaceSource`(Win32: HWND / HINSTANCE、Wayland: display / surface ポインタ)で受け取る。
window の生成と寿命は利用者責務で、orvk はポインタの有効性を検証できないため、swapchain 生成 API は unsafe 境界に置く。

present 用途は DeviceConfig で opt-in する(0006)。
opt-in していない Device で swapchain API を呼ぶと、機能未選択を示す明示エラーを返す(silent trap を残さない)。

swapchain の生成は決定的な plan に従う。
image count は「surface 能力の最小値 + 1」を能力の上限でクランプし、present mode は既定 Fifo(環境変数で上書き可、未対応値は明示エラー)、surface format は利用者の希望候補列と対応表の突合(全滅なら明示エラー)、extent は surface 能力の範囲へクランプする。

フレームの口は acquire → 記録 → present の 3 つだけである。
acquire はレジストリ登録済みの ImageHandle を持つ frame トークンを返し、利用者はそれを通常の access 宣言(0004)で TaskGraph(0005)に記録し、Batch の submit(0006)に present を紐づける。
acquire semaphore・render finished semaphore・in-flight fence は orvk が内部に持ち、利用者には見せない。

resize 等で swapchain が古くなったことは acquire / present の返り値(OutOfDate / Suboptimal)で報告し、再生成は利用者が新しい extent を渡して明示的に呼ぶ。
再生成は `oldSwapchain` 連結で行い、swapchain に世代番号を振って古い世代の frame トークンの present を拒否する。

readback(0008)のために swapchain image を転送元にする用途は、生成時の TRANSFER_SRC opt-in で選択する。

## シナリオ / ユースケース

利用者が windowing ライブラリで window を作り、orvk で描画して表示する典型形を示す(型・関数名は説明用の仮のもの)。

```rust
// 1. Device を present opt-in で作る(0006)
let device = Device::new(DeviceConfig {
    present: PresentSupport::Enabled,
    ..Default::default()
})?;

// 2. window から native handle を取り出し、swapchain を作る
//    (ポインタの有効性は利用者責務なので unsafe)
let source = SurfaceSource::Win32 { hwnd, hinstance };
let mut swapchain = unsafe {
    device.create_swapchain(source, SwapchainConfig {
        extent: [width, height],
        format_candidates: SwapchainConfig::default_format_candidates(),
        transfer_src: false,
    })
}?;

// 3. フレームループ: acquire → 記録 → present
loop {
    let frame = match swapchain.acquire() {
        Ok(frame) => frame,
        Err(AcquireError::OutOfDate) => {
            // 新しい extent は window 側の知識なので利用者が渡す
            swapchain.recreate([new_width, new_height])?;
            continue;
        }
        Err(e) => return Err(e.into()),
    };

    // 記録は 0006 の closure 形の submit_batch に閉じる。
    // frame.image() は通常の ImageHandle。access 宣言は他リソースと同じ(0004)
    let receipt = device.submit_batch(|batch| {
        let graph = batch.task_graph();
        graph.task("draw")
            .write(frame.image(), ImageRange::full(), AccessState::color_attachment_write())
            .record(|enc| { /* begin_rendering / draw ... */ })?;
        batch.present(frame); // present 宣言。semaphore 接続は orvk が内部で行う
        Ok(())
    })?;

    match receipt.present_outcome() {
        PresentOutcome::Ok => {}
        PresentOutcome::Suboptimal => { /* 次の機会に recreate を促す */ }
        PresentOutcome::OutOfDate => { swapchain.recreate([w, h])?; }
    }
}
```

headless の利用者(standalone ツール、テスト)はこのシナリオに一切触れない。
`present: PresentSupport::Disabled` で Device を作れば surface 系 extension は要求されず、誤って `create_swapchain` を呼べば `Error::PresentNotEnabled` が返る。

## 詳細設計

サブセクションの目次:

1. **中立 surface handle 型** — `SurfaceSource` の形と unsafe 境界。
2. **present opt-in と明示エラー** — DeviceConfig との接続、headless Device での挙動。
3. **swapchain 生成 plan** — image count / present mode / surface format / extent の決定規則。
4. **swapchain image とレジストリ・access 宣言の接続** — ImageHandle としての扱いと制約。
5. **acquire / present と同期の内包** — frame トークン、semaphore / fence の責務と公開範囲。
6. **再生成と世代管理** — oldSwapchain 連結、OutOfDate / Suboptimal の報告、旧世代の拒否。
7. **readback 用 TRANSFER_SRC opt-in** — 0008 への接続。

### 1. 中立 surface handle 型

surface の入力は orvk 自身が定義する enum で受け取る。

```rust
pub enum SurfaceSource {
    Win32 {
        hwnd: NonNull<c_void>,
        hinstance: NonNull<c_void>,
    },
    Wayland {
        display: NonNull<c_void>,
        surface: NonNull<c_void>,
    },
}
```

- 対応プラットフォームは Win32 と Wayland の 2 つから始める。variant の追加は非破壊なので、他プラットフォームは実需が出た時点で足す。
- orvk はこのポインタが有効な window / display を指していることを検証できない。
  そのため `SurfaceSource` を受け取る swapchain 生成 API は `unsafe fn` とし、「ポインタが有効であること」「swapchain(と Device)の破棄まで window が生存すること」を安全条件として文書化する。
  unsafe の境界を型と API で明示するのは escape hatch(0011)と同じ態度である。
- VkSurfaceKHR の生成・破棄は orvk が行う。
  surface は swapchain と 1:1 で orvk 内部に保持し、利用者 API には出さない。
  surface を独立に公開すると、instance との寿命結合と「どの swapchain がどの surface を使っているか」の追跡が利用者側に漏れるためである。
  raw の VkSurfaceKHR が必要な場合は escape hatch(0011)から取得できる。

### 2. present opt-in と明示エラー

present 用途は DeviceConfig(0006)のフィールドで opt-in する。

- opt-in した Device は、instance に `VK_KHR_surface` + プラットフォーム surface extension、device に `VK_KHR_swapchain` を要求する。
  要求が満たせない環境では Device 生成自体が明示エラーで失敗する(起動 gate。0006 の feature gate と同じ枠)。
- opt-in していない Device で `create_swapchain` を呼ぶと `Error::PresentNotEnabled` を返す。
  panic や未定義動作ではなく Result のエラーとするのは、present の有無が実行環境(CI の headless ランナー等)に依存する構成で、利用者が実行時に分岐・報告できるようにするためである。
- opt-in の有無で分かれるのは swapchain API の可用性だけであり、記録・submit・readback の語彙は共通である。
  headless 実行が「もう一つの入口」として同じ経路に立つ(philosophy)ことを、API の形として保証する。

### 3. swapchain 生成 plan

swapchain の生成パラメータは、利用者入力と surface 能力(capabilities)から決定的に導出する。
「ドライバ依存で挙動が変わる暗黙の選択」を残さないため、各項目の決定規則を仕様として固定する。

**image count。**
`min_image_count + 1` を基準とし、能力の `max_image_count`(0 は無制限)でクランプする。
+1 は、present engine が保持中の image を待たずに次の acquire を進められるようにするための定石であり、これを既定として固定する。
利用者による image count の直接指定は設けない(必要になった実需が枠を決めるまで、選択肢を増やさない)。

**present mode。**
既定は Fifo とする。
Fifo は Vulkan 仕様で常にサポートが保証される唯一の mode であり、既定が環境によって使えないという分岐を消せる。
デバッグ・計測用に環境変数 `ORVK_PRESENT_MODE`(`fifo` / `fifo_relaxed` / `mailbox` / `immediate`)で上書きできる。
上書き値が surface でサポートされない場合、Fifo へ黙って fallback せず swapchain 生成を明示エラーで失敗させる。
「mailbox を指定したのに Fifo で計測していた」という silent trap を残さないためである。
環境変数はデバッグの口であり、プログラムからの API としての present mode 指定は設けない(実需が出たら SwapchainConfig に足せる非破壊の拡張である)。

**surface format。**
利用者が `format_candidates`(format + colorSpace の優先順リスト)を渡し、surface の対応リストと突合して最初に一致した候補を採用する。
全候補が不一致の場合は、対応リストを含む明示エラーで失敗する。
利用者の知らない format を orvk が勝手に選ぶと、描画側の format 前提(pipeline の color format、0007)と食い違う silent trap になるためである。
一般的な既定候補列(8bit BGRA/RGBA の sRGB / UNORM 系)を返すヘルパーを提供し、こだわりのない利用者はそれを渡せばよい。

**extent。**
能力の `currentExtent` が固定値ならそれを採用する。
`currentExtent` が未定(0xFFFFFFFF。Wayland が典型)の場合は、利用者が渡した希望 extent を能力の min / max でクランプして採用する。
クランプ後の extent に 0 の軸がある場合(window 最小化が典型)、swapchain は生成できないため明示エラー `Error::ZeroExtent` で失敗させる。
黙って 1x1 等に丸めると「見えないが動いている」状態になり、利用者が最小化を検知して描画をスキップする機会を奪うためである。

### 4. swapchain image とレジストリ・access 宣言の接続

swapchain の各 image は、生成時に論理レジストリ(0002)へ ImageHandle として登録する。
これにより access 宣言(0004)・TaskGraph(0005)・barrier 導出は、swapchain image を利用者生成の image と同じ語彙で扱える。
「swapchain image だけ別の同期経路」を作らないことが、この接続の目的である。

ただし所有権が present engine と共有される特殊性から、次の制約をレジストリ側の不変条件として課す。

- **利用者は swapchain image を retire できない。**
  retire(0002)を呼ぶと明示エラーになる。
  破棄は swapchain の再生成・破棄に伴って orvk が行う。
- **descriptor publish の対象にしない**(「やらないこと」参照)。
  usage は COLOR_ATTACHMENT(+ opt-in の TRANSFER_SRC)に限定され、bindless heap(0003)には載らない。
- **present 直前の image layout 遷移は orvk が導出する。**
  利用者は「このタスクで color attachment として書く」という通常の access 宣言だけを書き、PRESENT_SRC への最終遷移は present 宣言(下記 5)から barrier 導出(0004)の枠内で自動挿入される。

### 5. acquire / present と同期の内包

swapchain 利用の同期プリミティブは orvk が内包し、利用者には acquire → 記録 → present の口だけを見せる。

**frame トークン。**
`acquire()` は `SwapchainFrame`(以下 frame)を返す。
frame は「acquire 済みで present 待ちの image」を表す線形トークンであり、ImageHandle・swapchain 世代番号・suboptimal フラグを持つ。
present は frame を消費(move)するため、同じ acquire を二重に present する誤りは型で防がれる。
frame を present せずに drop した場合、orvk は内部の acquire semaphore を再利用できず frame slot が回収不能になるため、drop 検知でエラーとして報告する(黙った leak にしない)。
描画をスキップしたい frame は `swapchain.discard(frame)` で明示的に返却する。

**同期プリミティブの責務。**
orvk は frame ごとの同期セット(acquire semaphore / render finished semaphore / in-flight fence)をリングとして内部に持つ。

- acquire semaphore: `vkAcquireNextImageKHR` が signal し、その image に書く Batch の submit が wait する。
- render finished semaphore: 当該 Batch の submit が signal し、`vkQueuePresentKHR` が wait する。
- in-flight fence: 同期セットの再利用前に、前回その同期セットを使った submit の完了を待つ。
  `acquire()` の内部でこの wait を行うため、frames in flight の上限は同期セットのリング長として orvk 側で規律される。

これらはいずれも利用者 API に出さない。
semaphore を公開すると、wait / signal の接続誤りという Vulkan 最悪級の silent trap を利用者側に開くことになり、同期を access 宣言へ一本化した設計と矛盾するためである。

**present の宣言と submit への接続。**
present は独立した関数呼び出しではなく、Batch の submit(0006)に frame を添える形で宣言する。
submit は wait semaphore に acquire semaphore を、signal semaphore に render finished semaphore を接続し、queue submit の直後に `vkQueuePresentKHR` を発行する。
present を submit に紐づけるのは、「どの GPU 仕事の完了を待って表示するか」が submit の単位でしか定義できないためである。
present の結果(Ok / Suboptimal / OutOfDate)は submit の返り値経由で利用者へ報告する。

**完了追跡との関係。**
present を含む submit も通常どおり SubmitId(0006)を返し、wait / is_submit_complete で完了を追跡できる。
present 自体の完了(実際に画面に出た時刻)は Vulkan の基本機能では観測できないため、契約に含めない(「やらないこと」の present timing 参照)。

### 6. 再生成と世代管理

**報告。**
swapchain が surface と合わなくなったことは、`acquire()` と present 結果の両方から報告される。

- OutOfDate: その swapchain ではもう present できない。エラーとして返し、frame は発行しない。
- Suboptimal: present は成功する(または acquire は image を返す)が、surface と特性が一致していない。
  成功扱いのうえフラグで報告し、無視し続けることも(劣化を許容するなら)できる。

**再生成は利用者の明示呼び出し。**
`swapchain.recreate(new_extent)` を利用者が呼ぶ。
orvk が OutOfDate を検知して黙って再生成することはしない。
新しい extent は window イベント側の知識であり orvk からは見えないこと、再生成のタイミング(resize 中は毎フレームやらない等)は利用者のフレームループの判断であることが理由である。

**oldSwapchain 連結と破棄の遅延。**
recreate は `VkSwapchainCreateInfoKHR::oldSwapchain` に旧 swapchain を渡して新 swapchain を作る。
旧 swapchain とその image の破棄は、旧 image に触れた全 submit の terminal 完了(SubmitTracker、0006)を待って行う(retire の遅延破棄と同じ枠、0002)。
旧 image の ImageHandle はレジストリ上 retire され、以後の access 宣言は世代不一致で拒否される(0002 の generational 検証がそのまま効く)。

**世代番号。**
swapchain 自体にも単調増加の世代番号を振り、frame トークンに焼き込む。
recreate 後に旧世代の frame を present しようとした場合、世代不一致の明示エラーで拒否する。
acquire 済み・未 present の frame を持ったまま recreate した場合も同様に、その frame は present 不能(discard のみ可能)になる。
「古い swapchain への present がドライバ依存の挙動で通ったり通らなかったりする」状態を、orvk の検証で決定的なエラーに変える。

### 7. readback 用 TRANSFER_SRC opt-in

swapchain image をスクリーンショット等で readback(0008)の転送元にする用途のため、SwapchainConfig の `transfer_src: bool` で image usage に TRANSFER_SRC を追加できる。

- opt-in 制にするのは、usage の追加が一部環境で present の最適経路を阻害しうるためで、必要な利用者だけがコストを払う。
- opt-in していない swapchain image を copy_image_to_buffer(0005)の転送元に宣言した場合、記録時の静的検証(0004 / 0005 の access 整合検証)で明示エラーになる。
- surface 能力の `supportedUsageFlags` が TRANSFER_SRC を含まない環境では、opt-in した生成を明示エラーで失敗させる(黙って usage を落とさない)。

## 落とし穴

- **Wayland では希望 extent の指定が必須である。**
  `currentExtent` が未定のため、利用者が window サイズを自分で追跡して渡す必要がある。
  誤ったサイズを渡してもクランプ内なら生成は成功し、表示がスケール・クロップされる(これは orvk からは検出できない)。
- **window 最小化中は swapchain を作れない。**
  `Error::ZeroExtent` が返るので、利用者のフレームループは最小化中の描画スキップを自分で書く必要がある。
  「recreate を呼べば常に成功する」と仮定したループはここで壊れる。
- **`ORVK_PRESENT_MODE` の上書きは環境によって起動失敗になる。**
  未対応 mode の指定は明示エラーなので、この環境変数を設定したまま別マシンで実行すると swapchain 生成に失敗する。
  これは silent fallback を拒否した設計の意図した帰結であり、環境変数はデバッグ用途に限る。
- **window の寿命管理は unsafe 契約であり、破ると未定義動作になる。**
  swapchain(と Device)より先に window を破棄した場合、orvk はそれを検出できない。
  レジストリの generational 検証が守るのは orvk 管理のリソースだけで、native handle の有効性は守備範囲外である。
- **acquire 済み frame を跨いだ recreate は、その frame を present 不能にする。**
  resize イベントで即座に recreate するループを書くと、手元の frame が discard しかできなくなり 1 フレーム落ちる。
  これは仕様(世代不一致の決定的拒否)であり、フレーム落ちを避けたい利用者は present 後に recreate する順序を選ぶ。
- **Suboptimal を無視し続けると劣化したまま動く。**
  Suboptimal は成功扱いなので、報告フラグを読まない利用者は画面回転後などに変換コスト付きの present を続けることになる。
- **frames in flight の上限は orvk の同期セットリングで決まり、利用者は変えられない。**
  acquire が内部で fence wait するため、CPU が GPU より速い場合は acquire でブロックする。
  レイテンシ制御を細かくやりたい利用者には現状の口が無い(「やらないこと」の frame pacing 参照)。

## 代替案

- **surface 生成まで利用者責務にして VkSurfaceKHR を受け取る案。**
  利用者が ash 等で VkSurfaceKHR を作り、orvk はそれを受け取って swapchain だけを管理する設計。
  - Pros: orvk からプラットフォーム別の surface 生成コードが消える。利用者は任意のプラットフォーム・拡張(将来の XCB 等)で surface を作れる。
  - Cons: VkSurfaceKHR は VkInstance に紐づくため、orvk が内部に持つ instance を利用者へ公開する口が必要になり、Device 生成のカプセル化(0006)が崩れる。別 instance で作られた surface を渡される誤りを orvk 側で検証できず、silent trap になる。ほぼ全利用者が Win32 / Wayland の定型 2 経路で足りるのに、全員に raw Vulkan 依存(ash 等)を要求する。
  - 見送り理由: 定型 2 経路は orvk が持つ方が誤用の面が小さい。非定型の surface が要る利用者は escape hatch(0011)で instance を取得して自前運用できるので、表玄関を raw に開く必要がない。
- **windowing ライブラリ統合案(特定 crate の handle 型や変換 trait を orvk が実装する)。**
  エコシステムの windowing crate の window 型・handle 標準 trait から `SurfaceSource` へ直接変換できるようにする設計。
  - Pros: 利用者の変換コードが消えて easy。エコシステムの標準に乗れる。
  - Cons: 依存クレートのメジャーバージョン更新に orvk のリリースが結合する。orvk が特定エコシステムを知ることになり、「window を知らない独立ライブラリ」という境界(0001)が曖昧になる。変換は利用者側で数行なので、削減できるコードが小さい。
  - 見送り理由(却下): 便益がほぼゼロに近いのに恒久的な依存結合を背負う。simple(境界の独立)を easy(変換 1 行の節約)で壊す典型なので採らない。
- **swapchain の同期プリミティブ(acquire / render finished semaphore)を利用者へ公開する案。**
  acquire が semaphore を返し、利用者が自分の submit に wait / signal を接続する設計。
  - Pros: 複数 queue への分配や独自のレイテンシ制御など、orvk が想定しないフレーム構成を組める。
  - Cons: semaphore の接続誤り(wait 忘れ・二重 signal)は検証不能な silent trap で、Vulkan で最も壊れやすい部分をそのまま利用者に開く。同期を access 宣言へ一本化する philosophy と正面から矛盾する。
  - 見送り理由: orvk の同期モデルの核(宣言からの導出)を swapchain だけ例外にする理由がない。非定型の構成が要る利用者は escape hatch(0011)側で raw を組める。
- **OutOfDate 検知時に orvk が自動で swapchain を再生成する案。**
  acquire が OutOfDate を内部で吸収し、再生成してから image を返す設計。
  - Pros: 利用者のフレームループから recreate 分岐が消える。
  - Cons: 新しい extent は window 側の知識で orvk からは取得できない(とくに Wayland)。黙った再生成は「利用者が知らない間に image count / extent が変わる」silent な状態変更であり、旧世代 handle の扱いも暗黙になる。再生成のタイミング制御(resize 中の抑制)ができない。
  - 見送り理由: 情報(extent)が構造的に orvk へ届かない時点で成立せず、届いたとしても silent な状態変更は設計原則に反する。
- **present を submit と切り離した独立 API(`swapchain.present(frame)`)にする案。**
  submit と present を別の呼び出しにし、利用者が順序を組む設計。
  - Pros: API の見た目が対称(acquire / present)で分かりやすい。
  - Cons: present が wait すべき render finished semaphore は「その image に書いた submit」が signal するもので、どの submit と対応するかの接続を利用者の呼び出し順序という暗黙状態に頼ることになる。submit を挟まず present した・別 Batch の完了を待たずに present した、という誤りを型で防げない。
  - 見送り理由: present は意味論上 submit に従属する(待つ対象なしに present は定義できない)ので、API 形状も submit への宣言として従属させる方が誤用の余地がない。

## セキュリティ・プライバシー

この設計の外部入力は native window handle(生ポインタ)と環境変数 `ORVK_PRESENT_MODE` の 2 つである。
生ポインタの有効性は orvk では検証できないため、受け取る API を unsafe とし安全条件を文書化する(信頼境界を型で明示する)。
環境変数は present mode 名の列挙値としてのみ解釈し、未知の値は明示エラーにするため、注入の余地はない。
機微データは扱わない。

## 負荷・コスト

- フレームあたりの追加コストは、acquire(内部 fence wait + `vkAcquireNextImageKHR`)と present(`vkQueuePresentKHR` + 結果判定)の各 1 回で、frame 数に対して O(1) である。
  世代検証・retire 済み検証は整数比較であり、hot path に測定可能な仕事を足さない。
- acquire 内の fence wait は frames in flight の上限を規律するための意図的なブロックであり、GPU bound な状況では CPU がここで待つ。
  これは設計上の上限であってオーバーヘッドではない(待たなければ同期セットを再利用できない)。
- 再生成は resize / 回転時のみ発生し、旧 swapchain の遅延破棄は SubmitTracker の terminal 判定(0006)に相乗りするため、専用のポーリングコストを持たない。
- メモリは swapchain image(通常 3 枚前後)と frame 同期セットのリングで、いずれも window あたり定数である。
  レジストリへの登録エントリも image 枚数分の定数で、再生成のたびに旧エントリの retire と新エントリの登録が発生する(resize 頻度に比例し、フレーム頻度には比例しない)。
