import type { Context, Message, Model, Usage } from "@earendil-works/pi-ai";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { describe, expect, it } from "vitest";
import { Agent } from "../src/agent.ts";
import type { AgentMessage, AgentTool, StreamFn } from "../src/types.ts";

function createUsage(): Usage {
	return {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 0,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
	};
}

function createModel(): Model<"openai-responses"> {
	return {
		id: "mock",
		name: "mock",
		api: "openai-responses",
		provider: "openai",
		baseUrl: "https://example.invalid",
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 8192,
		maxTokens: 2048,
	};
}

function isLlmMessage(message: AgentMessage): message is Message {
	return message.role === "user" || message.role === "assistant" || message.role === "toolResult";
}

function convertToLlm(messages: AgentMessage[]): Message[] {
	return messages.filter(isLlmMessage);
}

describe("text tool protocol provider context", () => {
	it("omits native tools from provider requests while keeping execution tools active", async () => {
		const toolSchema = Type.Object({ value: Type.String() });
		const executed: string[] = [];
		const tool: AgentTool<typeof toolSchema, { value: string }> = {
			name: "echo",
			label: "Echo",
			description: "Echo tool",
			parameters: toolSchema,
			async execute(_toolCallId, params) {
				executed.push(params.value);
				return {
					content: [{ type: "text", text: `echoed ${params.value}` }],
					details: { value: params.value },
				};
			},
		};
		const requestTools: Array<Context["tools"]> = [];
		let callIndex = 0;
		const streamFn: StreamFn = (model, context) => {
			requestTools.push(context.tools);
			const stream = createAssistantMessageEventStream();
			queueMicrotask(() => {
				if (callIndex === 0) {
					stream.push({
						type: "done",
						reason: "stop",
						message: {
							role: "assistant",
							content: [
								{
									type: "text",
									text: '<tool_call>{"name":"echo","arguments":{"value":"hello"}}</tool_call>',
								},
							],
							api: model.api,
							provider: model.provider,
							model: model.id,
							usage: createUsage(),
							stopReason: "stop",
							timestamp: Date.now(),
						},
					});
				} else {
					stream.push({
						type: "done",
						reason: "stop",
						message: {
							role: "assistant",
							content: [{ type: "text", text: "done" }],
							api: model.api,
							provider: model.provider,
							model: model.id,
							usage: createUsage(),
							stopReason: "stop",
							timestamp: Date.now(),
						},
					});
				}
				callIndex++;
			});
			return stream;
		};
		const agent = new Agent({
			initialState: {
				model: createModel(),
				systemPrompt: "test",
				tools: [tool],
			},
			convertToLlm,
			toolCallProtocol: "text",
			streamFn,
		});

		await agent.prompt("echo hello");

		expect(requestTools).toEqual([undefined, undefined]);
		expect(executed).toEqual(["hello"]);
		expect(agent.state.tools).toEqual([tool]);
		expect(agent.state.messages.some((message) => message.role === "toolResult")).toBe(true);
	});
});
