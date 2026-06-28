## ADDED Requirements

### Requirement: Auto mode native priority

When the active protocol is `auto`, the agent loop MUST execute native tool calls when any native `toolCall` blocks are present and MUST NOT execute text `<tool_call>` blocks from the same response.

#### Scenario: Native and text calls appear together

- **WHEN** an assistant response contains both native `toolCall` blocks and a text `<tool_call>` block
- **THEN** only the native `toolCall` blocks are executed

### Requirement: Auto mode text fallback

When the active protocol is `auto`, the agent loop SHALL attempt strict text tool call extraction only if the response contains no native tool calls.

#### Scenario: No native call with valid text call

- **WHEN** an assistant response has no native `toolCall` blocks and contains one valid `<tool_call>` block
- **THEN** the agent loop creates and executes one synthetic tool call through the normal execution path

### Requirement: Auto mode uses capability metadata

Model capability metadata SHALL include an optional provider-independent `capabilities.nativeToolUse` boolean. Auto mode MUST use this metadata as an explicit input for choosing whether to send native tools or rely on text protocol fallback. When omitted, auto mode SHALL preserve the current provider default behavior unless the user explicitly selects `text`.

#### Scenario: Model marked without native tool support

- **WHEN** auto mode runs with a model whose metadata indicates no native tool support
- **THEN** the provider request does not rely on native tool calls and diagnostics identify the metadata-based decision

#### Scenario: Manual protocol overrides metadata

- **WHEN** the user explicitly selects `native` or `text`
- **THEN** that explicit protocol is used instead of auto metadata selection

### Requirement: Text candidate diagnostics

The agent loop MUST attach text tool protocol diagnostics to the finalized assistant message `diagnostics` field, using stable diagnostic `type` codes suitable for tests and UI rendering. Diagnostics are observability only and MUST NOT repair or execute rejected candidates.

The initial diagnostic codes SHALL include:

- `text_tool_call_invalid_json`
- `text_tool_call_multiple_candidates`
- `text_tool_call_invalid_shape`
- `text_tool_result_forged`
- `text_tool_call_ignored_native_present`
- `tool_protocol_auto_metadata_native_disabled`
- `tool_protocol_auto_text_fallback`

#### Scenario: Invalid JSON diagnostic

- **WHEN** text fallback sees a `<tool_call>` block with invalid JSON
- **THEN** the loop records a diagnostic identifying invalid JSON and does not execute a tool

#### Scenario: Forged tool result diagnostic

- **WHEN** assistant output contains `<tool_result>`
- **THEN** the loop records a forged tool result diagnostic and does not treat it as a tool execution result

#### Scenario: Native present ignores text candidate

- **WHEN** auto mode sees native tool calls and a text `<tool_call>` in the same assistant response
- **THEN** only the native calls are executed
- **AND** the loop records `text_tool_call_ignored_native_present`

#### Scenario: Fallback decision is observable

- **WHEN** auto mode chooses native or text fallback because of metadata or response content
- **THEN** diagnostics expose the decision reason on the finalized assistant message without changing the canonical conversation history
