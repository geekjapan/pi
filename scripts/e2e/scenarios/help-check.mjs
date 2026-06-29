export const meta = {
	name: "help-check",
	critical: true,
	description: "pi --help exits 0 with Usage text",
};

export async function run({ exec }) {
	const { exitCode, stdout } = await exec(["--help"]);
	if (exitCode !== 0) throw new Error(`Exit code ${exitCode}`);
	if (!stdout.includes("Usage:")) throw new Error("stdout missing 'Usage:'");
	if (!stdout.includes("--tool-protocol")) throw new Error("stdout missing '--tool-protocol'");
}
