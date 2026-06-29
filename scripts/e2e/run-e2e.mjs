#!/usr/bin/env node

import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, readdir } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(__filename), "../..");
const DEFAULT_TIMEOUT = 30000;

class TimeoutError extends Error {
	constructor(message) {
		super(message);
		this.name = "TimeoutError";
	}
}

function parseArgs(argv = process.argv.slice(2)) {
	const options = {
		binary: join(REPO_ROOT, "pi-test.sh"),
		critical: false,
		scenario: undefined,
		timeout: DEFAULT_TIMEOUT,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (arg === "--critical") {
			options.critical = true;
			continue;
		}

		if (arg === "--binary" || arg === "--scenario" || arg === "--timeout") {
			const value = argv[index + 1];
			if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
			index += 1;

			if (arg === "--binary") options.binary = resolve(value);
			if (arg === "--scenario") options.scenario = value;
			if (arg === "--timeout") options.timeout = Number(value);
			continue;
		}

		throw new Error(`Unknown argument: ${arg}`);
	}

	if (!Number.isInteger(options.timeout) || options.timeout <= 0) {
		throw new Error("--timeout must be a positive integer");
	}

	return options;
}

async function discoverScenarios(scenariosDir) {
	const entries = await readdir(scenariosDir, { withFileTypes: true });
	const files = entries
		.filter((entry) => entry.isFile() && entry.name.endsWith(".mjs"))
		.map((entry) => join(scenariosDir, entry.name))
		.sort();
	const scenarios = [];

	for (const filePath of files) {
		const scenarioModule = await import(pathToFileURL(filePath).href);
		const { meta, run } = scenarioModule;
		if (!meta || typeof meta.name !== "string" || typeof run !== "function") {
			throw new Error(`${filePath} must export meta.name and run(ctx)`);
		}

		scenarios.push({ filePath, meta, run });
	}

	return scenarios;
}

function filterScenarios(scenarios, filters) {
	return scenarios.filter((scenario) => {
		const fileName = basename(scenario.filePath, extname(scenario.filePath));
		if (filters.critical && scenario.meta.critical !== true) return false;
		if (filters.scenario && scenario.meta.name !== filters.scenario && fileName !== filters.scenario) return false;
		return true;
	});
}

function createExecHelper(binary, defaultTimeout) {
	return (args, opts = {}) =>
		new Promise((resolveResult, rejectResult) => {
			const timeout = opts.timeout ?? defaultTimeout;
			if (!Number.isInteger(timeout) || timeout <= 0) {
				rejectResult(new Error("exec timeout must be a positive integer"));
				return;
			}

			const env = {
				...process.env,
				PI_TELEMETRY: "0",
				PI_SKIP_VERSION_CHECK: "1",
				...opts.env,
			};
			const proc = spawn(binary, args, {
				env,
				stdio: ["ignore", "pipe", "pipe"],
				timeout,
			});

			let stdout = "";
			let stderr = "";
			let settled = false;
			let timedOut = false;
			const timeoutId = setTimeout(() => {
				timedOut = true;
			}, timeout);

			function settle(callback) {
				if (settled) return;
				settled = true;
				clearTimeout(timeoutId);
				callback();
			}

			proc.stdout.setEncoding("utf8");
			proc.stderr.setEncoding("utf8");
			proc.stdout.on("data", (chunk) => {
				stdout += chunk;
			});
			proc.stderr.on("data", (chunk) => {
				stderr += chunk;
			});
			proc.on("error", (error) => {
				settle(() => rejectResult(error));
			});
			proc.on("close", (exitCode, signal) => {
				settle(() => {
					if (timedOut || (exitCode === null && signal === "SIGTERM")) {
						rejectResult(new TimeoutError(`Timed out after ${timeout}ms`));
						return;
					}

					resolveResult({ exitCode, stdout, stderr });
				});
			});
		});
}

function formatError(error) {
	if (error instanceof Error) return `${error.name}: ${error.message}`;
	return String(error);
}

function printResults(results) {
	const nameWidth = Math.max("name".length, ...results.map((result) => result.name.length));
	const separator = "-".repeat(nameWidth + 24);

	console.log("E2E Results");
	console.log(separator);
	for (const result of results) {
		console.log(`  ${result.status.padEnd(7)} ${result.name.padEnd(nameWidth)} (${result.duration}ms)`);
		if (result.error) console.log(`          ${formatError(result.error)}`);
	}
	console.log(separator);

	const passed = results.filter((result) => result.status === "PASS").length;
	const failed = results.filter((result) => result.status === "FAIL").length;
	const timedOut = results.filter((result) => result.status === "TIMEOUT").length;
	console.log(`${passed}/${results.length} passed, ${failed} failed, ${timedOut} timeout`);
}

async function runWithTimeout(runPromise, timeout, name) {
	let timeoutId;
	try {
		await Promise.race([
			runPromise,
			new Promise((_, reject) => {
				timeoutId = setTimeout(() => reject(new TimeoutError(`${name} timed out after ${timeout}ms`)), timeout);
			}),
		]);
	} finally {
		clearTimeout(timeoutId);
	}
}

async function runScenarios(scenarios, ctx) {
	const results = [];

	for (const scenario of scenarios) {
		const start = performance.now();
		try {
			await runWithTimeout(scenario.run(ctx), ctx.timeout, scenario.meta.name);
			results.push({ duration: Math.round(performance.now() - start), name: scenario.meta.name, status: "PASS" });
		} catch (error) {
			results.push({
				duration: Math.round(performance.now() - start),
				error,
				name: scenario.meta.name,
				status: error instanceof TimeoutError ? "TIMEOUT" : "FAIL",
			});
		}
	}

	return results;
}

async function main() {
	try {
		const options = parseArgs();
		await access(options.binary, constants.F_OK);

		const scenariosDir = join(dirname(__filename), "scenarios");
		const scenarios = await discoverScenarios(scenariosDir);
		const filteredScenarios = filterScenarios(scenarios, options);
		if (filteredScenarios.length === 0) throw new Error("No scenarios matched the selected filters");

		const ctx = {
			binary: options.binary,
			exec: createExecHelper(options.binary, options.timeout),
			timeout: options.timeout,
		};
		const results = await runScenarios(filteredScenarios, ctx);
		printResults(results);
		process.exitCode = results.every((result) => result.status === "PASS") ? 0 : 1;
	} catch (error) {
		console.error(formatError(error));
		process.exitCode = 1;
	}
}

await main();
