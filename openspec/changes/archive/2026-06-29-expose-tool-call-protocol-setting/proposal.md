## Why

After text protocol support exists internally, users need a stable way to choose native Tool Use, strict text protocol, or automatic fallback per model/session. Without CLI and settings support, the feature cannot be tested against fine-tuned or local models in normal workflows.

## What Changes

- Add `--tool-protocol native|text|auto`, with `auto` accepted only when auto fallback behavior is implemented in the same build; otherwise reject or mark it experimental with a diagnostic.
- Add SDK/session option and settings field for `toolProtocol`.
- Apply precedence: CLI > settings > default `native`.
- Keep CLI/settings exposure after core parser and text protocol context are available, so explicit `text` mode can be tested end-to-end.
- Document how to use text protocol with Tool Use 非対応モデル.
- Document that Pi remains YOLO-oriented and safety boundaries belong in sandbox/container/VM execution environments.

## Capabilities

### New Capabilities

- `tool-call-protocol-configuration`: users and SDK callers can configure the tool call protocol consistently through CLI, settings, and session options.

### Modified Capabilities

なし

## Dependencies / Order

- 推奨実装順の 3 番目。`add-strict-text-tool-call-extraction` と `add-text-tool-protocol-context` に依存する。
- `auto` value の安定公開は `add-auto-tool-protocol-fallback` と同時または後に行う。

## Impact

- 影響範囲は `packages/coding-agent` の CLI args、settings manager、session option wiring、help/docs、tests。
- `add-strict-text-tool-call-extraction` と `add-text-tool-protocol-context` が先に存在することを前提にする。
- agmsg feedback で、CLI/settings/docs は core parser と context conversion の後に公開する順序を明確化した。
