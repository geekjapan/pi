import { assertNoStackTrace } from "../helpers.mjs";

export const meta = {
	name: "startup-text-protocol",
	critical: true,
	description: "pi --tool-protocol text -p startup path completes without crash",
};

export async function run({ exec }) {
	const { exitCode, stdout, stderr } = await exec([
		"--tool-protocol",
		"text",
		"-p",
		"hello",
		"--no-session",
		"--offline",
	]);
	if (exitCode !== 0 && exitCode !== 1) throw new Error(`Exit code ${exitCode}`);
	assertNoStackTrace(stdout, stderr);
}
