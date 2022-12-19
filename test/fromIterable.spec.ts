/* eslint-disable indent */
/**
 * The following tests are copied from
 * https://github.com/MattiasBuelens/wpt/blob/38c4fcee35b5376eac4cf037d9ca1f8343cf06e4/streams/readable-streams/from.any.js
 * and rewritten for Vitest
 */

import { test, assert } from "vitest";
import { fromIterable } from "../src/fromIterable";

const iterableFactories: [
  string,
  () => Iterable<unknown> | AsyncIterable<unknown>
][] = [
  [
    "an array of values",
    () => {
      return ["a", "b"];
    },
  ],

  [
    "an array of promises",
    () => {
      return [Promise.resolve("a"), Promise.resolve("b")];
    },
  ],

  [
    "an array iterator",
    () => {
      return ["a", "b"][Symbol.iterator]();
    },
  ],

  [
    "a string",
    () => {
      // This iterates over the code points of the string.
      return "ab";
    },
  ],

  [
    "a Set",
    () => {
      return new Set(["a", "b"]);
    },
  ],

  [
    "a Set iterator",
    () => {
      return new Set(["a", "b"])[Symbol.iterator]();
    },
  ],

  [
    "a sync generator",
    () => {
      function* syncGenerator() {
        yield "a";
        yield "b";
      }

      return syncGenerator();
    },
  ],

  [
    "an async generator",
    () => {
      async function* asyncGenerator() {
        yield "a";
        yield "b";
      }

      return asyncGenerator();
    },
  ],

  [
    "a sync iterable of values",
    () => {
      const chunks = ["a", "b"];
      const it = {
        next() {
          return {
            done: chunks.length === 0,
            value: chunks.shift(),
          };
        },
        [Symbol.iterator]: () => it,
      };
      return it;
    },
  ],

  [
    "a sync iterable of promises",
    () => {
      const chunks = ["a", "b"];
      const it = {
        next() {
          return chunks.length === 0
            ? ({ done: true } as IteratorReturnResult<undefined>)
            : {
                done: false,
                value: Promise.resolve(chunks.shift()),
              };
        },
        [Symbol.iterator]: () => it,
      };
      return it;
    },
  ],

  [
    "an async iterable",
    () => {
      const chunks = ["a", "b"];
      const it = {
        next() {
          return Promise.resolve({
            done: chunks.length === 0,
            value: chunks.shift(),
          });
        },
        [Symbol.asyncIterator]: () => it,
      };
      return it;
    },
  ],

  [
    "a ReadableStream",
    () => {
      return new ReadableStream({
        start(c) {
          c.enqueue("a");
          c.enqueue("b");
          c.close();
        },
      });
    },
  ],

  [
    "a ReadableStream async iterator",
    () => {
      return new ReadableStream({
        start(c) {
          c.enqueue("a");
          c.enqueue("b");
          c.close();
        },
      })[Symbol.asyncIterator]();
    },
  ],
];

for (const [label, factory] of iterableFactories) {
  test(`fromIterable accepts ${label}`, async () => {
    const iterable = factory();
    const rs = fromIterable(iterable);
    assert.strictEqual(
      rs.constructor,
      ReadableStream,
      "fromIterable() should return a ReadableStream"
    );

    const reader = rs.getReader();
    assert.deepEqual(
      await reader.read(),
      { value: "a", done: false },
      "first read should be correct"
    );
    assert.deepEqual(
      await reader.read(),
      { value: "b", done: false },
      "second read should be correct"
    );
    assert.deepEqual(
      await reader.read(),
      { value: undefined, done: true },
      "third read should be done"
    );
    await reader.closed;
  });
}
