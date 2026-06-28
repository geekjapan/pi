# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pi is an open-source, self-extensible coding agent harness. It's a TypeScript monorepo (`npm workspaces`) providing a multi-provider LLM CLI with an extension system, TUI, and agent runtime.

## Commands

```bash
npm install --ignore-scripts   # Install deps (never run lifecycle scripts)
npm run build                  # Build all packages (order: tui → ai → agent → coding-agent → orchestrator)
npm run check                  # Lint (Biome) + type check (tsgo) + supply-chain checks. Run after every code change.
./test.sh                      # Run all tests with API keys stripped (safe for CI)
./pi-test.sh                   # Run pi from source (any directory)
```

Single test (from package root):
```bash
node ../../node_modules/vitest/dist/cli.js --run test/specific.test.ts
```

Suite tests (coding-agent harness tests using faux provider — no API keys needed):
```bash
cd packages/coding-agent && node ../../node_modules/vitest/dist/cli.js --run test/suite/specific.test.ts
```

TUI tests use Node's built-in test runner: `node --test test/*.test.ts`

## Architecture

```
packages/
  tui/           → Terminal UI library with differential rendering, keybindings, editor component
  ai/            → Unified multi-provider LLM API (30+ providers: Anthropic, OpenAI, Google, Bedrock, etc.)
  agent/         → Agent runtime: tool-calling loop, state management, compaction, harness abstraction
  coding-agent/  → The CLI application: interactive TUI mode, print mode, RPC mode, extensions
  orchestrator/  → Experimental multi-agent orchestrator with supervisor/worker IPC
```

**Dependency chain**: `tui` ← `ai` ← `agent` ← `coding-agent`. Build in this order.

### Key subsystems in `coding-agent`

- `src/cli/` — CLI argument parsing, startup UI, config selection, model listing
- `src/core/` — Session runtime, bash executor, extension loader/runner, model resolution, event bus, keybindings, diagnostics
- `src/core/extensions/` — Extension system: loader, runner, wrapper, types
- `src/core/compaction/` — Context compaction strategies
- `src/modes/interactive/` — TUI mode (themes, widgets, rendering)
- `src/modes/rpc/` — RPC server mode for programmatic access
- `src/modes/print-mode.ts` — Non-interactive single-prompt mode (`pi -p "..."`)

### AI provider system (`packages/ai`)

Each provider has `<name>.ts` (implementation) and `<name>.models.ts` (model metadata). `models.generated.ts` is auto-generated — never edit directly; modify `scripts/generate-models.ts` and regenerate.

### Agent harness (`packages/agent`)

`src/harness/` contains the harness abstraction that `coding-agent` implements: system prompt construction, skill loading, compaction strategies, session management, environment detection.

### Extension system

Extensions are single `.ts` files or npm packages loaded at runtime. They hook into lifecycle events (tool calls, messages, UI rendering). Examples in `packages/coding-agent/examples/extensions/`.

## TypeScript Constraints

- **Erasable syntax only** (`erasableSyntaxOnly: true`): no `enum`, `namespace`, parameter properties, `import =`, `export =`. Use explicit field assignments in constructors.
- **No inline/dynamic imports**: top-level `import` only; no `await import()` or `import("pkg").Type`.
- **Formatting**: tabs, indent width 3, line width 120 (Biome).
- Uses `tsgo` (native TypeScript preview) for type checking and build.

## Testing

- Never run `npm test` or the full vitest suite directly — it includes e2e tests that activate with API keys.
- Suite tests in `packages/coding-agent/test/suite/` use `harness.ts` + the faux provider. No real API calls.
- Issue regressions go in `packages/coding-agent/test/suite/regressions/<issue-number>-<short-slug>.test.ts`.

## Git Conventions

- Commit format: `{feat,fix,docs,refactor,test,chore,perf}[(ai,tui,agent,coding-agent)]: <message>`
- Stage explicit paths only (`git add <path>`); never `git add -A` or `git add .`.
- Pre-commit hook runs `npm run check` and blocks lockfile commits unless `PI_ALLOW_LOCKFILE_CHANGE=1`.
- Direct deps pinned to exact versions. Lockfile changes require `--ignore-scripts`.

## Important Rules (see AGENTS.md for full details)

- Read `AGENTS.md` before making changes — it has detailed rules for code quality, git, testing, dependencies, changelog, and releasing.
- Run `npm run check` after every code change (not just before commit).
- Never hardcode keybindings — add to `DEFAULT_EDITOR_KEYBINDINGS` or `DEFAULT_APP_KEYBINDINGS`.
- Never modify `models.generated.ts` directly.
- Multiple agent sessions may run concurrently — only stage/commit files you changed.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **pi** (13607 symbols, 47843 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/pi/context` | Codebase overview, check index freshness |
| `gitnexus://repo/pi/clusters` | All functional areas |
| `gitnexus://repo/pi/processes` | All execution flows |
| `gitnexus://repo/pi/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.agents/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.agents/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.agents/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.agents/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.agents/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.agents/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
