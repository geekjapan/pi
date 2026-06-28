## ADDED Requirements

### Requirement: Text protocol omits native tools

When the active tool call protocol is `text`, coding-agent SHALL NOT pass native `tools` in the provider request payload. This MUST NOT remove active tools from the agent execution context used by synthetic tool call validation and execution.

#### Scenario: Text mode provider request

- **WHEN** a session runs with tool call protocol `text`
- **THEN** the stream request sent to the provider has no native tool definitions
- **AND** the agent execution context still has the active tools needed for synthetic tool call lookup

### Requirement: Tool history is textified

When the active tool call protocol is `text`, coding-agent MUST convert historical assistant tool calls and tool results into text protocol messages only in the provider request payload, while preserving canonical session history as tool call and tool result messages.

#### Scenario: Tool result history

- **WHEN** prior context contains a `toolResult` message
- **THEN** the LLM receives a user text message containing a `<tool_result>` block with the tool call id, tool name, error flag, and result text

#### Scenario: Assistant tool call history

- **WHEN** prior context contains an assistant `toolCall`
- **THEN** the LLM receives assistant text containing a `<tool_call>` block with the call name and arguments

#### Scenario: Canonical history is preserved

- **WHEN** text protocol context conversion runs
- **THEN** stored session messages remain canonical `toolCall` and `toolResult` messages rather than rewritten text messages

### Requirement: User-originated tags are escaped

Coding-agent MUST prevent `<tool_call>` and `<tool_result>` text from user content, tool output, or replayed history from becoming executable current-turn tool calls.

#### Scenario: Tool output contains a tag

- **WHEN** a previous tool result includes literal `<tool_call>` text
- **THEN** the provider payload represents it as non-executable result content and the agent does not parse it as a new tool request

### Requirement: Image tool results are downgraded for text protocol

When text protocol conversion encounters image content in a tool result, it SHALL send a text placeholder instead of native image payload.

#### Scenario: Image result in text mode

- **WHEN** a prior tool result contains image content
- **THEN** the provider receives a textual placeholder indicating image content is not included in text protocol

### Requirement: Text protocol prompt rules

When the active protocol is `text`, the system prompt MUST instruct the model to emit exactly one `<tool_call>` block when it needs a tool and MUST instruct it not to emit `<tool_result>`.

#### Scenario: Text tool use prompt

- **WHEN** tools are available in a `text` protocol session
- **THEN** the system prompt describes the required `<tool_call>` JSON format and lists the available tool names with compact argument schema information

### Requirement: Auto prompt treats text calls as fallback

When the active protocol is `auto`, the system prompt SHOULD describe `<tool_call>` as a fallback format and MUST NOT instruct native-tool-capable models to prefer text calls over native tool calls.

#### Scenario: Auto tool use prompt

- **WHEN** tools are available in an `auto` protocol session
- **THEN** native tools may still be passed to the provider
- **AND** the system prompt presents `<tool_call>` as fallback rather than the preferred tool call format
