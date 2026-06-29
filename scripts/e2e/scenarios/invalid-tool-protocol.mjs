import { assertNoStackTrace } from "../helpers.mjs";

export const meta = {
	name: "invalid-tool-protocol",
	critical: true,
	description: "pi --tool-protocol bogus does not crash",
};

export async function run({ exec }) {
	const { exitCode, stdout, stderr } = await exec([
		"--tool-protocol",
		"bogus",
		"-p",
		"hi",
		"--no-session",
		"--offline",
	]);
	if (exitCode !== 0 && exitCode !== 1) throw new Error(`Exit code ${exitCode}`);
	assertNoStackTrace(stdout, stderr);
	if (!stderr.includes("Warning:")) throw new Error("Expected warning diagnostic in stderr");
}
