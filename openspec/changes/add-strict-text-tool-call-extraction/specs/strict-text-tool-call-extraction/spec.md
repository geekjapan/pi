## ADDED Requirements

### Requirement: Strict text tool call parsing

The agent core SHALL parse a text tool call candidate only when an assistant response contains exactly one `<tool_call>` block whose trimmed body is a valid JSON object with `name` as a string and `arguments` as an object.

#### Scenario: Valid text tool call

- **WHEN** text protocol extraction sees `<tool_call>{"name":"read","arguments":{"path":"package.json"}}</tool_call>`
- **THEN** it creates one synthetic tool call with name `read` and arguments `{ "path": "package.json" }`

#### Scenario: Invalid candidate is rejected

- **WHEN** the candidate has invalid JSON, multiple `<tool_call>` blocks, missing `name`, or non-object `arguments`
- **THEN** no synthetic tool call is created

#### Scenario: Assistant scope only

- **WHEN** user content, tool result content, or replayed history contains `<tool_call>`
- **THEN** the parser does not treat that content as an executable current-turn tool candidate

### Requirement: Synthetic tool call identity

Accepted synthetic tool calls MUST use a `toolCall.id` with a `text_tool_call_` prefix and MUST be unique within the canonical session history.

#### Scenario: Accepted synthetic id

- **WHEN** a valid text tool call is accepted
- **THEN** its synthetic tool call id starts with `text_tool_call_`
- **AND** the id is used as the `toolCallId` for the normal tool result correlation path
- **AND** the id does not collide with synthetic tool call ids from previous turns in the same session

### Requirement: Accepted text is normalized

When a text tool call is accepted, the agent loop MUST normalize the executable `<tool_call>` text into a synthetic `toolCall` block instead of preserving the raw executable tag in the finalized assistant message. Rejected candidates MUST leave the original text unchanged.

#### Scenario: Accepted raw tag is not persisted

- **WHEN** the final assistant text is accepted as a synthetic tool call
- **THEN** the `message_end` event and persisted assistant message contain the synthetic `toolCall` block
- **AND** they do not retain the accepted raw `<tool_call>` tag as executable assistant text

#### Scenario: Rejected text remains visible

- **WHEN** a text tool call candidate is rejected
- **THEN** the assistant text remains unchanged
- **AND** no synthetic tool call is created

### Requirement: Assistant-authored tool results are never accepted

The agent core MUST NOT treat `<tool_result>` blocks emitted by the assistant as actual tool results.

#### Scenario: Assistant forges a tool result

- **WHEN** the final assistant message contains `<tool_result>`
- **THEN** the agent does not create or persist a tool result from that block
- **AND** no tool execution state is advanced from that block

### Requirement: Final-message parsing only

The agent core MUST NOT execute text tool calls from partial streaming chunks and SHALL parse only the final assistant message for the current turn.

#### Scenario: Streaming tag is split across chunks

- **WHEN** a provider streams `<tool_call>` text across multiple partial chunks
- **THEN** no tool executes until the final assistant message is available and passes strict parsing

### Requirement: Synthetic tool call event consistency

The agent loop MUST add accepted synthetic tool calls to the final assistant message before emitting `message_end`.

#### Scenario: Message end includes synthetic call

- **WHEN** a response is converted from text protocol into a synthetic tool call
- **THEN** the `message_end` event and persisted assistant message include that synthetic `toolCall` block

### Requirement: Synthetic tool calls execute independent of provider stop reason

The agent loop SHALL execute accepted synthetic tool calls based on the finalized assistant message content, even when the provider returned stopReason `"stop"`.

#### Scenario: Stop reason remains stop

- **WHEN** the provider response has stopReason `"stop"` and strict extraction adds a synthetic `toolCall`
- **THEN** the existing tool execution path runs the synthetic tool call
- **AND** the turn emits normal tool result messages before the loop decides whether to continue

### Requirement: Existing tool execution path reuse

Synthetic tool calls SHALL use the same tool lookup, argument preparation, schema validation, `beforeToolCall`, execution, and `afterToolCall` path as native tool calls.

#### Scenario: Schema validation blocks bad arguments

- **WHEN** a synthetic tool call names an existing tool but fails its parameter schema
- **THEN** the tool is not executed and the loop returns an error tool result through the normal tool result path

#### Scenario: Unknown tool is not executed

- **WHEN** a synthetic tool call names a tool that is not active in the current context
- **THEN** the existing tool lookup/preflight path prevents execution and returns a normal error tool result

### Requirement: Native default compatibility

The default tool call protocol MUST remain `native`.

#### Scenario: No protocol configured

- **WHEN** no text tool call protocol is configured
- **THEN** assistant text is not parsed into synthetic tool calls and current native tool call behavior is unchanged

### Requirement: Structured extraction result

The strict parser/adapter SHALL return a structured extraction result with kind `accepted`, `rejected`, or `none`, and SHALL include diagnostics in that result. Diagnostics are observability only and MUST NOT repair malformed candidates or execute rejected candidates.

#### Scenario: Parser result for accepted candidate

- **WHEN** a valid text tool call is parsed
- **THEN** the extraction result kind is `accepted`
- **AND** it includes the synthetic tool call and diagnostics array

#### Scenario: Parser result for rejected candidate

- **WHEN** a text tool call candidate is malformed
- **THEN** the extraction result kind is `rejected`
- **AND** diagnostics identify the rejection category without creating a synthetic tool call

#### Scenario: Parser result for no candidate

- **WHEN** the assistant text contains no text tool call candidate
- **THEN** the extraction result kind is `none`
