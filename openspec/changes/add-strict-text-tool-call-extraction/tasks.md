## 1. Agent Core Types And Parser

- [ ] 1.1 Add `ToolCallProtocol = "native" | "text" | "auto"` and minimal text extraction options to `packages/agent` types.
- [ ] 1.2 Add a strict parser/adapter that returns `accepted` / `rejected` / `none` with diagnostics and accepts exactly one valid `<tool_call>` JSON object from the current assistant final message.
- [ ] 1.3 Reject invalid JSON, multiple calls, missing `name`, non-object `arguments`, and assistant-authored `<tool_result>` without repairing or executing rejected candidates.
- [ ] 1.4 Ensure inactive or unknown tool names are handled by the existing tool lookup/preflight path and produce a normal error tool result without execution.
- [ ] 1.5 Ensure user content, tool result content, and replayed history tags are never parsed as current-turn executable calls.
- [ ] 1.6 Generate accepted synthetic `toolCall.id` values with a `text_tool_call_` prefix and current-turn uniqueness.

## 2. Agent Loop Integration

- [ ] 2.1 Thread the protocol setting through `AgentOptions`, `AgentLoopConfig`, and `Agent.createLoopConfig()`.
- [ ] 2.2 Parse only after `response.result()` has produced the final assistant message; do not execute from streaming partial chunks.
- [ ] 2.3 Normalize accepted raw `<tool_call>` text into synthetic `toolCall` blocks before `message_end` is emitted; leave rejected text unchanged.
- [ ] 2.4 Reuse the existing `executeToolCalls()` path without adding a parallel executor.
- [ ] 2.5 Ensure synthetic calls execute through the normal path even when the provider stopReason remains `"stop"`.

## 3. Verification

- [ ] 3.1 Add parser unit tests for valid, rejected, and none results, including diagnostics and synthetic id prefix.
- [ ] 3.2 Add loop tests proving synthetic calls pass through validation and hooks.
- [ ] 3.3 Add loop tests for accepted text normalization and `"stop"` stopReason with synthetic execution.
- [ ] 3.4 Add regression tests for split streaming text, user/toolResult tag injection, and inactive tool names using the normal error result path.
- [ ] 3.5 Run the targeted tests and `npm run check`.
