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

	it("accepts an unclosed tool_call block with JSON body prefix", () => {
		const result = extractTextToolCall(
			'<tool_call>\n{"name":"write","arguments":{"path":"/tmp/a","content":"ok"}}\nDONE',
		);

		expect(result.kind).toBe("accepted");
		if (result.kind !== "accepted") throw new Error("expected accepted result");
		expect(result.toolCall.name).toBe("write");
		expect(result.toolCall.arguments).toEqual({ path: "/tmp/a", content: "ok" });
	});

	it("accepts an unclosed tool_call block with a name prefix and JSON arguments", () => {
		const result = extractTextToolCall('<tool_call>read{"path":"/tmp/a"}');

		expect(result.kind).toBe("accepted");
		if (result.kind !== "accepted") throw new Error("expected accepted result");
		expect(result.toolCall.name).toBe("read");
		expect(result.toolCall.arguments).toEqual({ path: "/tmp/a" });
	});

	it("accepts an unclosed tool_call block with a name assignment and JSON arguments", () => {
		const result = extractTextToolCall('<tool_call> read={"path":"/tmp/a"}');

		expect(result.kind).toBe("accepted");
		if (result.kind !== "accepted") throw new Error("expected accepted result");
		expect(result.toolCall.name).toBe("read");
		expect(result.toolCall.arguments).toEqual({ path: "/tmp/a" });
	});

	it("uses named top-level properties as arguments when arguments is omitted", () => {
		const result = extractTextToolCall('<tool_call>{"name":"bash","command":"true"}</tool_call>');

		expect(result.kind).toBe("accepted");
		if (result.kind !== "accepted") throw new Error("expected accepted result");
		expect(result.toolCall.name).toBe("bash");
		expect(result.toolCall.arguments).toEqual({ command: "true" });
	});

	it("accepts a malformed start tag with the JSON object inside the tag", () => {
		const result = extractTextToolCall('<tool_call{"arguments":{"path":"package.json"},"name":"read"}>');

		expect(result.kind).toBe("accepted");
		if (result.kind !== "accepted") throw new Error("expected accepted result");
		expect(result.toolCall.name).toBe("read");
		expect(result.toolCall.arguments).toEqual({ path: "package.json" });
	});

	it("accepts malformed start tag arguments containing braces and greater-than signs", () => {
		const result = extractTextToolCall(
			'<tool_call{"name":"write","arguments":{"path":"/tmp/a","content":"a > b { ok }"}}>',
		);

		expect(result.kind).toBe("accepted");
		if (result.kind !== "accepted") throw new Error("expected accepted result");
		expect(result.toolCall.arguments).toEqual({ path: "/tmp/a", content: "a > b { ok }" });
	});

	it("accepts a malformed start tag followed directly by a closing tag", () => {
		const result = extractTextToolCall(
			'<tool_call{"arguments":{"path":"/tmp/a","content":"ok"},"name":"write"}</tool_call>',
		);

		expect(result.kind).toBe("accepted");
		if (result.kind !== "accepted") throw new Error("expected accepted result");
		expect(result.toolCall.name).toBe("write");
		expect(result.toolCall.arguments).toEqual({ path: "/tmp/a", content: "ok" });
	});

	it("accepts a malformed start tag with an extra angle before JSON", () => {
		const result = extractTextToolCall('<tool_call<{"name":"bash","arguments":{"command":"true"}}>');

		expect(result.kind).toBe("accepted");
		if (result.kind !== "accepted") throw new Error("expected accepted result");
		expect(result.toolCall.name).toBe("bash");
		expect(result.toolCall.arguments).toEqual({ command: "true" });
	});

	it("accepts malformed start tags with extra trailing braces", () => {
		const withClose = extractTextToolCall('<tool_call{"name":"find","arguments":{"pattern":"*.md"}}} />');
		const withoutClose = extractTextToolCall('<tool_call{"name":"ls","arguments":{}}}');

		expect(withClose.kind).toBe("accepted");
		expect(withoutClose.kind).toBe("accepted");
		if (withClose.kind !== "accepted" || withoutClose.kind !== "accepted") {
			throw new Error("expected accepted results");
		}
		expect(withClose.toolCall.name).toBe("find");
		expect(withoutClose.toolCall.name).toBe("ls");
	});

	it("accepts pipe-delimited call syntax", () => {
		const result = extractTextToolCall(
			`<|tool_call>call:bash{command:"printf 'ok' > /tmp/out",timeout:5}<tool_call|>`,
		);

		expect(result.kind).toBe("accepted");
		if (result.kind !== "accepted") throw new Error("expected accepted result");
		expect(result.toolCall.name).toBe("bash");
		expect(result.toolCall.arguments).toEqual({ command: "printf 'ok' > /tmp/out", timeout: 5 });
	});

	it("accepts parenthesized tool_call JSON", () => {
		const result = extractTextToolCall('(tool_call {"name":"write","arguments":{"path":"/tmp/a","content":"ok"}})');

		expect(result.kind).toBe("accepted");
		if (result.kind !== "accepted") throw new Error("expected accepted result");
		expect(result.toolCall.name).toBe("write");
		expect(result.toolCall.arguments).toEqual({ path: "/tmp/a", content: "ok" });
	});

	it("accepts fenced tool_call JSON", () => {
		const result = extractTextToolCall(
			'```tool_call\n{"name":"grep","arguments":{"path":"/tmp/a","pattern":"needle","literal":true,"limit":5}}\n```',
		);

		expect(result.kind).toBe("accepted");
		if (result.kind !== "accepted") throw new Error("expected accepted result");
		expect(result.toolCall.name).toBe("grep");
		expect(result.toolCall.arguments).toEqual({ path: "/tmp/a", pattern: "needle", literal: true, limit: 5 });
	});

	it("accepts slash-prefixed tool_call JSON", () => {
		const result = extractTextToolCall('/tool_call{"name":"ls","arguments":{"path":"/tmp/a","limit":20}}');

		expect(result.kind).toBe("accepted");
		if (result.kind !== "accepted") throw new Error("expected accepted result");
		expect(result.toolCall.name).toBe("ls");
		expect(result.toolCall.arguments).toEqual({ path: "/tmp/a", limit: 20 });
	});

	it("accepts XML-style tool_call name attribute with JSON body arguments", () => {
		const result = extractTextToolCall('<tool_call name="write">\n{"path":"/tmp/a","content":"ok"}\n</tool_call>');

		expect(result.kind).toBe("accepted");
		if (result.kind !== "accepted") throw new Error("expected accepted result");
		expect(result.toolCall.name).toBe("write");
		expect(result.toolCall.arguments).toEqual({ path: "/tmp/a", content: "ok" });
	});

	it("accepts XML-style tool_call name and arguments attributes", () => {
		const result = extractTextToolCall(
			'<tool_call name="edit" arguments={"path":"/tmp/a","edits":[{"oldText":"a","newText":"b"}]}></tool_call>',
		);

		expect(result.kind).toBe("accepted");
		if (result.kind !== "accepted") throw new Error("expected accepted result");
		expect(result.toolCall.name).toBe("edit");
		expect(result.toolCall.arguments).toEqual({ path: "/tmp/a", edits: [{ oldText: "a", newText: "b" }] });
	});

	it("uses a default tool name and merges top-level arguments when provided", () => {
		const result = extractTextToolCall('<tool_call{"arguments":{"oldText":"a","newText":"b"},"path":"/tmp/a"}>', {
			defaultName: "edit",
		});

		expect(result.kind).toBe("accepted");
		if (result.kind !== "accepted") throw new Error("expected accepted result");
		expect(result.toolCall.name).toBe("edit");
		expect(result.toolCall.arguments).toEqual({ oldText: "a", newText: "b", path: "/tmp/a" });
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

	it("returns the offsets of a malformed start tag tool call", () => {
		const text = 'before <tool_call{"arguments":{"path":"package.json"},"name":"read"}> after';
		const span = findToolCallSpan(text);

		expect(span).not.toBeNull();
		if (!span) throw new Error("expected a span");
		expect(text.slice(span.start, span.end)).toBe('<tool_call{"arguments":{"path":"package.json"},"name":"read"}>');
		expect(text.slice(0, span.start)).toBe("before ");
		expect(text.slice(span.end)).toBe(" after");
	});

	it("returns the offsets of malformed start tag variants", () => {
		const text = 'before <tool_call{"arguments":{"path":"/tmp/a","content":"ok"},"name":"write"}</tool_call> after';
		const span = findToolCallSpan(text);

		expect(span).not.toBeNull();
		if (!span) throw new Error("expected a span");
		expect(text.slice(span.start, span.end)).toBe(
			'<tool_call{"arguments":{"path":"/tmp/a","content":"ok"},"name":"write"}</tool_call>',
		);
		expect(text.slice(0, span.start)).toBe("before ");
		expect(text.slice(span.end)).toBe(" after");
	});

	it("returns the offsets of XML-style tool call variants", () => {
		const text = 'before <tool_call name="read" arguments={"path":"/tmp/a"}> after';
		const span = findToolCallSpan(text);

		expect(span).not.toBeNull();
		if (!span) throw new Error("expected a span");
		expect(text.slice(span.start, span.end)).toBe('<tool_call name="read" arguments={"path":"/tmp/a"}>');
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
