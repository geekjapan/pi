import { assertNoStackTrace } from "../helpers.mjs";

export const meta = {
	name: "startup-native",
	critical: true,
	description: "pi -p startup path completes without crash",
};

export async function run({ exec }) {
	const { exitCode, stdout, stderr } = await exec(["-p", "hello", "--no-session", "--offline"]);
	if (exitCode !== 0 && exitCode !== 1) throw new Error(`Exit code ${exitCode}`);
	assertNoStackTrace(stdout, stderr);
}
