/**
 * Custom message types and transformers for the coding agent.
 *
 * Extends the base AgentMessage type with coding-agent specific message types,
 * and provides a transformer to convert them to LLM-compatible messages.
 */

import type { AgentMessage, ToolCallProtocol } from "@earendil-works/pi-agent-core";
import type { ImageContent, Message, TextContent } from "@earendil-works/pi-ai";

type UserMessage = Extract<Message, { role: "user" }>;
type AssistantMessage = Extract<Message, { role: "assistant" }>;
type ToolResultMessage = Extract<Message, { role: "toolResult" }>;
type ToolCallContent = Extract<AssistantMessage["content"][number], { type: "toolCall" }>;

export const COMPACTION_SUMMARY_PREFIX = `The conversation history before this point was compacted into the following summary:

<summary>
`;

export const COMPACTION_SUMMARY_SUFFIX = `
</summary>`;

export const BRANCH_SUMMARY_PREFIX = `The following is a summary of a branch that this conversation came back from:

<summary>
`;

export const BRANCH_SUMMARY_SUFFIX = `</summary>`;

/**
 * Message type for bash executions via the ! command.
 */
export interface BashExecutionMessage {
	role: "bashExecution";
	command: string;
	output: string;
	exitCode: number | undefined;
	cancelled: boolean;
	truncated: boolean;
	fullOutputPath?: string;
	timestamp: number;
	/** If true, this message is excluded from LLM context (!! prefix) */
	excludeFromContext?: boolean;
}

/**
 * Message type for extension-injected messages via sendMessage().
 * These are custom messages that extensions can inject into the conversation.
 */
export interface CustomMessage<T = unknown> {
	role: "custom";
	customType: string;
	content: string | (TextContent | ImageContent)[];
	display: boolean;
	details?: T;
	timestamp: number;
}

export interface BranchSummaryMessage {
	role: "branchSummary";
	summary: string;
	fromId: string;
	timestamp: number;
}

export interface CompactionSummaryMessage {
	role: "compactionSummary";
	summary: string;
	tokensBefore: number;
	timestamp: number;
}

// Extend CustomAgentMessages via declaration merging
declare module "@earendil-works/pi-agent-core" {
	interface CustomAgentMessages {
		bashExecution: BashExecutionMessage;
		custom: CustomMessage;
		branchSummary: BranchSummaryMessage;
		compactionSummary: CompactionSummaryMessage;
	}
}

/**
 * Convert a BashExecutionMessage to user message text for LLM context.
 */
export function bashExecutionToText(msg: BashExecutionMessage): string {
	let text = `Ran \`${msg.command}\`\n`;
	if (msg.output) {
		text += `\`\`\`\n${msg.output}\n\`\`\``;
	} else {
		text += "(no output)";
	}
	if (msg.cancelled) {
		text += "\n\n(command cancelled)";
	} else if (msg.exitCode !== null && msg.exitCode !== undefined && msg.exitCode !== 0) {
		text += `\n\nCommand exited with code ${msg.exitCode}`;
	}
	if (msg.truncated && msg.fullOutputPath) {
		text += `\n\n[Output truncated. Full output: ${msg.fullOutputPath}]`;
	}
	return text;
}

export function createBranchSummaryMessage(summary: string, fromId: string, timestamp: string): BranchSummaryMessage {
	return {
		role: "branchSummary",
		summary,
		fromId,
		timestamp: new Date(timestamp).getTime(),
	};
}

export function createCompactionSummaryMessage(
	summary: string,
	tokensBefore: number,
	timestamp: string,
): CompactionSummaryMessage {
	return {
		role: "compactionSummary",
		summary: summary,
		tokensBefore,
		timestamp: new Date(timestamp).getTime(),
	};
}

/** Convert CustomMessageEntry to AgentMessage format */
export function createCustomMessage(
	customType: string,
	content: string | (TextContent | ImageContent)[],
	display: boolean,
	details: unknown | undefined,
	timestamp: string,
): CustomMessage {
	return {
		role: "custom",
		customType,
		content,
		display,
		details,
		timestamp: new Date(timestamp).getTime(),
	};
}

/**
 * Transform AgentMessages (including custom types) to LLM-compatible Messages.
 *
 * This is used by:
 * - Agent's transormToLlm option (for prompt calls and queued messages)
 * - Compaction's generateSummary (for summarization)
 * - Custom extensions and tools
 */
export function convertToLlm(messages: AgentMessage[]): Message[] {
	return messages
		.map((m): Message | undefined => {
			switch (m.role) {
				case "bashExecution":
					// Skip messages excluded from context (!! prefix)
					if (m.excludeFromContext) {
						return undefined;
					}
					return {
						role: "user",
						content: [{ type: "text", text: bashExecutionToText(m) }],
						timestamp: m.timestamp,
					};
				case "custom": {
					const content = typeof m.content === "string" ? [{ type: "text" as const, text: m.content }] : m.content;
					return {
						role: "user",
						content,
						timestamp: m.timestamp,
					};
				}
				case "branchSummary":
					return {
						role: "user",
						content: [{ type: "text" as const, text: BRANCH_SUMMARY_PREFIX + m.summary + BRANCH_SUMMARY_SUFFIX }],
						timestamp: m.timestamp,
					};
				case "compactionSummary":
					return {
						role: "user",
						content: [
							{ type: "text" as const, text: COMPACTION_SUMMARY_PREFIX + m.summary + COMPACTION_SUMMARY_SUFFIX },
						],
						timestamp: m.timestamp,
					};
				case "user":
				case "assistant":
				case "toolResult":
					return m;
				default:
					// biome-ignore lint/correctness/noSwitchDeclarations: fine
					const _exhaustiveCheck: never = m;
					return undefined;
			}
		})
		.filter((m) => m !== undefined);
}

export function convertToLlmForProtocol(messages: AgentMessage[], protocol: ToolCallProtocol): Message[] {
	const converted = convertToLlm(messages);
	if (protocol !== "text") {
		return converted;
	}
	return converted.map((message) => convertMessageToTextProtocol(message));
}

function convertMessageToTextProtocol(message: Message): Message {
	switch (message.role) {
		case "user":
			return {
				...message,
				content: convertUserContentToTextProtocol(message.content),
			};
		case "assistant":
			return {
				...message,
				content: message.content.map((block) => {
					if (block.type === "toolCall") {
						return toolCallToTextBlock(block);
					}
					if (block.type === "text") {
						return { ...block, text: escapeToolProtocolTags(block.text) };
					}
					return { ...block };
				}),
			};
		case "toolResult":
			return toolResultToUserMessage(message);
		default:
			// biome-ignore lint/correctness/noSwitchDeclarations: fine
			const _exhaustiveCheck: never = message;
			return _exhaustiveCheck;
	}
}

function convertUserContentToTextProtocol(content: UserMessage["content"]): UserMessage["content"] {
	if (typeof content === "string") {
		return escapeToolProtocolTags(content);
	}
	return content.map((block) =>
		block.type === "text" ? { ...block, text: escapeToolProtocolTags(block.text) } : { ...block },
	);
}

function toolCallToTextBlock(block: ToolCallContent): TextContent {
	return {
		type: "text",
		text: `<tool_call>${JSON.stringify({ name: block.name, arguments: block.arguments })}</tool_call>`,
	};
}

function toolResultToUserMessage(message: ToolResultMessage): UserMessage {
	return {
		role: "user",
		content: [
			{
				type: "text",
				text: `<tool_result tool_call_id="${escapeAttribute(message.toolCallId)}" tool_name="${escapeAttribute(message.toolName)}" is_error="${message.isError ? "true" : "false"}">${toolResultContentToText(message.content)}</tool_result>`,
			},
		],
		timestamp: message.timestamp,
	};
}

function toolResultContentToText(content: ToolResultMessage["content"]): string {
	return content
		.map((block) => {
			if (block.type === "image") {
				return `[Image: ${block.mimeType}]`;
			}
			return escapeToolProtocolTags(block.text);
		})
		.join("\n");
}

function escapeToolProtocolTags(text: string): string {
	return text.replace(/<\/?tool_call>|<\/?tool_result>/g, (tag) => tag.replace(/</g, "&lt;").replace(/>/g, "&gt;"));
}

function escapeAttribute(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
