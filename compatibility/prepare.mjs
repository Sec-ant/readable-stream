import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const revision =
  process.env.WPT_REVISION ?? "7d604ea1ff2447ded8648c3fba5d6d966463b81e";
if (!/^[a-f0-9]{40}$/.test(revision))
  throw new Error("WPT_REVISION must be a full commit SHA.");
const root = ".vitest/compatibility/wpt";
const files = [
  "resources/testharness.js",
  "resources/webidl2/lib/webidl2.js",
  "resources/idlharness.js",
  "interfaces/streams.idl",
  "interfaces/dom.idl",
  "streams/resources/rs-utils.js",
  "streams/resources/test-utils.js",
  "streams/resources/recording-streams.js",
  "streams/readable-streams/async-iterator.any.js",
  "streams/readable-streams/from.any.js",
  "streams/readable-streams/cross-realm-crash.window.js",
  "streams/idlharness.any.js",
];
let previous;
try {
  previous = JSON.parse(await readFile(`${root}/revision.json`, "utf8"));
} catch {}
const hashes = {};
const digest = (content) => createHash("sha256").update(content).digest("hex");
await Promise.all(
  files.map(async (path) => {
    const target = `${root}/${path}`;
    if (previous?.revision === revision) {
      try {
        const cached = await readFile(target);
        if (previous.hashes?.[path] === digest(cached)) {
          hashes[path] = digest(cached);
          return;
        }
      } catch {}
    }
    const response = await fetch(
      `https://raw.githubusercontent.com/web-platform-tests/wpt/${revision}/${path}`,
      { signal: AbortSignal.timeout(60000) },
    );
    if (!response.ok)
      throw new Error(`WPT download failed: ${path}: HTTP ${response.status}`);
    const content = Buffer.from(await response.arrayBuffer());
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
    hashes[path] = digest(content);
  }),
);
await writeFile(
  `${root}/revision.json`,
  `${JSON.stringify({ revision, files, hashes }, null, 2)}\n`,
);
console.log(`WPT ${revision}: ${files.length} unchanged upstream files ready.`);
