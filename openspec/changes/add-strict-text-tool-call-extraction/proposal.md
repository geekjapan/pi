## Why

Tool Use 非対応または不安定なモデルは、ツール利用の意思を text として出せても、Pi の既存 `toolCall` block にはならないため既存 executor に届かない。まず agent core に strict な text tool call 抽出を追加し、壊れた形式や曖昧な自然文は実行しない経路を作る。

## What Changes

- `native` / `text` / `auto` の tool call protocol 型を agent core に追加する。
- P0 として `<tool_call>{...}</tool_call>` の valid JSON object だけを synthetic `toolCall` に昇格する parser/adapter を追加する。
- 1 assistant response につき最大 1 text tool call のみ受理する。
- provider 実装は変えず、provider stream と `executeToolCalls()` の間で text を synthetic `toolCall` に正規化する。
- streaming 中の partial text は実行せず、final assistant message が確定した後にだけ strict parse する。
- synthetic `toolCall` は `message_end` emit 前に assistant message へ追加し、既存の tool lookup、argument preparation、argument validation、hook、executor 経路を再利用する。
- invalid JSON、複数 call、missing `name`、non-object `arguments`、assistant が出した `<tool_result>` は実行対象にしない。
- parser 対象は現在ターンの assistant text のみとし、user/tool result/history 内の tag は実行候補にしない。
- default は `native` のままにし、既存挙動を変えない。

## Capabilities

### New Capabilities

- `strict-text-tool-call-extraction`: text tool call candidate を strict に抽出し、検証済み synthetic tool call として既存 agent loop に渡す能力。

### Modified Capabilities

なし

## Impact

- 影響範囲は `packages/agent` の型、agent loop、text tool call parser、agent loop tests。
- `packages/coding-agent` の prompt/context/CLI 対応は後続 change で扱う。
- agmsg feedback で、provider を触らない adapter 層、streaming 完了後 parsing、current assistant turn 限定 parsing、prompt injection/tag 再生対策を反映した。
