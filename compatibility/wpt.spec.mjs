import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, firefox, webkit } from "playwright";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startCompatibilityServer } from "./server.mjs";

let server;
beforeAll(async () => {
  server = await startCompatibilityServer();
});
afterAll(async () => {
  await server?.close();
});
const browsers = process.env.COMPAT_BROWSERS?.split(",") ?? [
  "chromium",
  "firefox",
  "webkit",
];

async function webdriver(path, body, method = "POST") {
  const response = await fetch(`http://127.0.0.1:4444${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000),
  });
  const { value } = await response.json();
  if (value?.error) throw new Error(`${value.error}: ${value.message}`);
  return value;
}

for (const name of browsers) {
  describe(name, () => {
    let browser;
    let session;
    beforeAll(async () => {
      if (name === "safari") {
        const value = await webdriver("/session", {
          capabilities: { alwaysMatch: { browserName: "safari" } },
        });
        session = value.sessionId;
      } else if (name.endsWith("-legacy")) {
        const previous = process.env.PLAYWRIGHT_BROWSERS_PATH;
        process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(
          ".vitest/compatibility/browsers/playwright-1.37",
        );
        try {
          const legacy = await import(
            "../.vitest/compatibility/legacy/node_modules/playwright/index.mjs"
          );
          browser = await legacy[name.replace("-legacy", "")].launch({
            headless: true,
          });
        } finally {
          if (previous === undefined)
            delete process.env.PLAYWRIGHT_BROWSERS_PATH;
          else process.env.PLAYWRIGHT_BROWSERS_PATH = previous;
        }
      } else {
        const engine =
          name === "chrome-114"
            ? chromium
            : { chromium, firefox, webkit }[name];
        browser = await engine.launch({
          headless: true,
          ...(name === "chrome-114"
            ? { executablePath: resolveOldChromium() }
            : {}),
        });
      }
    });
    afterAll(async () => {
      await browser?.close();
      if (session) await webdriver(`/session/${session}`, undefined, "DELETE");
    });
    async function loadPage(url) {
      let result;
      let features;
      if (session) {
        await webdriver(`/session/${session}/url`, { url });
        const deadline = Date.now() + 60000;
        while (Date.now() < deadline) {
          result = await webdriver(`/session/${session}/execute/sync`, {
            script: "return window.__wptResults || null",
            args: [],
          });
          if (result) break;
          await new Promise((done) => setTimeout(done, 100));
        }
        features = await webdriver(`/session/${session}/execute/sync`, {
          script: "return window.__nativeFeatures || null",
          args: [],
        });
      } else {
        const page = await browser.newPage();
        try {
          await page.goto(url);
          await page.waitForFunction(() => window.__wptResults, {
            timeout: 60000,
          });
          result = await page.evaluate(() => ({
            ...window.__wptResults,
            loadError: window.__loadError,
          }));
          features = await page.evaluate(() => window.__nativeFeatures);
        } finally {
          await page.close();
        }
      }
      if (!result) throw new Error("WPT did not complete");
      return { nativeFeatures: features, ...result };
    }
    for (const suite of [
      "async-iterator",
      "from",
      "idl",
      "cross-realm",
      "receivers",
    ]) {
      for (const context of suite === "cross-realm"
        ? ["window"]
        : ["window", "worker"]) {
        test(`${suite} / ${context}`, async () => {
          const url = `${server.url}/?suite=${suite}&context=${context}`;
          const result = await loadPage(url);
          expect(result, "WPT completion").toBeTruthy();
          await mkdir(".vitest/compatibility/results", { recursive: true });
          await writeFile(
            `.vitest/compatibility/results/${name}-${suite}-${context}.json`,
            JSON.stringify(
              {
                browser: name,
                suite,
                context,
                ...result,
              },
              null,
              2,
            ),
          );
          expect(result.loadError).toBeUndefined();
          expect(result.status, result.message).toBe(0);
          expect(result.tests.length).toBeGreaterThan(0);
          const failures = result.tests.filter((t) => t.status !== 0);
          if (suite === "idl") {
            const baseline = await loadPage(`${url}&mode=native`);
            await writeFile(
              `.vitest/compatibility/results/${name}-${suite}-${context}-native.json`,
              JSON.stringify(
                { browser: name, suite, context, mode: "native", ...baseline },
                null,
                2,
              ),
            );
            expect(baseline.status, baseline.message).toBe(0);
            expect(baseline.loadError).toBeUndefined();
            const nativeFailures = new Set(
              baseline.tests.filter((t) => t.status !== 0).map((t) => t.name),
            );
            expect(failures.filter((t) => !nativeFailures.has(t.name))).toEqual(
              [],
            );
          } else {
            expect(failures).toEqual([]);
          }
        });
      }
    }
  });
}
function resolveOldChromium() {
  return fileURLToPath(
    new URL(
      `../.vitest/compatibility/browsers/chrome-114/chrome-${process.arch === "arm64" ? "mac-arm64" : "mac-x64"}/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
      import.meta.url,
    ),
  );
}
