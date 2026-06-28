import { describe, expect, it } from "vitest";
import { extractTextToolCall, findToolCallSpan } from "../src/text-tool-call.ts";

function expectRejectedDiagnostic(text: string, type: string): void {
	const result = extractTextToolCall(text);

	expect(result.kind).toBe("rejected");
	if (result.kind !== "rejected") throw new Error("expected rejected result");
	expect(result.diagnostics[0]?.type).toBe(type);
}

describe("extractTextToolCall", () => {
	it("accepts a valid text tool call", () => {
		const result = extractTextToolCall('<tool_call>{"name":"read","arguments":{"path":"package.json"}}</tool_call>');

		expect(result.kind).toBe("accepted");
		if (result.kind !== "accepted") throw new Error("expected accepted result");
		expect(result.toolCall.type).toBe("toolCall");
		expect(result.toolCall.id.startsWith("text_tool_call_")).toBe(true);
		expect(result.toolCall.name).toBe("read");
		expect(result.toolCall.arguments).toEqual({ path: "package.json" });
		expect(result.diagnostics).toEqual([]);
	});

	it("returns none when there is no candidate", () => {
		expect(extractTextToolCall("plain text")).toEqual({ kind: "none", diagnostics: [] });
	});

	it("rejects invalid JSON body", () => {
		expectRejectedDiagnostic("<tool_call>{</tool_call>", "text_tool_call_invalid_json");
	});

	it("rejects multiple tool call blocks", () => {
		expectRejectedDiagnostic(
			'<tool_call>{"name":"read","arguments":{}}</tool_call><tool_call>{"name":"write","arguments":{}}</tool_call>',
			"text_tool_call_multiple_candidates",
		);
	});

	it("rejects missing name field", () => {
		expectRejectedDiagnostic('<tool_call>{"arguments":{}}</tool_call>', "text_tool_call_missing_name");
	});

	it("rejects non-object arguments", () => {
		expectRejectedDiagnostic(
			'<tool_call>{"name":"read","arguments":[]}</tool_call>',
			"text_tool_call_invalid_arguments",
		);
	});

	it("rejects array, null, and string bodies", () => {
		for (const body of ["[]", "null", '"text"']) {
			expectRejectedDiagnostic(`<tool_call>${body}</tool_call>`, "text_tool_call_non_object");
		}
	});

	it("does not parse tool result tags as tool calls", () => {
		expect(extractTextToolCall("<tool_result>{}</tool_result>")).toEqual({ kind: "none", diagnostics: [] });
	});

	it("returns unique IDs for repeated valid input", () => {
		const first = extractTextToolCall('<tool_call>{"name":"read","arguments":{}}</tool_call>');
		const second = extractTextToolCall('<tool_call>{"name":"read","arguments":{}}</tool_call>');

		expect(first.kind).toBe("accepted");
		expect(second.kind).toBe("accepted");
		if (first.kind !== "accepted" || second.kind !== "accepted") throw new Error("expected accepted results");
		expect(first.toolCall.id).not.toBe(second.toolCall.id);
	});
});

describe("findToolCallSpan", () => {
	it("returns the offsets of the tool call block", () => {
		const text = 'before <tool_call>{"name":"read","arguments":{"path":"package.json"}}</tool_call> after';
		const span = findToolCallSpan(text);

		expect(span).not.toBeNull();
		if (!span) throw new Error("expected a span");
		expect(text.slice(span.start, span.end)).toBe(
			'<tool_call>{"name":"read","arguments":{"path":"package.json"}}</tool_call>',
		);
		expect(text.slice(0, span.start)).toBe("before ");
		expect(text.slice(span.end)).toBe(" after");
	});

	it("matches only the first block when several are present", () => {
		const text =
			'<tool_call>{"name":"a","arguments":{}}</tool_call><tool_call>{"name":"b","arguments":{}}</tool_call>';
		const span = findToolCallSpan(text);

		expect(span).toEqual({ start: 0, end: '<tool_call>{"name":"a","arguments":{}}</tool_call>'.length });
	});

	it("returns null when there is no complete block", () => {
		expect(findToolCallSpan("no tool call here")).toBeNull();
		expect(findToolCallSpan("<tool_call>{unterminated")).toBeNull();
	});
});
