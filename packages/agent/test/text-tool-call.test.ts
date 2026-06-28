import { describe, expect, it } from "vitest";
import { extractTextToolCall, removeAcceptedToolCallText } from "../src/text-tool-call.ts";

describe("extractTextToolCall", () => {
	it("accepts exactly one valid tool call", () => {
		const result = extractTextToolCall(
			'before <tool_call>{"name":"read","arguments":{"path":"package.json"}}</tool_call> after',
		);

		expect(result.kind).toBe("accepted");
		if (result.kind !== "accepted") throw new Error("expected accepted result");
		expect(result.toolCall.type).toBe("toolCall");
		expect(result.toolCall.id.startsWith("text_tool_call_")).toBe(true);
		expect(result.toolCall.name).toBe("read");
		expect(result.toolCall.arguments).toEqual({ path: "package.json" });
		expect(result.diagnostics).toEqual([]);
	});

	it("rejects malformed candidates with diagnostics", () => {
		const cases: Array<{ text: string; type: string }> = [
			{ text: "<tool_call>{</tool_call>", type: "text_tool_call_invalid_json" },
			{
				text: '<tool_call>{"name":"read","arguments":{}}</tool_call><tool_call>{"name":"write","arguments":{}}</tool_call>',
				type: "text_tool_call_multiple_candidates",
			},
			{ text: "<tool_call>[]</tool_call>", type: "text_tool_call_non_object" },
			{ text: '<tool_call>{"arguments":{}}</tool_call>', type: "text_tool_call_missing_name" },
			{ text: '<tool_call>{"name":"read","arguments":[]}</tool_call>', type: "text_tool_call_invalid_arguments" },
		];

		for (const testCase of cases) {
			const result = extractTextToolCall(testCase.text);

			expect(result.kind).toBe("rejected");
			expect(result.diagnostics[0]?.type).toBe(testCase.type);
		}
	});

	it("returns none when there is no tool call candidate", () => {
		expect(extractTextToolCall("plain text")).toEqual({ kind: "none", diagnostics: [] });
		expect(extractTextToolCall("<tool_result>{}</tool_result>")).toEqual({ kind: "none", diagnostics: [] });
	});
});

describe("removeAcceptedToolCallText", () => {
	it("removes only the first tool call block", () => {
		expect(
			removeAcceptedToolCallText(
				'a <tool_call>{"name":"read","arguments":{}}</tool_call> b <tool_call>{"name":"write","arguments":{}}</tool_call>',
			),
		).toBe('a  b <tool_call>{"name":"write","arguments":{}}</tool_call>');
	});
});
