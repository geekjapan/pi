## 1. Agent Core Types And Parser

- [ ] 1.1 Add `ToolCallProtocol = "native" | "text" | "auto"` and minimal text extraction options to `packages/agent` types.
- [ ] 1.2 Add a strict parser/adapter that accepts exactly one valid `<tool_call>` JSON object from the current assistant final message.
- [ ] 1.3 Reject invalid JSON, multiple calls, missing `name`, non-object `arguments`, inactive tool names, and assistant-authored `<tool_result>`.
- [ ] 1.4 Ensure user content, tool result content, and replayed history tags are never parsed as current-turn executable calls.

## 2. Agent Loop Integration

- [ ] 2.1 Thread the protocol setting through `AgentOptions`, `AgentLoopConfig`, and `Agent.createLoopConfig()`.
- [ ] 2.2 Parse only after `response.result()` has produced the final assistant message; do not execute from streaming partial chunks.
- [ ] 2.3 Insert accepted synthetic `toolCall` blocks before `message_end` is emitted.
- [ ] 2.4 Reuse the existing `executeToolCalls()` path without adding a parallel executor.

## 3. Verification

- [ ] 3.1 Add parser unit tests for valid and rejected candidates.
- [ ] 3.2 Add loop tests proving synthetic calls pass through validation and hooks.
- [ ] 3.3 Add regression tests for split streaming text, user/toolResult tag injection, and inactive tool names.
- [ ] 3.4 Run the targeted tests and `npm run check`.
