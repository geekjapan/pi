# Architecture

Pi is a TypeScript monorepo (`npm workspaces`) providing a multi-provider LLM CLI with an extension system, TUI, and agent runtime.

```
packages/
  tui/           → Terminal UI library with differential rendering, keybindings, editor component
  ai/            → Unified multi-provider LLM API (30+ providers: Anthropic, OpenAI, Google, Bedrock, etc.)
  agent/         → Agent runtime: tool-calling loop, state management, compaction, harness abstraction
  coding-agent/  → The CLI application: interactive TUI mode, print mode, RPC mode, extensions
  orchestrator/  → Experimental multi-agent orchestrator with supervisor/worker IPC
```

**Dependency chain**: `tui` ← `ai` ← `agent` ← `coding-agent`. Build in this order.

## Key subsystems in `coding-agent`

- `src/cli/` — CLI argument parsing, startup UI, config selection, model listing
- `src/core/` — Session runtime, bash executor, extension loader/runner, model resolution, event bus, keybindings, diagnostics
- `src/core/extensions/` — Extension system: loader, runner, wrapper, types
- `src/core/compaction/` — Context compaction strategies
- `src/modes/interactive/` — TUI mode (themes, widgets, rendering)
- `src/modes/rpc/` — RPC server mode for programmatic access
- `src/modes/print-mode.ts` — Non-interactive single-prompt mode (`pi -p "..."`)

## AI provider system (`packages/ai`)

Each provider has `<name>.ts` (implementation) and `<name>.models.ts` (model metadata). `models.generated.ts` is auto-generated — never edit directly; modify `scripts/generate-models.ts` and regenerate (see AGENTS.md → Code Quality).

## Agent harness (`packages/agent`)

`src/harness/` contains the harness abstraction that `coding-agent` implements: system prompt construction, skill loading, compaction strategies, session management, environment detection.

## Extension system

Extensions are single `.ts` files or npm packages loaded at runtime. They hook into lifecycle events (tool calls, messages, UI rendering). Examples in `packages/coding-agent/examples/extensions/`.
