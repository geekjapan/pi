import type { AssistantMessageDiagnostic } from "@earendil-works/pi-ai/compat";
import type { AgentToolCall } from "./types.ts";

const TOOL_CALL_BLOCK_PATTERN = /<tool_call>([\s\S]*?)<\/tool_call>/g;
const FIRST_TOOL_CALL_BLOCK_PATTERN = /<tool_call>[\s\S]*?<\/tool_call>/;
const PIPE_TOOL_CALL_PATTERN = /<\|tool_call>call:([A-Za-z0-9_-]+)\{([\s\S]*?)\}<tool_call\|>/g;
const FENCED_TOOL_CALL_PATTERN = /```tool_call\s*([\s\S]*?)```/g;
const TOOL_CALL_OPEN_TAG = "<tool_call>";
const MALFORMED_TOOL_CALL_PREFIX = "<tool_call";
const PAREN_TOOL_CALL_PREFIX = "(tool_call";
const SLASH_TOOL_CALL_PREFIX = "/tool_call";

interface TextToolCallCandidate {
	body: string;
	start: number;
	end: number;
}

export type ToolCallProtocol = "native" | "text" | "auto";

export type TextToolCallExtractionResult =
	| { kind: "accepted"; toolCall: AgentToolCall; diagnostics: AssistantMessageDiagnostic[] }
	| { kind: "rejected"; diagnostics: AssistantMessageDiagnostic[] }
	| { kind: "none"; diagnostics: AssistantMessageDiagnostic[] };

interface TextToolCallExtractionOptions {
	defaultName?: string;
}

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

export function extractTextToolCall(
	textBlocks: string,
	options: TextToolCallExtractionOptions = {},
): TextToolCallExtractionResult {
	const candidates = findToolCallCandidates(textBlocks).map((candidate) => candidate.body);

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

	const name = typeof parsed.name === "string" ? parsed.name : options.defaultName;
	if (!name) {
		return { kind: "rejected", diagnostics: [diagnostic("text_tool_call_missing_name")] };
	}

	const toolArguments = getToolArguments(parsed, typeof parsed.name !== "string");
	if (!toolArguments) {
		return { kind: "rejected", diagnostics: [diagnostic("text_tool_call_invalid_arguments")] };
	}

	return {
		kind: "accepted",
		toolCall: {
			type: "toolCall",
			id: `text_tool_call_${crypto.randomUUID()}`,
			name,
			arguments: toolArguments,
		},
		diagnostics: [],
	};
}

function getToolArguments(
	parsed: Record<string, unknown>,
	mergeTopLevel: boolean,
): Record<string, unknown> | undefined {
	const { name: _name, arguments: args, ...topLevelArgs } = parsed;
	if (isPlainObject(args)) {
		if (!mergeTopLevel) return args;
		if (Object.keys(topLevelArgs).length === 0) return args;
		return { ...args, ...topLevelArgs };
	}
	if ("arguments" in parsed) return undefined;
	if (Object.keys(topLevelArgs).length === 0) return undefined;
	return topLevelArgs;
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
	const candidate = findToolCallCandidates(text)[0];
	if (candidate) return { start: candidate.start, end: candidate.end };

	const match = text.match(FIRST_TOOL_CALL_BLOCK_PATTERN);
	if (!match || match.index === undefined) return null;
	return { start: match.index, end: match.index + match[0].length };
}

function findToolCallCandidates(text: string): TextToolCallCandidate[] {
	return [
		...Array.from(text.matchAll(TOOL_CALL_BLOCK_PATTERN), (match) => ({
			body: match[1] ?? "",
			start: match.index ?? 0,
			end: (match.index ?? 0) + match[0].length,
		})),
		...findPipeToolCallCandidates(text),
		...findFencedToolCallCandidates(text),
		...findUnclosedToolCallCandidates(text),
		...findPrefixedJsonToolCallCandidates(text, PAREN_TOOL_CALL_PREFIX, ")"),
		...findPrefixedJsonToolCallCandidates(text, SLASH_TOOL_CALL_PREFIX),
		...findAttributeToolCallCandidates(text),
		...findMalformedToolCallCandidates(text),
	].sort((a, b) => a.start - b.start);
}

function findPipeToolCallCandidates(text: string): TextToolCallCandidate[] {
	return Array.from(text.matchAll(PIPE_TOOL_CALL_PATTERN), (match) => {
		const name = match[1] ?? "";
		const args = parseLooseArguments(match[2] ?? "");
		return {
			body: JSON.stringify({ name, arguments: args ?? {} }),
			start: match.index ?? 0,
			end: (match.index ?? 0) + match[0].length,
		};
	});
}

function findUnclosedToolCallCandidates(text: string): TextToolCallCandidate[] {
	const candidates: TextToolCallCandidate[] = [];
	let start = text.indexOf(TOOL_CALL_OPEN_TAG);

	while (start !== -1) {
		const bodyStart = start + TOOL_CALL_OPEN_TAG.length;
		if (text.indexOf("</tool_call>", bodyStart) === -1) {
			const body = readToolCallBodyPrefix(text, bodyStart);
			if (body) candidates.push({ ...body, start });
		}
		start = text.indexOf(TOOL_CALL_OPEN_TAG, start + TOOL_CALL_OPEN_TAG.length);
	}

	return candidates;
}

function readToolCallBodyPrefix(text: string, start: number): { body: string; end: number } | undefined {
	let index = start;
	while (/\s/.test(text[index] ?? "")) index++;

	if (text[index] === "{") {
		const jsonEnd = findJsonObjectEnd(text, index);
		return jsonEnd === null ? undefined : { body: text.slice(index, jsonEnd), end: jsonEnd };
	}

	const nameMatch = /^[A-Za-z0-9_-]+/.exec(text.slice(index));
	if (!nameMatch) return undefined;
	const name = nameMatch[0];
	index += name.length;
	while (/\s/.test(text[index] ?? "")) index++;
	if (text[index] === "=") {
		index++;
		while (/\s/.test(text[index] ?? "")) index++;
	}
	if (text[index] !== "{") return undefined;

	const jsonEnd = findJsonObjectEnd(text, index);
	if (jsonEnd === null) return undefined;
	return {
		body: `{"name":${JSON.stringify(name)},"arguments":${text.slice(index, jsonEnd)}}`,
		end: jsonEnd,
	};
}

function findFencedToolCallCandidates(text: string): TextToolCallCandidate[] {
	return Array.from(text.matchAll(FENCED_TOOL_CALL_PATTERN), (match) => ({
		body: match[1] ?? "",
		start: match.index ?? 0,
		end: (match.index ?? 0) + match[0].length,
	}));
}

function findPrefixedJsonToolCallCandidates(
	text: string,
	prefix: string,
	terminator?: string,
): TextToolCallCandidate[] {
	const candidates: TextToolCallCandidate[] = [];
	let start = text.indexOf(prefix);

	while (start !== -1) {
		let jsonStart = start + prefix.length;
		while (/\s/.test(text[jsonStart] ?? "")) jsonStart++;

		if (text[jsonStart] === "{") {
			const jsonEnd = findJsonObjectEnd(text, jsonStart);
			if (jsonEnd !== null) {
				let end = jsonEnd;
				while (/\s/.test(text[end] ?? "")) end++;
				if (!terminator || text.startsWith(terminator, end)) {
					candidates.push({
						body: text.slice(jsonStart, jsonEnd),
						start,
						end: terminator ? end + terminator.length : jsonEnd,
					});
				}
			}
		}

		start = text.indexOf(prefix, start + prefix.length);
	}

	return candidates;
}

function findAttributeToolCallCandidates(text: string): TextToolCallCandidate[] {
	const candidates: TextToolCallCandidate[] = [];
	let start = text.indexOf(MALFORMED_TOOL_CALL_PREFIX);

	while (start !== -1) {
		let tagStart = start + MALFORMED_TOOL_CALL_PREFIX.length;
		if (text[tagStart] === ">" || text[tagStart] === "{" || text[tagStart] === "<") {
			start = text.indexOf(MALFORMED_TOOL_CALL_PREFIX, start + MALFORMED_TOOL_CALL_PREFIX.length);
			continue;
		}

		while (/\s/.test(text[tagStart] ?? "")) tagStart++;
		const tagEnd = findAttributeTagEnd(text, tagStart);
		if (tagEnd !== null) {
			const attributes = text.slice(tagStart, tagEnd);
			const name = readAttributeString(attributes, "name");
			const argumentJson = readAttributeJson(attributes, "arguments");
			const closingTagStart = text.indexOf("</tool_call>", tagEnd + 1);
			const hasClosingTag = closingTagStart !== -1;
			const body = hasClosingTag ? text.slice(tagEnd + 1, closingTagStart).trim() : "";
			const bodyJson = !argumentJson && body.startsWith("{") ? body : undefined;

			if (name && (argumentJson || bodyJson)) {
				candidates.push({
					body: `{"name":${JSON.stringify(name)},"arguments":${argumentJson ?? bodyJson}}`,
					start,
					end: hasClosingTag ? closingTagStart + "</tool_call>".length : tagEnd + 1,
				});
			}
		}

		start = text.indexOf(MALFORMED_TOOL_CALL_PREFIX, start + MALFORMED_TOOL_CALL_PREFIX.length);
	}

	return candidates;
}

function findAttributeTagEnd(text: string, start: number): number | null {
	let inString: string | undefined;
	let escaped = false;
	let braceDepth = 0;

	for (let index = start; index < text.length; index++) {
		const char = text[index];
		if (inString) {
			if (escaped) {
				escaped = false;
			} else if (char === "\\") {
				escaped = true;
			} else if (char === inString) {
				inString = undefined;
			}
			continue;
		}

		if (char === '"' || char === "'") {
			inString = char;
		} else if (char === "{") {
			braceDepth++;
		} else if (char === "}") {
			braceDepth = Math.max(0, braceDepth - 1);
		} else if (char === ">" && braceDepth === 0) {
			return index;
		}
	}

	return null;
}

function readAttributeString(attributes: string, name: string): string | undefined {
	const match = new RegExp(`\\b${name}\\s*=\\s*(["'])((?:\\\\.|(?!\\1).)*)\\1`).exec(attributes);
	return match?.[2];
}

function readAttributeJson(attributes: string, name: string): string | undefined {
	const match = new RegExp(`\\b${name}\\s*=\\s*`).exec(attributes);
	if (!match || match.index === undefined) return undefined;

	let jsonStart = match.index + match[0].length;
	while (/\s/.test(attributes[jsonStart] ?? "")) jsonStart++;
	if (attributes[jsonStart] !== "{") return undefined;

	const jsonEnd = findJsonObjectEnd(attributes, jsonStart);
	return jsonEnd === null ? undefined : attributes.slice(jsonStart, jsonEnd);
}

function findMalformedToolCallCandidates(text: string): TextToolCallCandidate[] {
	const candidates: TextToolCallCandidate[] = [];
	let start = text.indexOf(MALFORMED_TOOL_CALL_PREFIX);

	while (start !== -1) {
		let jsonStart = start + MALFORMED_TOOL_CALL_PREFIX.length;
		while (/\s/.test(text[jsonStart] ?? "")) jsonStart++;
		if (text[jsonStart] === "<") {
			jsonStart++;
			while (/\s/.test(text[jsonStart] ?? "")) jsonStart++;
		}

		if (text[jsonStart] === "{") {
			const jsonEnd = findJsonObjectEnd(text, jsonStart);
			if (jsonEnd !== null) {
				const end = findMalformedToolCallEnd(text, jsonEnd);
				if (end !== null) {
					candidates.push({ body: text.slice(jsonStart, jsonEnd), start, end });
				}
			}
		}

		start = text.indexOf(MALFORMED_TOOL_CALL_PREFIX, start + MALFORMED_TOOL_CALL_PREFIX.length);
	}

	return candidates;
}

function findMalformedToolCallEnd(text: string, jsonEnd: number): number | null {
	let tagEnd = jsonEnd;
	while (/\s/.test(text[tagEnd] ?? "")) tagEnd++;

	if (text.startsWith("</tool_call>", tagEnd)) {
		return tagEnd + "</tool_call>".length;
	}

	while (text[tagEnd] === "}") tagEnd++;
	while (/\s/.test(text[tagEnd] ?? "")) tagEnd++;

	if (text[tagEnd] === ">") return tagEnd + 1;
	if (text[tagEnd] === "/" && text[tagEnd + 1] === ">") return tagEnd + 2;
	if (text.startsWith("</tool_call>", tagEnd)) return tagEnd + "</tool_call>".length;
	if (tagEnd >= text.length) return tagEnd;
	return null;
}

function parseLooseArguments(text: string): Record<string, unknown> | undefined {
	const args: Record<string, unknown> = {};
	let index = 0;

	while (index < text.length) {
		while (/[\s,]/.test(text[index] ?? "")) index++;
		const keyMatch = /^[A-Za-z_][A-Za-z0-9_-]*/.exec(text.slice(index));
		if (!keyMatch) return undefined;
		const key = keyMatch[0];
		index += key.length;
		while (/\s/.test(text[index] ?? "")) index++;
		if (text[index] !== ":") return undefined;
		index++;
		while (/\s/.test(text[index] ?? "")) index++;

		if (text[index] === '"') {
			const parsed = readLooseString(text, index);
			if (!parsed) return undefined;
			args[key] = parsed.value;
			index = parsed.end;
		} else {
			const valueMatch = /^[^,\s]+/.exec(text.slice(index));
			if (!valueMatch) return undefined;
			args[key] = parseLooseScalar(valueMatch[0]);
			index += valueMatch[0].length;
		}
	}

	return args;
}

function readLooseString(text: string, start: number): { value: string; end: number } | undefined {
	let value = "";
	let escaped = false;

	for (let index = start + 1; index < text.length; index++) {
		const char = text[index];
		if (escaped) {
			value += char;
			escaped = false;
		} else if (char === "\\") {
			escaped = true;
		} else if (char === '"') {
			return { value, end: index + 1 };
		} else {
			value += char;
		}
	}

	return undefined;
}

function parseLooseScalar(value: string): unknown {
	if (value === "true") return true;
	if (value === "false") return false;
	const numberValue = Number(value);
	return Number.isFinite(numberValue) ? numberValue : value;
}

function findJsonObjectEnd(text: string, start: number): number | null {
	let depth = 0;
	let inString = false;
	let escaped = false;

	for (let index = start; index < text.length; index++) {
		const char = text[index];

		if (inString) {
			if (escaped) {
				escaped = false;
			} else if (char === "\\") {
				escaped = true;
			} else if (char === '"') {
				inString = false;
			}
			continue;
		}

		if (char === '"') {
			inString = true;
		} else if (char === "{") {
			depth++;
		} else if (char === "}") {
			depth--;
			if (depth === 0) return index + 1;
		}
	}

	return null;
}
