import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    host: "127.0.0.1",
  },
  build: {
    target: "ESNext",
    minify: false,
    lib: {
      entry: {
        "ponyfill/asyncIterator": "src/ponyfill/asyncIterator.ts",
        "ponyfill/fromAnyIterable": "src/ponyfill/fromAnyIterable.ts",
        "ponyfill/index": "src/ponyfill/index.ts",
        "polyfill/asyncIterator": "src/polyfill/asyncIterator.ts",
        "polyfill/fromAnyIterable": "src/polyfill/fromAnyIterable.ts",
        "polyfill/index": "src/polyfill/index.ts",
        "index/asyncIterator": "src/index/asyncIterator.ts",
        "index/fromAnyIterable": "src/index/fromAnyIterable.ts",
        "index/index": "src/index/index.ts",
      },
      formats: ["es"],
      fileName: (_, entryName) => `${entryName}.js`,
    },
    outDir: "dist",
    rolldownOptions: {
      output: {
        preserveModules: true,
        preserveModulesRoot: "src",
        entryFileNames: "[name].js",
      },
    },
  },
  test: {
    include: ["tests/**/*.spec.ts"],
    api: {
      host: "127.0.0.1",
    },
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [
        {
          name: "chromium",
          browser: "chromium",
        },
        {
          name: "firefox",
          browser: "firefox",
        },
        {
          name: "webkit",
          browser: "webkit",
        },
      ],
      screenshotFailures: false,
    },
    coverage: {
      provider: "istanbul",
      include: ["src/**"],
    },
  },
});
