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

### Requirement: Existing tool execution path reuse

Synthetic tool calls SHALL use the same tool lookup, argument preparation, schema validation, `beforeToolCall`, execution, and `afterToolCall` path as native tool calls.

#### Scenario: Schema validation blocks bad arguments

- **WHEN** a synthetic tool call names an existing tool but fails its parameter schema
- **THEN** the tool is not executed and the loop returns an error tool result through the normal tool result path

#### Scenario: Unknown tool is not executed

- **WHEN** a synthetic tool call names a tool that is not active in the current context
- **THEN** the existing tool lookup/preflight path prevents execution

### Requirement: Native default compatibility

The default tool call protocol MUST remain `native`.

#### Scenario: No protocol configured

- **WHEN** no text tool call protocol is configured
- **THEN** assistant text is not parsed into synthetic tool calls and current native tool call behavior is unchanged
