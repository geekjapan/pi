# Tasks

- [ ] `scripts/e2e/helpers.mjs` に `assertNoStackTrace(stdout, stderr)` を作成
- [ ] `scripts/e2e/scenarios/help-check.mjs` を作成（exit 0, "Usage:", "--tool-protocol" 検証）
- [ ] `scripts/e2e/scenarios/invalid-tool-protocol.mjs` を作成（no crash, warning diagnostic 検証）
- [ ] `scripts/e2e/scenarios/startup-native.mjs` を作成（no crash, no stack trace 検証）
- [ ] `scripts/e2e/scenarios/startup-text-protocol.mjs` を作成（no crash, no stack trace 検証）
- [ ] `npm run e2e:critical` で 5 シナリオすべて PASS を確認
- [ ] `npm run check` 通過を確認
