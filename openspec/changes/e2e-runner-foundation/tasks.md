# Tasks

- [ ] `scripts/e2e/run-e2e.mjs` を作成（parseArgs, discoverScenarios, filterScenarios, createExecHelper, printResults, runScenarios, main）
- [ ] `scripts/e2e/scenarios/version-check.mjs` を作成（meta + run export）
- [ ] root `package.json` に `e2e` と `e2e:critical` スクリプトを追加
- [ ] `npm run build && npm run e2e:critical` で version-check が PASS することを確認
- [ ] `npm run e2e -- --scenario version-check` で単一実行を確認
- [ ] タイムアウト動作を確認（短い timeout でテスト）
- [ ] `npm run check` 通過を確認
