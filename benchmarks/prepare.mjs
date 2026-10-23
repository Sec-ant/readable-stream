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
  const source = execFileSync("git", ["show", `${revision}:src/core/${name}`], {
    encoding: "utf8",
  });
  await writeFile(`${directory}/${name}`, source);
}
