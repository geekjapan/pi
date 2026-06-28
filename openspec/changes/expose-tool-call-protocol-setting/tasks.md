## 1. Configuration Plumbing

- [ ] 1.1 Add `toolProtocol` to `CreateAgentSessionOptions` and service/session option forwarding.
- [ ] 1.2 Add `toolProtocol` to settings with valid values `native`, `text`, and gated `auto`.
- [ ] 1.3 Resolve protocol precedence as CLI, settings, then `native`.

## 2. CLI And Docs

- [ ] 2.1 Add `--tool-protocol native|text|auto` parsing and diagnostics, accepting stable `auto` only when auto fallback behavior is available.
- [ ] 2.2 Add help text and examples for text protocol usage.
- [ ] 2.3 Add docs describing YOLO/sandbox assumptions and what validation does not guarantee.
- [ ] 2.4 Ensure explicit `--tool-protocol text` can exercise parser and context conversion end-to-end after the prior changes land.

## 3. Verification

- [ ] 3.1 Add CLI args tests for valid, invalid, and gated `auto` protocol values.
- [ ] 3.2 Add session option tests for precedence.
- [ ] 3.3 Run the targeted tests and `npm run check`.
