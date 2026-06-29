import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const defaultBinary = join(repoRoot, "pi-test.sh");
const scenariosDir = join(repoRoot, "scripts/e2e/scenarios");
const defaultTimeout = 30_000;

function parseArgs(args) {
	const options = { binary: defaultBinary, critical: false, scenario: undefined, timeout: defaultTimeout };

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "--binary" && i + 1 < args.length) {
			options.binary = resolve(args[++i]);
		} else if (arg === "--critical") {
			options.critical = true;
		} else if (arg === "--scenario" && i + 1 < args.length) {
			options.scenario = args[++i];
		} else if (arg === "--timeout" && i + 1 < args.length) {
			const timeout = Number(args[++i]);
			if (!Number.isInteger(timeout) || timeout <= 0) throw new Error("--timeout must be a positive integer");
			options.timeout = timeout;
		} else {
			throw new Error(`Unknown argument: ${arg}`);
		}
	}

	return options;
}

async function discoverScenarios() {
	const entries = await readdir(scenariosDir, { withFileTypes: true });
	const scenarioFiles = entries
		.filter((entry) => entry.isFile() && entry.name.endsWith(".mjs"))
		.map((entry) => join(scenariosDir, entry.name))
		.sort();
	const scenarios = [];

	for (const filePath of scenarioFiles) {
		const scenarioModule = await import(pathToFileURL(filePath).href);
		if (!scenarioModule.meta?.name || typeof scenarioModule.run !== "function") {
			throw new Error(`Invalid scenario module: ${filePath}`);
		}
		scenarios.push({ filePath, meta: scenarioModule.meta, run: scenarioModule.run });
	}

	return scenarios;
}

function filterScenarios(scenarios, options) {
	return scenarios.filter((scenario) => {
		if (options.critical && scenario.meta.critical !== true) return false;
		if (options.scenario && scenario.meta.name !== options.scenario) return false;
		return true;
	});
}

function createExecHelper(binary, defaultExecTimeout) {
	return (args, opts = {}) =>
		new Promise((resolveExec) => {
			const timeout = opts.timeout ?? defaultExecTimeout;
			const env = {
				...process.env,
				PI_TELEMETRY: "0",
				PI_SKIP_VERSION_CHECK: "1",
				...opts.env,
			};
			const child = spawn(binary, args, { env, stdio: ["ignore", "pipe", "pipe"] });
			let stdout = "";
			let stderr = "";
			let timedOut = false;
			const timer = setTimeout(() => {
				timedOut = true;
				child.kill("SIGTERM");
			}, timeout);

			child.stdout.on("data", (data) => {
				stdout += data;
			});
			child.stderr.on("data", (data) => {
				stderr += data;
			});
			child.on("error", (error) => {
				clearTimeout(timer);
				resolveExec({ exitCode: null, stdout, stderr: `${stderr}${error.message}`, timedOut: false });
			});
			child.on("close", (code) => {
				clearTimeout(timer);
				resolveExec({ exitCode: timedOut ? null : code, stdout, stderr, timedOut });
			});
		});
}

async function runScenarios(scenarios, context) {
	const results = [];
	for (const scenario of scenarios) {
		const startedAt = Date.now();
		try {
			await scenario.run(context);
			results.push({ name: scenario.meta.name, status: "PASS", duration: Date.now() - startedAt });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const status = message.toLowerCase().includes("timed out") ? "TIMEOUT" : "FAIL";
			results.push({ name: scenario.meta.name, status, duration: Date.now() - startedAt, error: message });
		}
	}
	return results;
}

function printResults(results) {
	console.log("E2E Results");
	console.log("----------------------------------------");
	for (const result of results) {
		console.log(`  ${result.status.padEnd(7)} ${result.name.padEnd(28)} (${result.duration}ms)`);
		if (result.error) console.log(`          Error: ${result.error}`);
	}
	console.log("----------------------------------------");
	const passed = results.filter((result) => result.status === "PASS").length;
	const failed = results.filter((result) => result.status === "FAIL").length;
	const timedOut = results.filter((result) => result.status === "TIMEOUT").length;
	console.log(`${passed}/${results.length} passed, ${failed} failed, ${timedOut} timeout`);
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	if (!existsSync(options.binary)) throw new Error(`Binary not found: ${options.binary}`);

	const scenarios = filterScenarios(await discoverScenarios(), options);
	if (scenarios.length === 0) throw new Error("No scenarios matched");

	const results = await runScenarios(scenarios, {
		binary: options.binary,
		exec: createExecHelper(options.binary, options.timeout),
		timeout: options.timeout,
	});
	printResults(results);
	if (results.some((result) => result.status !== "PASS")) process.exit(1);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
