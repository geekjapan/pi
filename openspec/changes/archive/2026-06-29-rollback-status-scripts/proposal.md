# Rollback + Status Scripts

## 概要

dogfood deploy の rollback と状態確認スクリプトを作成する。deploy.sh が作る release dir 構造と .deploy-info を前提とする。

## rollback.sh

`scripts/dogfood/rollback.sh` — `current` symlink を別のリリースに切り替える。

### 引数

```
rollback.sh [target]
```

- `target` 省略 or `previous` — 直前リリースに切り戻す
- `target` が SHA prefix — releases/ ディレクトリ名の前方一致で検索

### 処理フロー

1. `DOGFOOD_ROOT="${DOGFOOD_ROOT:-$HOME/opt/pi-dogfood}"` を設定
2. `$DOGFOOD_ROOT/current` の readlink で現在のリリースを取得（symlink が存在しなければ "No active deployment" で exit 1）
3. target の解決:
   - `previous`: `$DOGFOOD_ROOT/releases/` 内の全 `.deploy-info` から DATE を読み、降順ソートして current の次を選択
   - SHA prefix: `$DOGFOOD_ROOT/releases/$prefix*` の glob で一致するディレクトリを検索
4. 一致が 0 件 → "No matching release found" で exit 1
5. 一致が 2 件以上（SHA prefix の場合）→ "Ambiguous prefix, matches: ..." で exit 1
6. target が current と同じ → "Already on this release" で exit 0
7. target ディレクトリに `pi` バイナリ（symlink）が存在することを検証
8. `ln -sfn "$TARGET_RELEASE" "$CURRENT_LINK"` で切替
9. 出力:

```
Rolled back:
  From: <old-sha> (<old-date>)
  To:   <new-sha> (<new-date>)
  Current: ~/opt/pi-dogfood/current -> releases/<new-sha>/
```

### エラーケース

| 状態 | 動作 |
|------|------|
| deploy 未実行（current なし） | exit 1 + "No active deployment" |
| リリースが 1 つだけで previous | exit 1 + "No previous release available" |
| SHA prefix が一致なし | exit 1 + "No matching release" |
| SHA prefix が複数一致 | exit 1 + 候補一覧を表示 |
| target が current と同じ | exit 0 + "Already on this release" |
| target に pi バイナリなし | exit 1 + "Invalid release: pi binary not found" |

## status.sh

`scripts/dogfood/status.sh` — 現在の deploy 状態を表示する。

### 処理フロー

1. `DOGFOOD_ROOT="${DOGFOOD_ROOT:-$HOME/opt/pi-dogfood}"` を設定
2. `$DOGFOOD_ROOT/current` が存在しなければ "Not deployed" を表示して exit 0
3. current release の情報を表示:
   - readlink で current のパスを取得
   - `.deploy-info` を source して COMMIT, DATE, BRANCH を表示
   - `"$CURRENT_LINK/pi" --version` を実行して Pi バージョンを表示
4. 全リリース一覧:
   - `$DOGFOOD_ROOT/releases/` を ls
   - 各ディレクトリの `.deploy-info` から DATE を読む
   - current に一致するものに `*` マークを付ける
   - `du -sh` で各リリースの disk usage を表示

### 出力例

```
Pi Dogfood Status
  Version: 0.80.2
  Commit:  abcdef123456 (main)
  Date:    2026-06-29T15:30:00Z
  Path:    ~/opt/pi-dogfood/current -> releases/abcdef123456/

Releases:
  * abcdef123456  2026-06-29T15:30:00Z  main   125M
    987654321abc  2026-06-28T10:00:00Z  main   118M
```

### 未 deploy 状態の出力

```
Pi Dogfood Status
  Not deployed

  Run: bash scripts/dogfood/deploy.sh
```

## Non-goals

- 古いリリースの自動削除（gc.sh は将来の別タスク）
- deploy.sh の修正（rollback/status は読み取り専用で deploy インフラに触らない）
