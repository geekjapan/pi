# Deploy Script (build + release dir + symlink)

## 概要

`scripts/dogfood/deploy.sh` — `local-release.mjs` をビルドエンジンとして呼び、E2E gate を通過した commit を `~/opt/pi-dogfood/releases/<sha>/` に配置し、`current` symlink で切り替える bash スクリプト。

## フラグ

| フラグ | 説明 |
|--------|------|
| `--skip-check` | `local-release.mjs` に透過（`npm run check` をスキップ） |
| `--skip-e2e` | E2E gate を省略 |
| `--force` | 同一 SHA の既存リリースを上書き |

## 処理フロー

### Step 1: 初期化

```
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
```

`package.json` の `name` が `pi-monorepo` であることを検証。

### Step 2: Node version チェック

`node --version` の major が 22 以上であることを確認。`local-release.mjs` と Pi 本体の engine 要件。

### Step 3: Clean working tree アサート

```
git -C "$REPO_ROOT" diff --quiet
git -C "$REPO_ROOT" diff --cached --quiet
```

失敗時: "ERROR: working tree has uncommitted changes" で exit 1。

### Step 4: Commit SHA 取得

```
COMMIT_SHA=$(git -C "$REPO_ROOT" rev-parse --short=12 HEAD)
COMMIT_FULL=$(git -C "$REPO_ROOT" rev-parse HEAD)
```

### Step 5: ディレクトリ変数設定

```
DOGFOOD_ROOT="${DOGFOOD_ROOT:-$HOME/opt/pi-dogfood}"
RELEASE_DIR="$DOGFOOD_ROOT/releases/$COMMIT_SHA"
CURRENT_LINK="$DOGFOOD_ROOT/current"
```

### Step 6: 既存リリースチェック

`$RELEASE_DIR` が存在する場合:
- `--force` なし → "Already deployed: $COMMIT_SHA" で exit 0
- `--force` あり → `rm -rf "$RELEASE_DIR"`

### Step 7: Staging dir 作成

```
STAGING=$(mktemp -d)
trap 'rm -rf "$STAGING"' EXIT
```

### Step 8: local-release.mjs 実行

```
cd "$REPO_ROOT"
node scripts/local-release.mjs --out "$STAGING" --skip-bun-install [--skip-check]
```

出力: `$STAGING/node/` に npm install 済みの Pi + `pi` shim symlink。

**注意**: `local-release.mjs` は `prepareOutputDirectory` で出力先が repo 外であることを検証する。`mktemp` の結果は常に repo 外なので問題なし。

### Step 9: E2E gate

`--skip-e2e` でなければ:

```
node "$REPO_ROOT/scripts/e2e/run-e2e.mjs" --binary "$STAGING/node/pi" --critical
```

失敗時: "E2E gate FAILED. Deploy aborted." で exit 1。

### Step 10: Release dir 配置

```
mkdir -p "$DOGFOOD_ROOT/releases"
mv "$STAGING/node" "$RELEASE_DIR"
```

### Step 11: .deploy-info 書き込み

```
cat > "$RELEASE_DIR/.deploy-info" <<INFO
COMMIT=$COMMIT_FULL
DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
BRANCH=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)
INFO
```

### Step 12: Current symlink 更新

```
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"
```

`ln -sfn` は既存 symlink をアトミックに上書き。

### Step 12.5: Wrapper 生成

`$DOGFOOD_ROOT/bin/` に `pi-dog`, `pi-text`, `pi-auto` を生成する。詳細は wrapper-generation (#28) の proposal を参照。deploy.sh 内に `generate_wrappers` 関数として実装する。

### Step 13: サマリー出力

```
Deployed Pi dogfood:
  Commit:  <full sha>
  Branch:  <branch>
  Release: ~/opt/pi-dogfood/releases/<sha>/
  Current: ~/opt/pi-dogfood/current -> releases/<sha>/
  Binary:  ~/opt/pi-dogfood/current/pi
```

## local-release.mjs の出力構造

```
$STAGING/
  tarballs/                    ← npm pack 出力（deploy では不要）
  node/                        ← deploy が使う
    package.json               ← { private: true, dependencies: { file:... } }
    node_modules/
      .bin/
        pi                     ← packages/coding-agent/dist/cli.js
      @earendil-works/
        pi-ai/
        pi-agent-core/
        pi-tui/
        pi-coding-agent/
    pi                         ← symlink → node_modules/.bin/pi
  bun/                         ← Bun binary（deploy では不要）
  bun-install/                 ← --skip-bun-install でスキップ
```

## Release dir 構造

```
~/opt/pi-dogfood/
  releases/
    <12-char-sha>/
      pi                       ← symlink → node_modules/.bin/pi
      node_modules/...
      .deploy-info             ← COMMIT, DATE, BRANCH
  current/                     ← symlink → releases/<latest-sha>/
```

## エラーハンドリング

| 状態 | 動作 |
|------|------|
| dirty working tree | exit 1 + メッセージ |
| 同一 SHA 既存（`--force` なし） | exit 0 + "Already deployed" |
| 同一 SHA 既存（`--force` あり） | 既存を削除して続行 |
| `local-release.mjs` 失敗 | EXIT trap で staging cleanup、exit 1 |
| E2E gate 失敗 | EXIT trap で staging cleanup、exit 1 |
| Node version < 22 | exit 1 + バージョン要件メッセージ |
