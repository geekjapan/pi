## Context

`auto` mode は native Tool Use を壊さず、native call が出なかった場合だけ strict text protocol を救済するための互換層である。実行判断を広げすぎると危険な自動補正になるため、P0 の strict parser をそのまま使う。native Tool Use を試すかどうかは runtime 推測だけにせず、model capability metadata を判定材料にする。

## Goals / Non-Goals

**Goals:**

- native call がある response では native を唯一の実行対象にする。
- native call が無い response だけ strict `<tool_call>` fallback を試す。
- provider-independent `Model.capabilities.nativeToolUse` metadata を使って `auto` の native/text 選択を説明可能にする。
- rejected text candidate の理由を diagnostics として区別できるようにする。
- silent fallback/downgrade を避け、fallback 理由を観測可能にする。

**Non-Goals:**

- tool name alias、argument alias、JSON repair、自然文 shell 推測は追加しない。
- 複数 tool call の text fallback は追加しない。
- provider/model ごとの adapter は追加しない。
- full benchmark/evaluation suite は追加しない。

## Decisions

- native 優先を固定する。provider が生成した structured call の方が protocol fidelity が高く、text 側との double execution を避けるため。
- model capability metadata は既存 model metadata の近くに `capabilities?: { nativeToolUse?: boolean }` として追加する。実行時の曖昧な検出より、明示された provider-independent capability を優先するため。
- `capabilities.nativeToolUse` が omitted の場合は、user が明示的に `text` を選ばない限り current provider default behavior を保つ。
- diagnostics は finalized assistant message の `diagnostics` field に attach し、実行制御と分離する。UI/ログ/テストで原因を見られるが、rejected candidate を自動修復しないため。
- `auto` prompt は text fallback の規約を含めるが、native tools は provider に渡す。native を使えるモデルには native path を優先させるため。

## Risks / Trade-offs

- モデルが native と text の両方を出した場合、text 側の意図が捨てられる。double execution より安全なので native 優先にする。
- diagnostics が多すぎるとノイズになる。まず invalid JSON、multiple calls、invalid shape、forged tool_result、native-preferred-ignore に絞る。
- capability metadata が古いと `auto` 判定がズレる。手動 `--tool-protocol text|native` override を残し、metadata 更新は別途 model metadata generation flow に沿う。
