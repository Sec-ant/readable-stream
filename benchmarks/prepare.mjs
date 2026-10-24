import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

// Load the reference implementation for benchmark comparisons.
const revision = "eabebdb048ce6dd01c75d645516719eb4ec2bdee";
const directory = ".vitest/performance/baseline";
await mkdir(directory, { recursive: true });
for (const name of [
  "asyncIterator.ts",
  "asyncIterablePrototype.ts",
  "fromAnyIterable.ts",
]) {
  let source;
  try {
    source = execFileSync("git", ["show", `${revision}:src/core/${name}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    const response = await fetch(
      `https://raw.githubusercontent.com/Sec-ant/readable-stream/${revision}/src/core/${name}`,
      { signal: AbortSignal.timeout(60000) },
    );
    if (!response.ok)
      throw new Error(
        `Benchmark baseline download failed: ${name}: HTTP ${response.status}`,
      );
    source = await response.text();
  }
  await writeFile(`${directory}/${name}`, source);
}
