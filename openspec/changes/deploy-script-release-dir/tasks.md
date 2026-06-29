# Tasks

- [ ] `scripts/dogfood/deploy.sh` を作成（フラグパース、Node version チェック、clean tree アサート）
- [ ] staging dir ライフサイクル実装（mktemp + EXIT trap cleanup）
- [ ] `local-release.mjs --out --skip-bun-install` 呼び出し統合
- [ ] E2E gate 統合（`--skip-e2e` フラグ対応）
- [ ] release dir 配置 + .deploy-info 書き込み
- [ ] current symlink 更新（`ln -sfn`）
- [ ] 既存リリースチェック（`--force` フラグ対応）
- [ ] deploy 完了サマリー出力
- [ ] clean commit から `--skip-e2e` で deploy し `current/pi --version` が動作することを検証
- [ ] dirty tree で deploy がブロックされることを検証
