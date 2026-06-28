import type { AssistantMessageDiagnostic } from "@earendil-works/pi-ai/compat";
import type { AgentToolCall } from "./types.ts";

const TOOL_CALL_BLOCK_PATTERN = /<tool_call>([\s\S]*?)<\/tool_call>/g;
const FIRST_TOOL_CALL_BLOCK_PATTERN = /<tool_call>[\s\S]*?<\/tool_call>/;

export type ToolCallProtocol = "native" | "text" | "auto";

export type TextToolCallExtractionResult =
	| { kind: "accepted"; toolCall: AgentToolCall; diagnostics: AssistantMessageDiagnostic[] }
	| { kind: "rejected"; diagnostics: AssistantMessageDiagnostic[] }
	| { kind: "none"; diagnostics: AssistantMessageDiagnostic[] };

function diagnostic(type: string, details?: Record<string, unknown>): AssistantMessageDiagnostic {
	return { type, timestamp: Date.now(), ...(details ? { details } : {}) };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		Object.getPrototypeOf(value) === Object.prototype
	);
}

export function extractTextToolCall(textBlocks: string): TextToolCallExtractionResult {
	const candidates = Array.from(textBlocks.matchAll(TOOL_CALL_BLOCK_PATTERN), (match) => match[1] ?? "");

	if (candidates.length === 0) return { kind: "none", diagnostics: [] };
	if (candidates.length > 1) {
		return {
			kind: "rejected",
			diagnostics: [diagnostic("text_tool_call_multiple_candidates", { candidateCount: candidates.length })],
		};
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(candidates[0].trim());
	} catch (error) {
		return {
			kind: "rejected",
			diagnostics: [
				diagnostic("text_tool_call_invalid_json", {
					message: error instanceof Error ? error.message : String(error),
				}),
			],
		};
	}

	if (!isPlainObject(parsed)) {
		return { kind: "rejected", diagnostics: [diagnostic("text_tool_call_non_object")] };
	}

	if (typeof parsed.name !== "string") {
		return { kind: "rejected", diagnostics: [diagnostic("text_tool_call_missing_name")] };
	}

	if (!isPlainObject(parsed.arguments)) {
		return { kind: "rejected", diagnostics: [diagnostic("text_tool_call_invalid_arguments")] };
	}

	return {
		kind: "accepted",
		toolCall: {
			type: "toolCall",
			id: `text_tool_call_${crypto.randomUUID()}`,
			name: parsed.name,
			arguments: parsed.arguments,
		},
		diagnostics: [],
	};
}

/**
 * Locate the first `<tool_call>...</tool_call>` span in `text`.
 *
 * Returns the half-open `[start, end)` character offsets of the match, or `null`
 * when no complete block is present. Callers normalize an accepted candidate by
 * slicing this span out of the joined assistant text, which keeps the removal
 * correct even when the tag is split across multiple text content blocks.
 */
export function findToolCallSpan(text: string): { start: number; end: number } | null {
	const match = text.match(FIRST_TOOL_CALL_BLOCK_PATTERN);
	if (!match || match.index === undefined) return null;
	return { start: match.index, end: match.index + match[0].length };
}
