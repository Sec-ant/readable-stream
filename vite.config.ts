import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    target: "esnext",
    lib: {
      entry: {
        index: "./src/index.ts",
      },
      formats: ["es"],
    },
    emptyOutDir: false,
  },
  test: {
    browser: {
      enabled: true,
      headless: true,
      name: "chromium",
      provider: "playwright",
    },
  },
});
