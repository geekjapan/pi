# Design: deploy.sh

## 設計判断

### local-release.mjs を直接呼ぶ

tarball 作成・npm install のロジックを複製しない。`local-release.mjs --out --skip-bun-install` で node/ 出力を得て、deploy.sh は配置と symlink のみ担当。

### Shell script（Node ではない）

deploy は Node/TypeScript ビルドが壊れていても動く必要がある。`local-release.mjs` の呼び出しだけ Node に依存。ビルド失敗時は staging cleanup + exit 1 で安全に止まる。

### Staging + move パターン

`mktemp` で一時ディレクトリを作り、成功時のみ release dir に移動。EXIT trap で cleanup するため、途中失敗でもゴミが残らない。

### `ln -sfn` によるアトミック symlink 更新

POSIX `ln -sfn` は既存 symlink を上書きする。macOS では `readlink -f` ではなく `readlink` が使える。

### Bun binary は不要

`local-release.mjs` は `--skip-bun-install` でも Bun binary release を作る（`buildBunBinaryRelease` は `skipInstall` でのみスキップ）。Bun がインストール済みなので問題ないが、deploy.sh は `$STAGING/node/` だけを使い、`bun/` は無視する。

### .deploy-info はプレーンテキスト

JSON ではなく `KEY=VALUE` 形式。shell から `source` で読める。Git の出力と親和性が高い。

## セキュリティ考慮

- deploy.sh は `$REPO_ROOT` を固定解決し、外部入力をコマンド引数に渡さない
- staging dir は `mktemp -d` で安全に作成
- `local-release.mjs` は `--ignore-scripts` で npm install するため、postinstall スクリプトは実行されない
