# Tasks

- [x] 全 `packages/*/package.json` の `name`, `private`, `publishConfig` を確認
- [x] publish 抑止が必要なパッケージに `"private": true` を追加
- [x] `scripts/publish.mjs` の safety check 確認（scope チェックなし — private フラグで防御）
- [x] `npm run check` 通過を確認
