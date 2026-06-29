# Design: E2E Runner Foundation

## モジュール構成

```
scripts/e2e/
  run-e2e.mjs          — ランナー本体
  scenarios/
    version-check.mjs  — P0 シナリオ
```

## run-e2e.mjs 関数シグネチャ

```js
// エントリポイント: process.argv をパースして実行
// parseArgs() → { binary, critical, scenario, timeout }
function parseArgs()

// シナリオ発見: readdir → import → meta + run を収集
// discoverScenarios(scenariosDir) → [{ meta, run, filePath }]
async function discoverScenarios(scenariosDir)

// シナリオフィルタ: --critical / --scenario でフィルタリング
// filterScenarios(scenarios, { critical, scenario }) → [{ meta, run }]
function filterScenarios(scenarios, filters)

// exec ヘルパー生成: binary パスを束縛したクロージャを返す
// createExecHelper(binary, defaultTimeout) → exec(args, opts?)
function createExecHelper(binary, defaultTimeout)

// 結果テーブル出力
// printResults(results) → void
// results: [{ name, status: "PASS"|"FAIL"|"TIMEOUT", duration, error? }]
function printResults(results)

// メイン実行ループ
// runScenarios(scenarios, ctx) → results[]
async function runScenarios(scenarios, ctx)
```

## exec ヘルパー詳細

```js
function createExecHelper(binary, defaultTimeout) {
  return (args, opts = {}) => {
    return new Promise((resolve) => {
      const timeout = opts.timeout || defaultTimeout
      const env = {
        ...process.env,
        PI_TELEMETRY: "0",
        PI_SKIP_VERSION_CHECK: "1",
        ...opts.env,
      }
      const proc = spawn(binary, args, { env, timeout })

      let stdout = ""
      let stderr = ""
      proc.stdout.on("data", (d) => { stdout += d })
      proc.stderr.on("data", (d) => { stderr += d })
      proc.on("close", (code) => {
        resolve({ exitCode: code, stdout, stderr })
      })
    })
  }
}
```

`spawn` の `timeout` オプション（Node 22+）を使用。タイムアウト時は SIGTERM → exitCode が null。

## repo root 検出

```js
const __filename = fileURLToPath(import.meta.url)
const REPO_ROOT = resolve(dirname(__filename), "../..")
const DEFAULT_BINARY = join(REPO_ROOT, "pi-test.sh")
```

## 結果テーブルフォーマット

```
E2E Results
──────────────────────────────────────────
  PASS  version-check          (120ms)
  FAIL  help-check             (45ms)
        Error: stdout missing "Usage"
  TIMEOUT startup-native       (30000ms)
──────────────────────────────────────────
2/3 passed, 1 failed, 0 timeout
```
