## Context

現行の coding-agent は `convertToLlm()` で assistant と `toolResult` を provider 向け message としてほぼ pass-through する。OpenAI-compatible provider などは `context.tools` があると native tools として送るため、Tool Use 非対応モデルでは provider 境界だけ text mode 専用に変換する必要がある。session に保存する canonical representation は引き続き `ToolCall` / `ToolResult` のままにする。

## Goals / Non-Goals

**Goals:**

- `text` protocol で native tools を provider request payload に送らない。
- synthetic tool call validation/execution が使う agent execution context の active tools は残す。
- 過去の tool call と tool result を text-only provider が理解できる履歴に変換する。
- textified 履歴を永続化せず、provider request payload のみ変換する。
- user/tool result/history 内の tag を prompt injection として再実行しない。
- `text` protocol のモデルに「1 response 1 `<tool_call>`」の strict protocol を明示する。

**Non-Goals:**

- parser や executor の実装はこの change では扱わない。
- CLI/settings による protocol 選択は後続 change に分ける。
- alias 補正や JSON repair は扱わない。

## Decisions

- `convertToLlm` は protocol-aware variant を追加し、既存関数の default 挙動は維持する。既存 provider message transform と同じ境界で処理し、session history と agent execution context には textified message や tools omission を書き戻さない。
- `text` protocol では `toolResult` を user text に変換する。native tool result role を使わない provider でも履歴を継続できるため。
- assistant の synthetic/native `toolCall` 履歴は assistant text の `<tool_call>` に変換する。モデルから見る会話履歴を text protocol に統一するため。
- tool result に画像が含まれる場合は text placeholder へ落とす。text-only protocol で binary/image payload を偽装しないため。
- prompt には format rules と禁止事項を短く追加し、tool schema は compact format にする。既存 Available tools/guidelines の構造を大きく変えず、token cost を抑えるため。
- `<tool_call>` や `<tool_result>` を textified history に含める場合、user-originated text と harness-originated block を区別できるよう escape/serialization を固定する。

## Risks / Trade-offs

- schema の全文提示は prompt を膨らませる。P0 は tool name と必要最小限の arguments schema 表現に留める。
- custom tool の schema 表現が長くなる可能性がある。まず既存 snippet と parameter schema の要約で実装し、必要なら別 change で圧縮する。
- user や tool result が tag 文字列を含むと prompt injection になる可能性がある。textification 時に user-originated tag を escape し、parser 側も current assistant turn のみを見る。
- text protocol は provider native Tool Use より壊れやすい。strict extraction と error feedback で再試行可能にする。
