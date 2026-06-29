# Design: Complete Critical E2E Scenario Set

## モジュール構成

```
scripts/e2e/scenarios/
  help-check.mjs
  invalid-tool-protocol.mjs
  startup-native.mjs
  startup-text-protocol.mjs
```

## 共通ヘルパー

`scripts/e2e/helpers.mjs` に stack trace 検出を切り出す。

```js
export function assertNoStackTrace(stdout, stderr) {
  const combined = stdout + stderr
  const lines = combined.split("\n")
  for (const line of lines) {
    const trimmed = line.trim()
    // Node.js stack trace の典型パターンに限定し false positive を避ける
    // "at Object.<anonymous>" "at Module._compile" "at async" "at (file:1:2)" 等
    if (/^\s*at\s+\S+\s+\(/.test(trimmed) || /^\s*at\s+async\s+/.test(trimmed)) {
      throw new Error(`Stack trace detected: ${trimmed}`)
    }
    if (/Error:.*\.(ts|js|mjs):\d+/.test(trimmed)) {
      throw new Error(`Stack trace detected: ${trimmed}`)
    }
  }
}
```

## 各シナリオの検証ロジック

### help-check.mjs

```js
export const meta = {
  name: "help-check",
  critical: true,
  description: "pi --help exits 0 with Usage text",
}

export async function run({ exec }) {
  const { exitCode, stdout } = await exec(["--help"])
  if (exitCode !== 0) throw new Error(`Exit code ${exitCode}`)
  if (!stdout.includes("Usage:")) throw new Error("stdout missing 'Usage:'")
  if (!stdout.includes("--tool-protocol")) throw new Error("stdout missing '--tool-protocol'")
}
```

### invalid-tool-protocol.mjs

```js
import { assertNoStackTrace } from "../helpers.mjs"

export const meta = {
  name: "invalid-tool-protocol",
  critical: true,
  description: "pi --tool-protocol bogus does not crash",
}

export async function run({ exec }) {
  const { exitCode, stdout, stderr } = await exec([
    "--tool-protocol", "bogus", "-p", "hi", "--no-session", "--offline",
  ])
  if (exitCode === null) throw new Error("Process timed out")
  assertNoStackTrace(stdout, stderr)
  if (!stderr.includes("Warning:")) throw new Error("Expected warning diagnostic in stderr")
}
```

`--no-session` と `--offline` を追加して副作用を最小化する。exit code は 1 (no models) を許容する。

### startup-native.mjs

```js
import { assertNoStackTrace } from "../helpers.mjs"

export const meta = {
  name: "startup-native",
  critical: true,
  description: "pi -p startup path completes without crash",
}

export async function run({ exec }) {
  const { exitCode, stdout, stderr } = await exec([
    "-p", "hello", "--no-session", "--offline",
  ])
  if (exitCode === null) throw new Error("Process timed out")
  assertNoStackTrace(stdout, stderr)
}
```

exit code 0 (API key あり) または 1 (API key なし) のどちらも許容。stack trace がなければ PASS。

### startup-text-protocol.mjs

```js
import { assertNoStackTrace } from "../helpers.mjs"

export const meta = {
  name: "startup-text-protocol",
  critical: true,
  description: "pi --tool-protocol text -p startup path completes without crash",
}

export async function run({ exec }) {
  const { exitCode, stdout, stderr } = await exec([
    "--tool-protocol", "text", "-p", "hello", "--no-session", "--offline",
  ])
  if (exitCode === null) throw new Error("Process timed out")
  assertNoStackTrace(stdout, stderr)
}
```

## API Key 環境での挙動

API key が環境にある場合、startup-native と startup-text-protocol は実際に LLM を呼び出し、exit 0 で終了する可能性がある。exec ヘルパーが `PI_TELEMETRY=0` と `PI_SKIP_VERSION_CHECK=1` を設定するが、API key は strip しない。

E2E の意図は「起動パスが壊れていないこと」なので、exit 0 (成功) も exit 1 (no models) も PASS とする。stack trace やハングのみが FAIL。

deploy gate (`deploy.sh`) の環境では API key の有無は制御しない。どちらの環境でも PASS することが期待される。
