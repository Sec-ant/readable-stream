import { execFileSync } from "node:child_process";
import "./prepare.mjs";

const available = ["node", "chromium", "firefox"];
const requested = process.argv.slice(2);
for (const project of requested.length ? requested : available) {
  if (!available.includes(project)) {
    throw new Error(`Unknown benchmark runtime: ${project}`);
  }
  // Sequential engine runs keep throughput measurements independent.
  execFileSync(
    "pnpm",
    [
      "exec",
      "vitest",
      "run",
      "--config",
      "vitest.tools.config.mjs",
      "--project",
      `benchmark-${project}`,
    ],
    { stdio: "inherit" },
  );
}
