/* eslint-disable indent */
/**
 * The following tests are copied from
 * https://github.com/MattiasBuelens/wpt/blob/38c4fcee35b5376eac4cf037d9ca1f8343cf06e4/streams/readable-streams/from.any.js
 * and rewritten for Vitest
 */

import { test, assert, describe } from "vitest";
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

describe("fromIterable accepts valid iterables", () => {
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
});

const badIterables = [
  ["null", null],
  ["undefined", undefined],
  ["0", 0],
  ["NaN", NaN],
  ["true", true],
  ["{}", {}],
  ["Object.create(null)", Object.create(null)],
  ["a function", () => 42],
  ["a symbol", Symbol()],
  [
    "an object with a non-callable @@iterator method",
    {
      [Symbol.iterator]: 42,
    },
  ],
  [
    "an object with a non-callable @@asyncIterator method",
    {
      [Symbol.asyncIterator]: 42,
    },
  ],
];

describe("fromIterable throws on invalid iterables", () => {
  for (const [label, iterable] of badIterables) {
    test(`fromIterable throws on invalid iterables; specifically ${label}`, () => {
      assert.throw(
        () => fromIterable(iterable),
        TypeError,
        undefined,
        "fromIterable() should throw a TypeError"
      );
    });
  }
});

test("fromIterable re-throws errors from calling the @@iterator method", () => {
  const theError = new Error("a unique string");
  const iterable = {
    [Symbol.iterator]() {
      throw theError;
    },
  };

  assert.throw(
    () => fromIterable(iterable),
    theError,
    "a unique string",
    "fromIterable() should re-throw the error"
  );
});

test("fromIterable re-throws errors from calling the @@asyncIterator method", () => {
  const theError = new Error("a unique string");
  const iterable = {
    [Symbol.asyncIterator]() {
      throw theError;
    },
  };

  assert.throw(
    () => fromIterable(iterable),
    theError,
    "a unique string",
    "fromIterable() should re-throw the error"
  );
});

test("fromIterable ignores @@iterator if @@asyncIterator exists", () => {
  const theError = new Error("a unique string");
  let reached = false;
  const iterable = {
    [Symbol.iterator]() {
      reached = true;
    },
    [Symbol.asyncIterator]() {
      throw theError;
    },
  };

  assert.throw(
    () => fromIterable(iterable),
    theError,
    "a unique string",
    "fromIterable() should re-throw the error"
  );

  assert.isFalse(reached);
});

test("fromIterable accepts an empty iterable", async () => {
  const iterable = {
    async next() {
      return { value: undefined, done: true };
    },
    [Symbol.asyncIterator]: () => iterable,
  };

  const rs = fromIterable(iterable);
  const reader = rs.getReader();

  const read = await reader.read();
  assert.deepEqual(
    read,
    { value: undefined, done: true },
    "first read should be done"
  );

  await reader.closed;
});

test("fromIterable: stream errors when next() rejects", async () => {
  const theError = new Error("a unique string");

  const iterable = {
    async next() {
      throw theError;
    },
    [Symbol.asyncIterator]: () => iterable,
  };

  const rs = fromIterable(iterable);
  const reader = rs.getReader();

  const rejectedPromises = await Promise.allSettled([
    reader.read(),
    reader.closed,
  ]);

  assert.strictEqual(rejectedPromises[0].status, "rejected");
  assert.strictEqual(
    (rejectedPromises[0] as PromiseRejectedResult).reason,
    theError
  );

  assert.strictEqual(rejectedPromises[1].status, "rejected");
  assert.strictEqual(
    (rejectedPromises[1] as PromiseRejectedResult).reason,
    theError
  );
});
