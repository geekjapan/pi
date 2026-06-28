# ADR-001: Tool Protocol Package Boundary

- Status: Proposed
- Date: 2026-06-29
- Context: PR #10, #12 implemented text tool-call protocol across agent and coding-agent packages

## Context

The text tool-call protocol feature is currently spread across two packages:

### Current Code Map

```
packages/agent/src/
  text-tool-call.ts          — Parser & types
    ToolCallProtocol             type: "native" | "text" | "auto"
    TextToolCallExtractionResult discriminated union (accepted | rejected | none)
    extractTextToolCall()        regex-based <tool_call> tag parser
    findToolCallSpan()           locates tag boundaries in content blocks

  agent-loop.ts              — Protocol dispatch
    applyTextToolCallExtraction()  route by protocol mode, call parser
    createTextToolCallDiagnostic() diagnostic factory
    spliceAcceptedTextToolCall()   replace text with synthetic toolCall block
    appendTextToolCallDiagnostics() immutable diagnostic append

  types.ts                   — Config
    AgentLoopConfig.toolCallProtocol   optional protocol setting

  index.ts                   — Re-exports text-tool-call.ts

packages/coding-agent/src/core/
  messages.ts                — Provider-boundary conversion
    convertToLlmForProtocol()    protocol-aware message conversion
    toolCallToTextBlock()        toolCall → <tool_call> text
    toolResultToUserMessage()    toolResult → <tool_result> user message
    escapeToolProtocolTags()     tag injection prevention

  system-prompt.ts           — System prompt construction
    buildToolProtocolSection()   text/auto protocol instructions
    compactToolList()            tool schemas for text mode

  sdk.ts                     — Wiring
    CreateAgentSessionOptions.toolCallProtocol  SDK option
    convertToLlmForProtocol() call site

  settings-manager.ts        — Settings
    getToolProtocol()            read from settings file

  cli/args.ts                — CLI
    --tool-protocol native|text|auto  CLI flag
    isValidToolProtocol()        validation
```

### Dependencies

```
text-tool-call.ts → (standalone, no imports from agent)
agent-loop.ts → text-tool-call.ts
messages.ts → @earendil-works/pi-agent-core (ToolCallProtocol type only)
system-prompt.ts → @earendil-works/pi-agent-core (ToolCallProtocol type only)
```

## Decision

When the feature stabilizes, extract a `packages/tool-protocol/` package.

### Proposed Module Structure

```
packages/tool-protocol/
  src/
    types.ts                 — ToolCallProtocol, TextToolCallExtractionResult
    parser.ts                — extractTextToolCall(), findToolCallSpan()
    converter.ts             — convertToLlmForProtocol(), toolCallToTextBlock(),
                               toolResultToUserMessage(), escapeToolProtocolTags()
    prompt.ts                — buildToolProtocolSection(), compactToolList()
    index.ts                 — Public API re-exports
```

### What Stays in Current Packages

```
packages/agent/
  agent-loop.ts              — applyTextToolCallExtraction() stays here
                               (it's agent-loop orchestration, not protocol logic)
                               imports from @earendil-works/pi-tool-protocol

packages/coding-agent/
  cli/args.ts                — --tool-protocol flag (CLI concerns)
  settings-manager.ts        — getToolProtocol() (settings concerns)
  sdk.ts                     — wiring (calls tool-protocol converter)
```

### Dependency Chain After Extraction

```
tui ← ai ← tool-protocol ← agent ← coding-agent
```

`tool-protocol` depends on `ai` (for Message/Content types) but not on `agent`.

## Execution Guard (Future Scope)

A separate `packages/execution-guard/` is considered for:

- Schema validation of tool arguments before execution
- Risk scoring of tool calls (filesystem write vs read, network access)
- Permission decision logic (allow, deny, ask)
- Audit event schema for tool execution logging

This is independent of tool-protocol and would sit between agent and coding-agent:

```
tui ← ai ← tool-protocol ← agent ← execution-guard ← coding-agent
```

Not planned for immediate implementation. Revisit when permission/sandboxing features are needed.

## Trigger for Extraction

Extract `packages/tool-protocol/` when any of:

1. A second consumer needs the parser/converter (e.g., orchestrator, a new agent mode)
2. The protocol types are needed in a package that shouldn't depend on agent
3. The text-tool-call.ts file exceeds ~300 lines or gains significant new features

Until then, the current placement in agent + coding-agent is acceptable.

## Consequences

- Clearer ownership: protocol logic vs agent orchestration vs CLI integration
- Testable in isolation without agent runtime
- New dependency in the build chain (build order: tui → ai → tool-protocol → agent → coding-agent)
- CLAUDE.md and AGENTS.md Architecture sections need updating when extracted
