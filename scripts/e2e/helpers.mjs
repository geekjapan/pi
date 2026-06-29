const stackTracePatterns = [/^\s*at\s+\S+\s+\(/, /^\s*at\s+async\s+/];

export function assertNoStackTrace(stdout, stderr) {
	for (const line of `${stdout}${stderr}`.split("\n")) {
		if (stackTracePatterns.some((pattern) => pattern.test(line))) {
			throw new Error(`Stack trace detected: ${line.trim()}`);
		}
	}
}
