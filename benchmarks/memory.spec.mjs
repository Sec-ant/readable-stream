import { writeFile } from "node:fs/promises";
import { Session } from "node:inspector";
import { expect, test } from "vitest";
import { asyncIterator as original } from "../.vitest/performance/baseline/asyncIterator.js";
import { asyncIterator as current } from "../src/core/asyncIterator.js";

const variants = {
  original,
  current,
};
const pause = () => new Promise((resolve) => setTimeout(resolve, 0));
const session = new Session();
const post = (method, params = {}) =>
  new Promise((resolve, reject) => {
    session.post(method, params, (error, response) =>
      error ? reject(error) : resolve(response),
    );
  });
async function workload(values, count) {
  const stream = new ReadableStream({
    start(controller) {
      for (let i = 0; i < count; i++) controller.enqueue(i);
      controller.close();
    },
  });
  const iterator = values(stream);
  let sum = 0;
  while (true) {
    const result = await iterator.next();
    if (result.done) return sum;
    sum += result.value;
  }
}
function total(node) {
  return (
    node.selfSize + node.children.reduce((sum, child) => sum + total(child), 0)
  );
}
test("sample allocated bytes including objects collected during iteration", async () => {
  session.connect();
  try {
    const samples = {};
    for (const [name, values] of Object.entries(variants)) {
      samples[name] = [];
      for (let i = 0; i < 8; i++) await workload(values, 8192);
    }
    const entries = Object.entries(variants);
    for (let round = 0; round < 7; round++) {
      const order = entries.map(
        (_, i) => entries[(i + round) % entries.length],
      );
      for (const [name, values] of order) {
        global.gc();
        await post("HeapProfiler.startSampling", {
          samplingInterval: 4096,
          includeObjectsCollectedByMajorGC: true,
          includeObjectsCollectedByMinorGC: true,
        });
        for (let i = 0; i < 8; i++)
          expect(await workload(values, 4096)).toBe(8386560);
        const { profile } = await post("HeapProfiler.stopSampling");
        samples[name].push(total(profile.head));
      }
    }
    await writeFile(
      ".vitest/performance/allocations.json",
      JSON.stringify(
        {
          node: process.version,
          operations: 8 * 4096,
          samplingInterval: 4096,
          rounds: 7,
          samples,
        },
        null,
        2,
      ),
    );
  } finally {
    session.disconnect();
  }
});
test("consumed chunks can be collected while returned iterators stay alive", async () => {
  const held = [];
  const references = {};
  async function setup(values) {
    const iterator = values(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(1024 * 1024));
        },
      }),
    );
    const result = await iterator.next();
    const reference = new WeakRef(result.value);
    await iterator.return();
    held.push(iterator);
    return reference;
  }
  for (const [name, values] of Object.entries(variants)) {
    references[name] = [];
    for (let i = 0; i < 16; i++) references[name].push(await setup(values));
  }
  for (let i = 0; i < 12; i++) {
    await pause();
    global.gc();
  }
  const retained = Object.fromEntries(
    Object.entries(references).map(([name, refs]) => [
      name,
      refs.filter((ref) => ref.deref()).length,
    ]),
  );
  expect(retained.current).toBe(0);
  expect(held).toHaveLength(32);
  await writeFile(
    ".vitest/performance/retention.json",
    JSON.stringify(
      {
        node: process.version,
        bufferBytes: 1024 * 1024,
        iteratorsPerVariant: 16,
        retained,
      },
      null,
      2,
    ),
  );
});
