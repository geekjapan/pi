## Why

Some models partially support native Tool Use but occasionally fall back to text. After native and text paths exist, `auto` mode should use native calls when present and strict text extraction only when native calls are absent, without double execution.

## What Changes

- Implement `auto` mode fallback behavior.
- Prefer native `toolCall` blocks over text `<tool_call>` blocks.
- Ignore text `<tool_call>` when native calls exist in the same assistant response.
- Add model capability metadata so `auto` has an explicit basis for whether native Tool Use should be attempted.
- Add parser/loop diagnostics for rejected text candidates.
- Avoid silent downgrade: fallback decisions must be observable.
- Keep alias補正、JSON repair、自然文 command 推測、複数 call 実行 out of scope.

## Capabilities

### New Capabilities

- `auto-tool-protocol-fallback`: models that mix native and text tool use can fall back to strict text calls without double execution.

### Modified Capabilities

なし

## Impact

- 影響範囲は `packages/agent` の protocol selection、parser diagnostics、loop tests、および `packages/ai`/`packages/coding-agent` の model capability metadata、prompt/docs tests。
- 前段の native/text protocol 実装と CLI/settings 公開を前提にする。
- agmsg feedback で、capability metadata、silent downgrade 防止、diagnostics、prompt injection 観点を反映した。
