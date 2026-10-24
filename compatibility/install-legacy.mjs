import { execFileSync } from "node:child_process";
import { access, mkdir, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

if (process.platform !== "darwin" || !["arm64", "x64"].includes(process.arch)) {
  throw new Error(
    "This optional legacy matrix installer currently supports macOS only.",
  );
}
const root = ".vitest/compatibility";
const platform = process.arch === "arm64" ? "mac-arm64" : "mac-x64";
const executable = `${root}/browsers/chrome-114/chrome-${platform}/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
try {
  await access(executable);
} catch {
  await mkdir(`${root}/browsers`, { recursive: true });
  const url = `https://storage.googleapis.com/chrome-for-testing-public/114.0.5735.133/${platform}/chrome-${platform}.zip`;
  const response = await fetch(url, { signal: AbortSignal.timeout(180000) });
  if (!response.ok)
    throw new Error(`Chrome 114 download failed: ${response.status}`);
  const archive = `${root}/browsers/chrome-114.zip`;
  await writeFile(archive, Buffer.from(await response.arrayBuffer()));
  execFileSync("ditto", ["-xk", archive, `${root}/browsers/chrome-114`], {
    stdio: "inherit",
  });
  await unlink(archive);
}
execFileSync(
  "npm",
  [
    "install",
    "--prefix",
    `${root}/legacy`,
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "playwright@1.37.1",
  ],
  { stdio: "inherit" },
);
execFileSync(
  process.execPath,
  [
    `${root}/legacy/node_modules/playwright/cli.js`,
    "install",
    "firefox",
    "webkit",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: resolve(`${root}/browsers/playwright-1.37`),
    },
  },
);
