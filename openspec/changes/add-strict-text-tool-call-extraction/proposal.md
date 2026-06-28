## Why

Tool Use 非対応または不安定なモデルは、ツール利用の意思を text として出せても、Pi の既存 `toolCall` block にはならないため既存 executor に届かない。まず agent core に strict な text tool call 抽出を追加し、壊れた形式や曖昧な自然文は実行しない経路を作る。

## What Changes

- `native` / `text` / `auto` の tool call protocol 型を agent core に追加する。
- P0 として `<tool_call>{...}</tool_call>` の valid JSON object だけを synthetic `toolCall` に昇格する parser/adapter を追加する。
- 1 assistant response につき最大 1 text tool call のみ受理する。
- provider 実装は変えず、provider stream と `executeToolCalls()` の間で text を synthetic `toolCall` に正規化する。
- streaming 中の partial text は実行せず、final assistant message が確定した後にだけ strict parse する。
- synthetic `toolCall` は `message_end` emit 前に assistant message へ追加し、既存の tool lookup、argument preparation、argument validation、hook、executor 経路を再利用する。
- accepted synthetic `toolCall.id` は provider-native ID と衝突しない `text_tool_call_` prefix と unique suffix を使い、conversation history 全体で一意にする。
- accepted `<tool_call>` text は raw executable tag として永続化せず、assistant message 内では synthetic `toolCall` block へ正規化する。rejected candidate の text は変更しない。
- provider stopReason が `"stop"` のままでも、synthetic `toolCall` が追加された response は通常の tool execution turn として続行する。
- parser は P0 から `accepted` / `rejected` / `none` と diagnostics を返せる構造にし、後続の `auto` fallback diagnostics で再利用できるようにする。
- parser は active tool lookup を行わず、unknown/inactive tool name は既存 lookup/preflight 経路で通常の error tool result にする。
- invalid JSON、複数 call、missing `name`、non-object `arguments` は synthetic `toolCall` にしない。
- assistant が出した `<tool_result>` は実際の tool result として受理しない。
- parser 対象は現在ターンの assistant text のみとし、user/tool result/history 内の tag は実行候補にしない。
- default は `native` のままにし、既存挙動を変えない。

## Capabilities

### New Capabilities

- `strict-text-tool-call-extraction`: text tool call candidate を strict に抽出し、検証済み synthetic tool call として既存 agent loop に渡す能力。

### Modified Capabilities

なし

## Dependencies / Order

- 推奨実装順の 1 番目。後続の `add-text-tool-protocol-context`、`expose-tool-call-protocol-setting`、`add-auto-tool-protocol-fallback` の前提になる。

## Impact

- 影響範囲は `packages/agent` の型、agent loop、text tool call parser、agent loop tests。
- `packages/coding-agent` の prompt/context/CLI 対応は後続 change で扱う。
- agmsg feedback で、provider を触らない adapter 層、streaming 完了後 parsing、current assistant turn 限定 parsing、prompt injection/tag 再生対策を反映した。
