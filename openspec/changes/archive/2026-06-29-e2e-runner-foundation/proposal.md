# E2E Runner Foundation

## 概要

Pi バイナリに対する E2E テストランナー (`scripts/e2e/run-e2e.mjs`) と最初の P0 シナリオ (`version-check`) を構築する。deploy gate の基盤となる。

## 設計

### run-e2e.mjs

Node ESM スクリプト。`scripts/e2e/scenarios/` から `.mjs` ファイルを動的に `import()` で発見・ロードし、順次実行する。

**フラグ**:
- `--binary <path>` — Pi バイナリパス。省略時は repo root の `pi-test.sh` を使う
- `--critical` — `meta.critical === true` のシナリオのみ実行
- `--scenario <name>` — 単一シナリオを名前（拡張子なし）で実行
- `--timeout <ms>` — シナリオごとのタイムアウト（デフォルト 30000ms）

**実行ループ**:
1. `readdir` で `scripts/e2e/scenarios/*.mjs` を収集
2. 各ファイルを `import()` し `meta` と `run` をロード
3. `--critical` / `--scenario` でフィルタ
4. 順次 `run(ctx)` を呼び出し、throw で失敗判定
5. タイムアウトは `AbortSignal.timeout()` を spawn の signal に渡す
6. 結果テーブル（name, status, duration）を stdout に出力
7. 全 PASS なら exit 0、1つでも FAIL/TIMEOUT なら exit 1

### シナリオインターフェース

各シナリオ `.mjs` ファイルは以下をエクスポートする:

```js
export const meta = {
  name: "version-check",      // 識別名
  critical: true,              // P0 = true, P1+ = false
  description: "...",          // 人間向け説明
}

export async function run(ctx) {
  // throw on failure
}
```

**ctx の shape**:

```js
{
  binary: string,              // Pi バイナリの絶対パス
  exec: (args, opts?) => Promise<{exitCode, stdout, stderr}>,
  timeout: number,             // ms
}
```

### exec ヘルパー

`child_process.spawn` で Pi バイナリを起動する。

- 常に設定する env vars: `PI_TELEMETRY=0`, `PI_SKIP_VERSION_CHECK=1`
- `opts.env` で追加 env vars を渡せる
- `opts.timeout` でシナリオ単位のタイムアウト override
- stdout/stderr を文字列として収集し、プロセス終了後に `{exitCode, stdout, stderr}` を返す
- タイムアウト時は子プロセスを kill し、`exitCode` を null にする（ランナーが TIMEOUT 判定）

### version-check.mjs

```js
export const meta = {
  name: "version-check",
  critical: true,
  description: "pi --version exits 0 with semver output",
}

export async function run({ exec }) {
  const { exitCode, stdout } = await exec(["--version"])
  if (exitCode !== 0) throw new Error(`Exit code ${exitCode}`)
  if (!/^\d+\.\d+\.\d+/.test(stdout.trim())) throw new Error(`Not semver: ${stdout.trim()}`)
}
```

検証: `--version` が exit 0 で、出力が semver パターン (`X.Y.Z`) で始まること。

### --binary 未指定時の fallback

`--binary` が未指定の場合、repo root を検出し `pi-test.sh` 経由で Pi を起動する。具体的には:

1. `run-e2e.mjs` の `import.meta.url` から repo root を解決
2. `<repo-root>/pi-test.sh` が存在するか確認
3. binary を `<repo-root>/pi-test.sh` に設定
4. exec ヘルパーは `pi-test.sh` をそのまま spawn する（tsx 経由で Pi が起動される）

deploy gate では `--binary <staging>/node/pi` で built binary を直接指定する。

**注意**: `pi-test.sh` 経由では tsx の起動コスト（数秒）が加算される。デフォルトタイムアウト 30s は通常十分だが、`npm run build` 済みの `dist/cli.js` を `--binary` で直接指定する方が高速。開発中に `npm run e2e:critical` を使う場合はこの点に留意する。

### package.json 変更

root `package.json` の scripts に追加:

```json
"e2e": "node scripts/e2e/run-e2e.mjs",
"e2e:critical": "node scripts/e2e/run-e2e.mjs --critical"
```

## Non-goals

- API key を使った実際の LLM 呼び出しシナリオ（別 issue）
- file system 変更を伴うシナリオ（別 issue）
- CI 統合
