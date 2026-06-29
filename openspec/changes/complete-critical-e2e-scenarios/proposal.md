# Complete Critical E2E Scenario Set

## 概要

deploy gate に必要な残り 4 つの P0 シナリオを追加する。すべて API key 不要で、Pi の起動パス・引数パース・エラーハンドリングが壊れていないことを検証する。

## シナリオ詳細

### help-check

`pi --help` が exit 0 で、stdout に `Usage:` を含むことを検証する。

**検証ポイント**:
- exit code === 0
- stdout に `Usage:` が含まれる（`args.ts` line 241 で出力）
- stdout に `--tool-protocol` が含まれる（text tool protocol 機能が存在する証拠）

**挙動**: `parseArgs` で `result.help = true` がセットされ、`main.ts` で help テキストを出力して `process.exit(0)` する。API key 不要。

### invalid-tool-protocol

`pi --tool-protocol bogus -p "hi"` がクラッシュせず終了することを検証する。

**検証ポイント**:
- プロセスが正常終了する（exit code 0 または 1、null でない）
- stderr + stdout に stack trace パターン（`at `, `Error:` + ファイルパス行）が含まれない
- stderr に `Warning:` が含まれる（`Invalid tool protocol "bogus"` diagnostic）

**挙動**: `args.ts` line 148 で `isValidToolProtocol("bogus")` が false → diagnostic warning を push → `result.toolProtocol` は undefined → native fallback。main.ts line 507-514 で warning を stderr に出力するが、error ではないので `process.exit(1)` しない。その後 `-p` モードで model 解決に進み、API key なしなら "No models available" で exit 1。

### startup-native

`pi -p "hello"` の native protocol 起動パスが clean に終了することを検証する。

**検証ポイント**:
- exit code が 0 または 1（null/undefined でない = タイムアウト/クラッシュでない）
- stack trace パターンが出力に含まれない
- API key なし環境では stderr に "No models available" を含む（`main.ts` line 800、`formatNoModelsAvailableMessage()`）

**挙動**: 引数パース → settings ロード → session 作成 → model 解決失敗 → "No models available" エラー → exit 1。全工程が正常に通過することで、native protocol の起動パス全体が健全であることを確認する。

### startup-text-protocol

`pi --tool-protocol text -p "hello"` の text protocol 起動パスが同様に clean に終了することを検証する。

**検証ポイント**:
- exit code が 0 または 1
- stack trace パターンが出力に含まれない
- startup-native と同じ "No models available" パスに到達する

**挙動**: `--tool-protocol text` が正しくパースされ、`toolCallProtocol = "text"` が設定される。system prompt に tool protocol section が追加される構成が壊れていないことを間接的に検証する。最終的に model 解決で同じ clean error に到達する。

## Stack Trace 検出

4 シナリオ中 3 つ（invalid-tool-protocol, startup-native, startup-text-protocol）で stack trace が出ないことを検証する。共通ヘルパーとして `assertNoStackTrace(output)` を用意する。

検出パターン:
- `at ` で始まる行（Node.js stack frame）
- `Error:` の後にファイルパス（`.ts:`, `.js:`, `.mjs:`）を含む行

## Non-goals

- API key を使った実際の LLM 呼び出し検証
- tool call の実行検証
- interactive mode の検証
