# orvk

Vulkan を使いやすい API にラップする Rust 製の GPU ライブラリ。
複数の GPU API を抽象する RHI ではなく Vulkan 専用であり、`VK_EXT_descriptor_heap` 前提の bindless 記述子運用を核に、リソース管理・同期・実行を安全で simple な API として提供する。

## 特徴

- **bindless 前提**: `VK_EXT_descriptor_heap` を必須とし、descriptor set のバインド操作を利用者から消す。リソースはハンドルで参照し、シェーダへは `DescriptorHandle` で渡す。
- **宣言的な同期**: 描画・計算はタスクグラフに記録し、タスクごとのアクセス宣言から barrier・レイアウト遷移を導出する。手書き barrier を通常経路に置かない。
- **安全なリソース管理**: リソースは世代付きハンドルで参照し、破棄済みハンドルの誤用や GPU 使用中の破棄を API 契約として検出・防止する。
- **単体で完結する実行**: リソース生成 → 記録 → submit → 完了観測 → readback が、window なしのヘッドレスでも完結する。present(swapchain)は機能として選択できる。
- **raw への escape hatch**: 記録語彙に無い Vulkan 機能は、raw handle への unsafe な口から使える。

## 非目標

- GPU API の抽象化層(RHI)。backend は Vulkan だけであり、今後も追加しない。
- `VK_EXT_descriptor_heap` が使えない環境への fallback。対応環境で起動できない場合は起動時の明示エラーとして報告する。

## ライセンス

MIT OR Apache-2.0([LICENSE-MIT](LICENSE-MIT) / [LICENSE-APACHE](LICENSE-APACHE))。
