# Plan Tool Protocol Package Boundary

## 概要

text tool-call protocol 関連コードの package 境界設計を計画する。実装は行わず、設計文書として残す。

## 背景

#12 で実装された text tool-call protocol は現在 `packages/agent` と `packages/coding-agent` に分散している:

- `packages/agent/src/text-tool-call.ts` — parser, extraction
- `packages/agent/src/agent-loop.ts` — protocol dispatch (applyTextToolCallExtraction)
- `packages/coding-agent/src/core/messages.ts` — message conversion (convertToLlmForProtocol)
- `packages/coding-agent/src/core/system-prompt.ts` — protocol section builder

将来的に `packages/tool-protocol/` として分離するための設計を ADR として文書化する。

## 変更内容

1. 現在の text tool protocol コードの責務マップを作成
2. `packages/tool-protocol/` の module 構成案を設計
3. `packages/execution-guard/` の scope 案（将来）
4. ADR として `docs/adr/` に記録

## Non-goals

- 実際の package 分離（安定後に実施）
- execution-guard の実装
