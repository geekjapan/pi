## Context

現行の `packages/agent/src/agent-loop.ts` は assistant message の `content` に含まれる `type === "toolCall"` を実行対象にしている。tool lookup、`prepareArguments`、schema validation、`beforeToolCall`、executor、`afterToolCall` は既に共通経路として存在するため、provider を改修せず、provider stream と agent loop の tool execution 判定の間で text から synthetic `toolCall` を作るのが最小改修になる。

## Goals / Non-Goals

**Goals:**

- text tool call candidate を未信頼入力として扱い、strict validation 後にだけ synthetic `toolCall` へ昇格する。
- 既存の native tool call 実行経路を再利用する。
- streaming の partial text では実行せず、final assistant message に対してだけ parse する。
- parser 対象を現在ターンの assistant text に限定する。
- `native` default を維持し、既存 provider の動作を変えない。

**Non-Goals:**

- 壊れた JSON の repair、自然文からの tool 推測、alias 補正、複数 tool call 実行は扱わない。
- workspace boundary enforcement や permission system は追加しない。
- coding-agent の prompt/context/CLI 設定はこの change には含めない。

## Decisions

- parser/adapter は `<tool_call>` tag を 1 個だけ受理する。曖昧な自然文を実行に変換しないため。
- JSON body は object のみ受理し、`name: string` と `arguments: object` を必須にする。既存 schema validation 前の最低限の構造検査に留めるため。
- parser/adapter は active tool membership を検査しない。unknown/inactive name は既存 tool lookup/preflight へ渡し、通常の error tool result にするため。
- synthetic `toolCall` は `streamAssistantResponse()` 内で final message 確定後、`message_end` emit 前に追加する。TUI、session、event stream が同じ message を見るため。
- streaming 中に tag が分割されることは想定し、partial event では parse しない。`response.result()` で得た final message の text block を buffer として扱う。
- parser は current assistant message の text block だけを見る。履歴、user content、tool result 内 tag を再実行しないため。
- synthetic `toolCall.id` は `text_tool_call_` prefix と UUID/random 相当の unique suffix を使い、conversation history 全体で一意にする。provider-native ID と区別し、tool result correlation と provider history replay では通常の `toolCallId` として扱うため。
- accepted `<tool_call>` text は raw executable tag として message に残さず、synthetic `toolCall` block へ正規化する。後続 turn で raw tag が再度 provider payload に混入することと、textified history で重複することを避けるため。rejected candidate は debugging と通常表示のため text を変更しない。
- provider が返した `stopReason` は tool execution の判定条件にしない。synthetic `toolCall` が final assistant message に追加された場合、元の stopReason が `"stop"` でも既存の `toolCall` content 判定で executor に進む。
- parser/adapter の戻り値は P0 から structured result にする。

```ts
type TextToolCallExtractionResult =
	| {
			kind: "accepted";
			toolCall: AgentToolCall;
			diagnostics: AssistantMessageDiagnostic[];
	  }
	| {
			kind: "rejected";
			diagnostics: AssistantMessageDiagnostic[];
	  }
	| {
			kind: "none";
			diagnostics: AssistantMessageDiagnostic[];
	  };
```

この change では diagnostics を自動修復や UI 表示の条件にしない。後続の `add-auto-tool-protocol-fallback` が同じ構造を使って fallback/rejection reason を finalized assistant message に観測可能にする。
- protocol 型は agent core に追加するが default は `native` とする。後続 change が設定 UI/CLI を公開するまで既存挙動を固定するため。

## Risks / Trade-offs

- `message_end` 前の message 変更は event order に影響する可能性がある。loop test で `message_start` / `message_update` / `message_end` に synthetic block が反映されることを確認する。
- user/tool result に含まれる `<tool_call>` が prompt injection として再生される可能性がある。parser scope を current assistant message に限定し、history conversion 側では tag escaping を扱う。
- strict parser は一部モデルの自然な出力を拾わない。P0 は安全側に倒し、後続 change で `auto` fallback と diagnostics を追加する。
- validation は安全境界そのものではない。Pi の YOLO 運用は引き続き隔離済み実行環境を前提にする。
