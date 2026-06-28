## 1. Context Conversion

- [x] 1.1 Add a protocol-aware LLM message conversion path for coding-agent.
- [x] 1.2 Convert assistant `toolCall` history into assistant text `<tool_call>` blocks in `text` mode.
- [x] 1.3 Convert `toolResult` history into user text `<tool_result>` blocks in `text` mode.
- [x] 1.4 Preserve canonical session history; do not persist textified tool history back into session storage.
- [x] 1.5 Escape or serialize user/tool-result tag text so it cannot be replayed as executable `<tool_call>`.
- [x] 1.6 Downgrade image content in tool results to a text placeholder for text protocol payloads.

## 2. Provider Request And Prompt

- [x] 2.1 Suppress native `tools` only in the provider request payload when protocol is `text`; do not remove active tools from the agent execution context.
- [x] 2.2 Add strict text tool protocol instructions to the system prompt for `text`, and describe text calls only as fallback in `auto`.
- [x] 2.3 Include available tool names and compact argument schema information in the prompt.

## 3. Verification

- [x] 3.1 Add tests proving text mode does not send native tools.
- [x] 3.2 Add tests for textified assistant tool call and tool result history.
- [x] 3.3 Add tests proving canonical history is not rewritten during provider payload conversion.
- [x] 3.4 Add tests for tag escaping and image result downgrade.
- [x] 3.5 Add system prompt tests for protocol rules and available tool listing.
- [x] 3.6 Run the targeted tests and `npm run check`.
