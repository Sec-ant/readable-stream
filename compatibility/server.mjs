import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve, sep } from "node:path";

const helpers = ["rs-utils", "test-utils", "recording-streams"].map(
  (name) => `/wpt/streams/resources/${name}.js`,
);
const capture = `
const nativeFeatures = { values: typeof ReadableStream.prototype.values,
  asyncIterator: typeof ReadableStream.prototype[Symbol.asyncIterator], from: typeof ReadableStream.from };
`;
const prepare = `${capture}
delete ReadableStream.prototype.values;
delete ReadableStream.prototype[Symbol.asyncIterator];
delete ReadableStream.from;
await import('/dist/polyfill/index.js');
`;
const collect = `
setup({ explicit_done: true });
add_completion_callback((tests, status) => {
  globalThis.__wptResults = { userAgent: navigator.userAgent,
    status: status.status, message: status.message,
    tests: tests.map(t => ({ name: t.name, status: t.status, message: t.message })) };
});
`;

export async function startCompatibilityServer() {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    const suite = url.searchParams.get("suite");
    const native = url.searchParams.get("mode") === "native";
    const install = native ? capture : prepare;
    if (["/", "/worker.js"].includes(url.pathname)) {
      if (
        !["async-iterator", "from", "idl", "cross-realm", "receivers"].includes(
          suite,
        )
      ) {
        response.writeHead(400).end("Unknown WPT suite");
        return;
      }
      const path =
        suite === "receivers"
          ? "/local/receivers.js"
          : suite === "idl"
            ? "/wpt/streams/idlharness.any.js"
            : suite === "cross-realm"
              ? "/wpt/streams/readable-streams/cross-realm-crash.window.js"
              : `/wpt/streams/readable-streams/${suite}.any.js`;
      const scripts =
        suite === "idl"
          ? [
              "/wpt/resources/webidl2/lib/webidl2.js",
              "/wpt/resources/idlharness.js",
            ]
          : helpers;
      if (url.pathname === "/worker.js") {
        response.setHeader("Content-Type", "text/javascript");
        response.end(`importScripts('/wpt/resources/testharness.js');
setup({ explicit_done: true });
(async () => { ${install}
importScripts(${[...scripts, path].map(JSON.stringify).join(",")});
done(); })().catch(error => { test(() => { throw error; }, 'Worker bootstrap'); done(); });`);
      } else {
        response.setHeader("Content-Type", "text/html");
        const worker = url.searchParams.get("context") === "worker";
        response.end(`<!doctype html><meta charset="utf-8"><body>
<script src="/wpt/resources/testharness.js"></script>
<script>${collect}</script>
<script type="module">
try {
${
  worker
    ? `await fetch_tests_from_worker(new Worker('/worker.js?suite=${suite}&mode=${native ? "native" : "polyfill"}'));`
    : `${install}
const load = src => new Promise((resolve, reject) => {
  const script = document.createElement('script'); script.src = src;
  script.onload = resolve; script.onerror = reject; document.head.append(script);
});
for (const src of ${JSON.stringify([...scripts, path])}) await load(src);
window.__nativeFeatures = nativeFeatures;`
}
done();
} catch (error) { window.__loadError = String(error); done(); }
</script>`);
      }
      return;
    }
    if (url.pathname === "/local/receivers.js") {
      response.setHeader("Content-Type", "text/javascript");
      response.end(await readFile("compatibility/receivers.js"));
      return;
    }
    const prefix = url.pathname.startsWith("/dist/")
      ? "/dist/"
      : url.pathname.startsWith("/interfaces/")
        ? "/interfaces/"
        : "/wpt/";
    const directory =
      prefix === "/dist/"
        ? resolve("dist")
        : prefix === "/interfaces/"
          ? resolve(".vitest/compatibility/wpt/interfaces")
          : resolve(".vitest/compatibility/wpt");
    const file = resolve(
      directory,
      decodeURIComponent(url.pathname.slice(prefix.length)),
    );
    if (!url.pathname.startsWith(prefix) || !file.startsWith(directory + sep)) {
      response.writeHead(404).end();
      return;
    }
    try {
      response.setHeader("Content-Type", "text/javascript");
      response.end(await readFile(file));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((done) => server.close(done)),
  };
}
