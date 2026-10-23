import { expect, test } from "vitest";
import { asyncIterator as original } from "../.vitest/performance/baseline/asyncIterator.js";
import { fromAnyIterable as originalFrom } from "../.vitest/performance/baseline/fromAnyIterable.js";
import { asyncIterator as current } from "../src/core/asyncIterator.js";
import { fromAnyIterable as currentFrom } from "../src/core/fromAnyIterable.js";

const runtime =
  typeof window === "undefined" ? process.version : navigator.userAgent;
const chunks = 8192;
const values = Array.from({ length: chunks }, (_, i) => i);
const promises = values.map((value) => Promise.resolve(value));
const expected = (chunks * (chunks - 1)) / 2;
const iterators = {
  original,
  current,
};
const converters = {
  original: originalFrom,
  current: currentFrom,
};
function stream(pull) {
  let i = 0;
  return new ReadableStream(
    pull
      ? {
          pull(controller) {
            if (i < chunks) controller.enqueue(i++);
            else controller.close();
          },
        }
      : {
          start(controller) {
            for (const value of values) controller.enqueue(value);
            controller.close();
          },
        },
    { highWaterMark: 0 },
  );
}
async function consume(iterator) {
  let sum = 0;
  for (;;) {
    const result = await iterator.next();
    if (result.done) return sum;
    sum += result.value;
  }
}
async function consumeReader(readable) {
  const reader = readable.getReader();
  let sum = 0;
  for (;;) {
    const result = await reader.read();
    if (result.done) {
      reader.releaseLock();
      return sum;
    }
    sum += result.value;
  }
}
function quantile(xs, p) {
  return [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) * p)];
}
const scenarios = [
  {
    name: "iterator-prefilled",
    variants: iterators,
    expected,
    run: (values) => consume(values(stream(false))),
  },
  {
    name: "iterator-pull",
    variants: iterators,
    expected,
    run: (values) => consume(values(stream(true))),
  },
  {
    name: "iterator-queued-reads",
    variants: iterators,
    expected,
    async run(values) {
      const iterator = values(stream(false));
      let sum = 0;
      for (let offset = 0; offset < chunks; offset += 64) {
        const results = await Promise.all(
          Array.from({ length: 64 }, () => iterator.next()),
        );
        for (const result of results) sum += result.value;
      }
      expect((await iterator.next()).done).toBe(true);
      return sum;
    },
  },
  {
    name: "iterator-create-return",
    variants: iterators,
    expected: 1024,
    async run(values) {
      let count = 0;
      for (let i = 0; i < 1024; i++) {
        const iterator = values(new ReadableStream(), { preventCancel: true });
        count += Number((await iterator.return()).done);
      }
      return count;
    },
  },
  {
    name: "iterator-finished-next",
    variants: iterators,
    expected: chunks,
    async run(values) {
      const iterator = values(new ReadableStream({ start: (c) => c.close() }));
      await iterator.next();
      let count = 0;
      for (let i = 0; i < chunks; i++)
        count += Number((await iterator.next()).done);
      return count;
    },
  },
  {
    name: "from-sync-values",
    variants: converters,
    expected,
    run: (from) => consumeReader(from(values)),
  },
  {
    name: "from-sync-promises",
    variants: converters,
    expected,
    run: (from) => consumeReader(from(promises)),
  },
  {
    name: "from-async-iterator",
    variants: converters,
    expected,
    run(from) {
      let i = 0;
      return consumeReader(
        from({
          [Symbol.asyncIterator]: () => ({
            next: () =>
              Promise.resolve(
                i < chunks
                  ? {
                      done: false,
                      value: i++,
                    }
                  : {
                      done: true,
                      value: undefined,
                    },
              ),
          }),
        }),
      );
    },
  },
  {
    name: "from-async-generator",
    variants: converters,
    expected,
    run(from) {
      return consumeReader(
        from(
          (async function* () {
            yield* values;
          })(),
        ),
      );
    },
  },
];
for (const scenario of scenarios) {
  test(scenario.name, async () => {
    const entries = Object.entries(scenario.variants);
    const samples = Object.fromEntries(entries.map(([name]) => [name, []]));
    for (let round = -6; round < 25; round++) {
      const order = entries.map(
        (_, i) => entries[(i + Math.abs(round)) % entries.length],
      );
      for (const [name, implementation] of order) {
        const started = performance.now();
        const sum = await scenario.run(implementation);
        const elapsed = performance.now() - started;
        expect(sum).toBe(scenario.expected);
        if (round >= 0) samples[name].push(elapsed);
      }
    }
    const summary = Object.fromEntries(
      Object.entries(samples).map(([name, times]) => [
        name,
        {
          median: quantile(times, 0.5),
          p10: quantile(times, 0.1),
          p90: quantile(times, 0.9),
        },
      ]),
    );
    const result = JSON.stringify({
      runtime,
      scenario: scenario.name,
      chunks,
      samples,
      summary,
    });
    if (typeof window === "undefined") {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(
        `.vitest/performance/results-node-${scenario.name}.json`,
        result,
      );
    } else {
      const { commands } = await import("vitest/browser");
      const browser = navigator.userAgent.includes("Firefox")
        ? "firefox"
        : "chromium";
      await commands.writeFile(
        `.vitest/performance/results-${browser}-${scenario.name}.json`,
        result,
      );
    }
  });
}
