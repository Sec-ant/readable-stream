import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    target: "ESNext",
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
  },
  test: {
    browser: {
      enabled: true,
      headless: true,
      name: "chromium",
      provider: "playwright",
    },
    coverage: {
      provider: "istanbul",
    },
  },
});
