# Tasks

- [ ] `scripts/dogfood/rollback.sh` — 引数パース（target or "previous"）
- [ ] `scripts/dogfood/rollback.sh` — previous 解決ロジック（.deploy-info DATE ソート）
- [ ] `scripts/dogfood/rollback.sh` — SHA prefix 前方一致検索（glob）
- [ ] `scripts/dogfood/rollback.sh` — エラーケース対応（未deploy, 一致なし, ambiguous, 同一release, pi不在）
- [ ] `scripts/dogfood/rollback.sh` — symlink 切替と結果表示
- [ ] `scripts/dogfood/status.sh` — current release 情報表示（commit, date, branch, version）
- [ ] `scripts/dogfood/status.sh` — 全リリース一覧（current マーク + disk usage）
- [ ] `scripts/dogfood/status.sh` — 未 deploy 状態の表示
