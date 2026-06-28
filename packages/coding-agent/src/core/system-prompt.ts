/**
 * System prompt construction and project context loading
 */

import type { ToolCallProtocol } from "@earendil-works/pi-agent-core";
import { getDocsPath, getExamplesPath, getReadmePath } from "../config.ts";
import { formatSkillsForPrompt, type Skill } from "./skills.ts";

export interface BuildSystemPromptOptions {
	/** Custom system prompt (replaces default). */
	customPrompt?: string;
	/** Tools to include in prompt. Default: [read, bash, edit, write] */
	selectedTools?: string[];
	/** Optional one-line tool snippets keyed by tool name. */
	toolSnippets?: Record<string, string>;
	/** Optional parameter schemas keyed by tool name. */
	toolSchemas?: Record<string, unknown>;
	/** Tool call protocol used for provider requests. Default: "native". */
	toolCallProtocol?: ToolCallProtocol;
	/** Additional guideline bullets appended to the default system prompt guidelines. */
	promptGuidelines?: string[];
	/** Text to append to system prompt. */
	appendSystemPrompt?: string;
	/** Working directory. */
	cwd: string;
	/** Pre-loaded context files. */
	contextFiles?: Array<{ path: string; content: string }>;
	/** Pre-loaded skills. */
	skills?: Skill[];
}

/** Build the system prompt with tools, guidelines, and context */
export function buildSystemPrompt(options: BuildSystemPromptOptions): string {
	const {
		customPrompt,
		selectedTools,
		toolSnippets,
		promptGuidelines,
		appendSystemPrompt,
		cwd,
		contextFiles: providedContextFiles,
		skills: providedSkills,
		toolSchemas,
		toolCallProtocol = "native",
	} = options;
	const resolvedCwd = cwd;
	const promptCwd = resolvedCwd.replace(/\\/g, "/");

	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	const date = `${year}-${month}-${day}`;

	const appendSection = appendSystemPrompt ? `\n\n${appendSystemPrompt}` : "";

	const contextFiles = providedContextFiles ?? [];
	const skills = providedSkills ?? [];
	const tools = selectedTools || ["read", "bash", "edit", "write"];
	const visibleTools = tools.filter((name) => !!toolSnippets?.[name]);
	const nativeToolsList =
		visibleTools.length > 0 ? visibleTools.map((name) => `- ${name}: ${toolSnippets![name]}`).join("\n") : "(none)";
	const compactToolsList = compactToolList(tools, toolSchemas);
	const toolsList = toolCallProtocol === "text" ? compactToolsList : nativeToolsList;
	const toolProtocolSection = buildToolProtocolSection(toolCallProtocol, compactToolsList, tools.length > 0);

	if (customPrompt) {
		let prompt = customPrompt;

		if (appendSection) {
			prompt += appendSection;
		}
		if (toolCallProtocol === "text" && tools.length > 0) {
			prompt += `\n\nAvailable tools (use <tool_call> format):\n${compactToolsList}`;
		}
		if (toolProtocolSection) {
			prompt += toolProtocolSection;
		}

		// Append project context files
		if (contextFiles.length > 0) {
			prompt += "\n\n<project_context>\n\n";
			prompt += "Project-specific instructions and guidelines:\n\n";
			for (const { path: filePath, content } of contextFiles) {
				prompt += `<project_instructions path="${filePath}">\n${content}\n</project_instructions>\n\n`;
			}
			prompt += "</project_context>\n";
		}

		// Append skills section (only if read tool is available)
		const customPromptHasRead = !selectedTools || selectedTools.includes("read");
		if (customPromptHasRead && skills.length > 0) {
			prompt += formatSkillsForPrompt(skills);
		}

		// Add date and working directory last
		prompt += `\nCurrent date: ${date}`;
		prompt += `\nCurrent working directory: ${promptCwd}`;

		return prompt;
	}

	// Get absolute paths to documentation and examples
	const readmePath = getReadmePath();
	const docsPath = getDocsPath();
	const examplesPath = getExamplesPath();

	// Build guidelines based on which tools are actually available
	const guidelinesList: string[] = [];
	const guidelinesSet = new Set<string>();
	const addGuideline = (guideline: string): void => {
		if (guidelinesSet.has(guideline)) {
			return;
		}
		guidelinesSet.add(guideline);
		guidelinesList.push(guideline);
	};

	const hasBash = tools.includes("bash");
	const hasGrep = tools.includes("grep");
	const hasFind = tools.includes("find");
	const hasLs = tools.includes("ls");
	const hasRead = tools.includes("read");

	// File exploration guidelines
	if (hasBash && !hasGrep && !hasFind && !hasLs) {
		addGuideline("Use bash for file operations like ls, rg, find");
	}

	for (const guideline of promptGuidelines ?? []) {
		const normalized = guideline.trim();
		if (normalized.length > 0) {
			addGuideline(normalized);
		}
	}

	// Always include these
	addGuideline("Be concise in your responses");
	addGuideline("Show file paths clearly when working with files");

	const guidelines = guidelinesList.map((g) => `- ${g}`).join("\n");

	let prompt = `You are an expert coding assistant operating inside pi, a coding agent harness. You help users by reading files, executing commands, editing code, and writing new files.

Available tools${toolCallProtocol === "text" ? " (use <tool_call> format)" : ""}:
${toolsList}
${toolProtocolSection}

In addition to the tools above, you may have access to other custom tools depending on the project.

Guidelines:
${guidelines}

Pi documentation (read only when the user asks about pi itself, its SDK, extensions, themes, skills, or TUI):
- Main documentation: ${readmePath}
- Additional docs: ${docsPath}
- Examples: ${examplesPath} (extensions, custom tools, SDK)
- When reading pi docs or examples, resolve docs/... under Additional docs and examples/... under Examples, not the current working directory
- When asked about: extensions (docs/extensions.md, examples/extensions/), themes (docs/themes.md), skills (docs/skills.md), prompt templates (docs/prompt-templates.md), TUI components (docs/tui.md), keybindings (docs/keybindings.md), SDK integrations (docs/sdk.md), custom providers (docs/custom-provider.md), adding models (docs/models.md), pi packages (docs/packages.md)
- When working on pi topics, read the docs and examples, and follow .md cross-references before implementing
- Always read pi .md files completely and follow links to related docs (e.g., tui.md for TUI API details)`;

	if (appendSection) {
		prompt += appendSection;
	}

	// Append project context files
	if (contextFiles.length > 0) {
		prompt += "\n\n<project_context>\n\n";
		prompt += "Project-specific instructions and guidelines:\n\n";
		for (const { path: filePath, content } of contextFiles) {
			prompt += `<project_instructions path="${filePath}">\n${content}\n</project_instructions>\n\n`;
		}
		prompt += "</project_context>\n";
	}

	// Append skills section (only if read tool is available)
	if (hasRead && skills.length > 0) {
		prompt += formatSkillsForPrompt(skills);
	}

	// Add date and working directory last
	prompt += `\nCurrent date: ${date}`;
	prompt += `\nCurrent working directory: ${promptCwd}`;

	return prompt;
}

function buildToolProtocolSection(protocol: ToolCallProtocol, toolsList: string, hasTools: boolean): string {
	if (!hasTools || protocol === "native") {
		return "";
	}
	if (protocol === "text") {
		return `\n\nTool call protocol:
- To use a tool, output exactly one <tool_call>{"name":"...","arguments":{...}}</tool_call> block in the response.
- JSON must be valid; name must be a string and arguments must be an object.
- Do not output <tool_result>; tool results are provided by the system.`;
	}
	return `\n\nTool call fallback:
- Prefer native tool calls when available.
- If native tool calls are unavailable, output exactly one <tool_call>{"name":"...","arguments":{...}}</tool_call> block.
- Do not output <tool_result>; tool results are provided by the system.

Available tools for text fallback:
${toolsList}`;
}

function compactToolList(toolNames: string[], toolSchemas: Record<string, unknown> | undefined): string {
	if (toolNames.length === 0) {
		return "(none)";
	}
	return toolNames.map((name) => `- ${name}: ${compactSchema(toolSchemas?.[name])}`).join("\n");
}

function compactSchema(schema: unknown): string {
	const schemaObject = asSchemaObject(schema);
	if (schemaObject?.type !== "object" || !schemaObject.properties) {
		return "{}";
	}

	const required = new Set(readStringArray(schemaObject.required));
	const summary = Object.fromEntries(
		Object.entries(schemaObject.properties).map(([name, property]) => [
			required.has(name) ? name : `${name}?`,
			compactSchemaType(property),
		]),
	);
	return JSON.stringify(summary);
}

function compactSchemaType(schema: unknown): string {
	const schemaObject = asSchemaObject(schema);
	if (!schemaObject) {
		return "unknown";
	}
	if (schemaObject.const !== undefined) {
		return String(schemaObject.const);
	}
	if (Array.isArray(schemaObject.enum)) {
		return schemaObject.enum.map((value) => String(value)).join("|") || "unknown";
	}
	if (Array.isArray(schemaObject.anyOf)) {
		return schemaObject.anyOf.map((entry) => compactSchemaType(entry)).join("|");
	}
	if (Array.isArray(schemaObject.oneOf)) {
		return schemaObject.oneOf.map((entry) => compactSchemaType(entry)).join("|");
	}
	if (schemaObject.type === "array") {
		return `${compactSchemaType(schemaObject.items)}[]`;
	}
	if (schemaObject.type === "object") {
		return compactSchema(schema);
	}
	return schemaObject.type ?? "unknown";
}

interface SchemaObject {
	type?: string;
	properties?: Record<string, unknown>;
	required?: unknown;
	items?: unknown;
	anyOf?: unknown;
	oneOf?: unknown;
	enum?: unknown;
	const?: unknown;
}

function asSchemaObject(schema: unknown): SchemaObject | undefined {
	return typeof schema === "object" && schema !== null ? (schema as SchemaObject) : undefined;
}

function readStringArray(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}
