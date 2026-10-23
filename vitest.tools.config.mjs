import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const common = {
  fileParallelism: false,
  maxWorkers: 1,
  testTimeout: 120000,
  hookTimeout: 120000,
};
const benchmark = { ...common, include: ["benchmarks/iteration.spec.mjs"] };

export default defineConfig({
  server: { host: "127.0.0.1" },
  test: {
    projects: [
      {
        test: {
          ...common,
          name: "wpt",
          include: ["compatibility/wpt.spec.mjs"],
        },
      },
      {
        test: {
          ...common,
          name: "memory",
          include: ["benchmarks/memory.spec.mjs"],
          pool: "forks",
          execArgv: ["--expose-gc"],
        },
      },
      { test: { ...benchmark, name: "benchmark-node" } },
      ...["chromium", "firefox"].map((browser) => ({
        test: {
          ...benchmark,
          name: `benchmark-${browser}`,
          api: { host: "127.0.0.1" },
          browser: {
            enabled: true,
            headless: true,
            screenshotFailures: false,
            provider: playwright(),
            instances: [{ browser }],
          },
        },
      })),
    ],
  },
});
