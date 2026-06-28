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

Auto mode MUST use model capability metadata as an explicit input for choosing whether to send native tools or rely on text protocol fallback.

#### Scenario: Model marked without native tool support

- **WHEN** auto mode runs with a model whose metadata indicates no native tool support
- **THEN** the provider request does not rely on native tool calls and diagnostics identify the metadata-based decision

#### Scenario: Manual protocol overrides metadata

- **WHEN** the user explicitly selects `native` or `text`
- **THEN** that explicit protocol is used instead of auto metadata selection

### Requirement: Text candidate diagnostics

The agent loop MUST expose diagnostics for rejected text tool call candidates without repairing or executing them.

#### Scenario: Invalid JSON diagnostic

- **WHEN** text fallback sees a `<tool_call>` block with invalid JSON
- **THEN** the loop records a diagnostic identifying invalid JSON and does not execute a tool

#### Scenario: Forged tool result diagnostic

- **WHEN** assistant output contains `<tool_result>`
- **THEN** the loop records a forged tool result diagnostic and does not treat it as a tool execution result

#### Scenario: Fallback decision is observable

- **WHEN** auto mode chooses native or text fallback because of metadata or response content
- **THEN** diagnostics expose the decision reason without changing the canonical conversation history
