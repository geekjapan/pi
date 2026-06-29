# Design: Wrapper Generation

## 設計判断

### Heredoc with selective escaping

wrapper テンプレート内の `$PI_CODING_AGENT_DIR`, `$@` はランタイム変数なのでエスケープし、`$DOGFOOD_ROOT` は deploy 時に展開する。unquoted heredoc (`<<WRAPPER`) を使い、`\$` でランタイム変数をエスケープする。

### exec で起動

wrapper は `exec` で Pi プロセスに置き換える。wrapper 自体がプロセスとして残らず、シグナル伝播も自然に動く。

### set -euo pipefail

wrapper でも安全のため設定。実際には `exec` の前にエラーが起きるケースは少ないが、将来的な拡張（pre-flight チェック等）に備える。

### DOGFOOD_ROOT の展開タイミング

`DOGFOOD_ROOT` をデフォルトから変更するユースケースは稀だが、サポートする。`generate_wrappers` は `$DOGFOOD_ROOT` をテンプレートに埋め込み（deploy 時展開）、ランタイムでは固定パスとして動作する。これにより wrapper は deploy 先を知っている。

### config dir のデフォルト

`~/.config/pi-dogfood` を選択した理由:
- XDG Base Directory 的な `~/.config` を使う
- `pi-dogfood` サフィックスで dogfood 用途を明示
- `~/.pi/agent/` と完全に分離

### テスト方法

1. `deploy.sh --skip-e2e` 実行後、`~/opt/pi-dogfood/bin/` に 3 ファイルが存在し executable であること
2. `pi-dog --version` が current release の version を出力すること
3. `PI_CODING_AGENT_DIR=/tmp/test-config pi-dog --version` で override が効くこと
4. `pi-text --help` の出力に `--tool-protocol` が含まれること（Pi 側で tool-protocol がセットされている間接的確認）
5. 再 deploy で wrapper が上書きされ、内容が最新テンプレートと一致すること
