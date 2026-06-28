## 1. Auto Mode Behavior

- [ ] 1.1 Implement native-priority protocol selection for `auto`.
- [ ] 1.2 Run strict text fallback only when no native tool calls exist.
- [ ] 1.3 Ensure mixed native/text responses do not double execute.
- [ ] 1.4 Add `Model.capabilities.nativeToolUse?: boolean` metadata for native tool support and use it as an input to `auto`.
- [ ] 1.5 Preserve manual `native` and `text` overrides even when metadata suggests another path.

## 2. Diagnostics

- [ ] 2.1 Add stable diagnostic codes for invalid JSON, multiple calls, invalid shape, forged `tool_result`, and ignored text call because native was present.
- [ ] 2.2 Add diagnostics for metadata-driven protocol decisions and fallback reasons.
- [ ] 2.3 Attach diagnostics to the finalized assistant message `diagnostics` field and surface them through the existing event/logging path without adding automatic repair.
- [ ] 2.4 Document that diagnostics are observability only, not a permission system.

## 3. Verification

- [ ] 3.1 Add tests for native priority in `auto` mode.
- [ ] 3.2 Add tests for text fallback when native calls are absent.
- [ ] 3.3 Add tests for metadata-driven auto decisions and manual override precedence.
- [ ] 3.4 Add tests for each diagnostic category.
- [ ] 3.5 Run the targeted tests and `npm run check`.
