# Wrapper Generation (pi-dog / pi-text / pi-auto)

## 概要

deploy.sh の最終ステップとして `~/opt/pi-dogfood/bin/` に 3 つの wrapper スクリプトを生成する。各 wrapper は `PI_CODING_AGENT_DIR` で config を分離し、`current` symlink 経由で固定 commit の Pi を起動する。

## Wrapper テンプレート

Wrapper テンプレートは `generate_wrappers` 関数内で `$DOGFOOD_ROOT` を deploy 時に展開して生成する（下記「deploy.sh 内の生成ロジック」参照）。`$HOME/opt/pi-dogfood` のハードコードは行わない。

## PI_CODING_AGENT_DIR 分離

`getAgentDir()` in `config.ts` は `process.env[ENV_AGENT_DIR]`（= `PI_CODING_AGENT_DIR`）を優先して読む。設定されていれば `expandTildePath()` で展開し、未設定なら `~/.pi/agent/` をデフォルトにする。

wrapper は `${PI_CODING_AGENT_DIR:-$HOME/.config/pi-dogfood}` をデフォルトにする。これにより:
- dogfood は `~/.config/pi-dogfood/` に auth.json, settings.json, themes/, tools/, sessions/ を持つ
- 開発用は `~/.pi/agent/` のまま干渉しない
- ユーザーが `PI_CODING_AGENT_DIR` を明示設定すれば override できる

### config dir 内の構造（Pi が自動作成）

```
~/.config/pi-dogfood/
  auth.json          — 認証情報
  settings.json      — ユーザー設定
  models.json        — モデル設定
  themes/            — カスタムテーマ
  tools/             — カスタムツール
  bin/               — managed binaries (fd, rg)
  prompts/           — プロンプトテンプレート
  sessions/          — セッションストレージ
  pi-debug.log       — デバッグログ
```

## deploy.sh 内の生成ロジック

deploy.sh Step 13（サマリー出力）の前に、`generate_wrappers` 関数として実装する。

```bash
generate_wrappers() {
  local bin_dir="$DOGFOOD_ROOT/bin"
  mkdir -p "$bin_dir"

  # pi-dog
  cat > "$bin_dir/pi-dog" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail
export PI_CODING_AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.config/pi-dogfood}"
exec "$HOME/opt/pi-dogfood/current/pi" "$@"
WRAPPER

  # pi-text
  cat > "$bin_dir/pi-text" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail
export PI_CODING_AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.config/pi-dogfood}"
exec "$HOME/opt/pi-dogfood/current/pi" --tool-protocol text "$@"
WRAPPER

  # pi-auto
  cat > "$bin_dir/pi-auto" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail
export PI_CODING_AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.config/pi-dogfood}"
exec "$HOME/opt/pi-dogfood/current/pi" --tool-protocol auto "$@"
WRAPPER

  chmod +x "$bin_dir/pi-dog" "$bin_dir/pi-text" "$bin_dir/pi-auto"
}
```

### DOGFOOD_ROOT の動的展開

`generate_wrappers` は unquoted heredoc (`<<WRAPPER`) を使い、`$DOGFOOD_ROOT` を deploy 時に展開する。`$PI_CODING_AGENT_DIR` と `$@` はエスケープして実行時展開にする。これにより `DOGFOOD_ROOT` を変更した場合もパスが自動追従する。

## PATH 設定ガイド

ユーザーの shell 設定（`~/.zshrc` 等）に以下を追加:

```bash
export PATH="$HOME/opt/pi-dogfood/bin:$PATH"
```

## 再生成の挙動

- deploy のたびに 3 wrapper すべてを上書き再生成する
- wrapper テンプレートが変わった場合、次の deploy で自動反映される
- 既存 wrapper の内容チェックは不要（冪等な上書き）
