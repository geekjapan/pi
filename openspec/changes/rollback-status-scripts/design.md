# Design: rollback.sh + status.sh

## 共通ヘルパー

両スクリプトで使う共通パターン:

### DOGFOOD_ROOT 解決

```sh
DOGFOOD_ROOT="${DOGFOOD_ROOT:-$HOME/opt/pi-dogfood}"
CURRENT_LINK="$DOGFOOD_ROOT/current"
RELEASES_DIR="$DOGFOOD_ROOT/releases"
```

### .deploy-info 読み取り

```sh
read_deploy_info() {
   local dir="$1"
   local info="$dir/.deploy-info"
   if [ -f "$info" ]; then
      source "$info"
      # COMMIT, DATE, BRANCH が変数として利用可能
   fi
}
```

`source` で KEY=VALUE を読む。deploy.sh の design.md でプレーンテキスト形式と決定済み。

### current リリースの特定

```sh
if [ ! -L "$CURRENT_LINK" ]; then
   echo "Not deployed"
   exit 0  # status の場合。rollback の場合は exit 1
fi
CURRENT_RELEASE=$(readlink "$CURRENT_LINK")
CURRENT_SHA=$(basename "$CURRENT_RELEASE")
```

macOS では `readlink -f` は使えないが、current は 1 段の symlink なので `readlink` で十分。

## 設計判断

### rollback は source を実行しない

rollback.sh は `.deploy-info` を `source` ではなく `grep` で DATE を抽出する方が安全（任意コード実行を避ける）。ただし deploy.sh 自身が `.deploy-info` を生成するため、信頼できるデータとして扱う。status.sh も同様。

→ **判断: deploy.sh が生成する .deploy-info は信頼する。`source` を使用。**

### previous の解決は DATE ソート

ファイルシステムのタイムスタンプ（mtime）ではなく `.deploy-info` の DATE フィールドでソートする。mtime は `mv` やファイル操作で変わりうるが、DATE は deploy 時に固定される。

### status.sh の pi --version は best-effort

`pi --version` が失敗しても（バイナリ破損等）status.sh は止まらない。エラー時は "version: unknown" を表示する。

### disk usage は du -sh

macOS の `du -sh` はヒューマンリーダブルな出力（125M 等）。全リリースのサイズも合計表示しない（シンプルに各リリースのサイズのみ）。

## セキュリティ考慮

- rollback.sh は symlink の付け替えのみ。ファイル削除やビルド実行はしない。
- status.sh は読み取り専用。pi --version の実行のみ副作用あり（プロセス起動）。
- 両スクリプトとも外部入力（SHA prefix 引数）をファイルパスの一部として使うが、glob 展開で制御し、直接コマンド引数には渡さない。
