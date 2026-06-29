export const meta = {
	name: "version-check",
	critical: true,
	description: "pi --version exits 0 with semver output",
};

export async function run({ exec }) {
	const { exitCode, stdout } = await exec(["--version"]);
	const version = stdout.trim();
	if (exitCode !== 0) throw new Error(`Exit code ${exitCode}`);
	if (!/^\d+\.\d+\.\d+/.test(version)) throw new Error(`Not semver: ${version}`);
}
