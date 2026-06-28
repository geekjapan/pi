## Why

Strict extraction alone is not enough for Tool Use 非対応モデル対応になる。text protocol では provider に native tools や native tool history を渡さず、モデルが理解できる text protocol として prompt と履歴を整える必要がある。

## What Changes

- `text` protocol では LLM context から native `tools` を外す。
- provider 境界でのみ assistant `toolCall` 履歴を `<tool_call>` text として再表現し、canonical session history は `ToolCall` / `ToolResult` のまま保持する。
- provider 境界でのみ `toolResult` 履歴を `<tool_result ...>` text として user message に変換する。
- system prompt に strict text tool protocol の出力規約を追加する。
- available tools は token cost を抑えた compact format で、tool name と arguments schema を提示する。
- user/tool result/history に含まれる `<tool_call>` 風 text は再実行されないよう escape または非実行 text として扱う。

## Capabilities

### New Capabilities

- `text-tool-protocol-context`: native Tool Use を使わない provider 向けに、tools、履歴、system prompt を text protocol として整える能力。

### Modified Capabilities

なし

## Impact

- 影響範囲は `packages/coding-agent` の LLM message conversion、system prompt、SDK session wiring、関連 tests。
- `add-strict-text-tool-call-extraction` が先に synthetic `toolCall` を扱えることを前提にする。
- agmsg feedback で、canonical history を text 化して永続化しないこと、tag injection 対策、tool schema の compact 表示、画像付き tool result の text mode downgrade を反映した。
