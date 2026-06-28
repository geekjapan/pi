## Context

coding-agent には `--tools`、`--exclude-tools`、`--no-tools` など tool availability の指定はあるが、tool call protocol の指定はない。`buildSessionOptions()` は CLI args を `CreateAgentSessionOptions` へ集約しているため、ここへ protocol option を通すのが自然な入口になる。

## Goals / Non-Goals

**Goals:**

- CLI、settings、SDK option から同じ protocol 型を使えるようにする。
- default を `native` にして既存挙動を維持する。
- help/docs で text protocol の用途と安全前提を短く説明する。
- core parser と context conversion が入った後に公開し、手動 `text` mode の E2E 検証を可能にする。

**Non-Goals:**

- interactive settings UI の追加は必須にしない。まず CLI/settings file/SDK を優先する。
- provider/model ごとの自動推定は行わない。
- permission prompt や本番安全化は扱わない。
- `auto` の capability metadata と fallback diagnostics は後続 change で扱う。

## Decisions

- valid values は `"native" | "text" | "auto"` のみにする。agent core と同じ型に揃えるため。
- `auto` は fallback behavior が同じ build に含まれる場合だけ安定値として受け付ける。未実装の中間状態では reject するか experimental diagnostic を出し、silent fallback させない。
- CLI が最優先、settings が次点、未指定時は `native` とする。既存 CLI option と同じ明示指定優先にするため。
- docs は safety guarantee ではなく operational guidance として書く。Pi の既存 YOLO 方針と矛盾させないため。
- `auto` の fallback 判定と diagnostics の acceptance は `add-auto-tool-protocol-fallback` 側で満たす。

## Risks / Trade-offs

- `auto` は後続 change が実装されるまで公開タイミングに注意が必要。実装順では `auto` の挙動が入る change と同時または後に docs を有効化する。
- settings の scope は既存 SettingsManager の流儀に合わせる必要がある。新しい保存形式は既存 config と後方互換にする。
