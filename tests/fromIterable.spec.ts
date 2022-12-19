/* eslint-disable indent */
/**
 * The following tests are copied from
 * https://github.com/MattiasBuelens/wpt/blob/38c4fcee35b5376eac4cf037d9ca1f8343cf06e4/streams/readable-streams/from.any.js
 * and rewritten for Vitest
 */

import { test, assert, describe } from "vitest";
import { flushAsyncEvents } from "./stubs";
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

test("fromIterable: stream stalls when next() never settles", async () => {
  const iterable = {
    next() {
      return new Promise(() => {
        /* void */
      });
    },
    [Symbol.asyncIterator]: () => iterable,
  };

  const rs = fromIterable(iterable as AsyncIterable<unknown>);
  const reader = rs.getReader();

  const reachFlag = [false, false, false, false];
  await Promise.race([
    reader.read().then(
      () => (reachFlag[0] = true),
      () => (reachFlag[1] = true)
    ),
    reader.closed.then(
      () => (reachFlag[2] = true),
      () => (reachFlag[3] = true)
    ),
    flushAsyncEvents(),
  ]);

  assert.isFalse(reachFlag[0], "read() should not resolve");
  assert.isFalse(reachFlag[1], "read() should not reject");
  assert.isFalse(reachFlag[2], "closed should not resolve");
  assert.isFalse(reachFlag[3], "closed should not reject");
});

test("fromIterable: calls next() after first read()", async () => {
  let nextCalls = 0;
  let nextArgs: unknown[] | undefined;
  const iterable = {
    async next(...args: unknown[]) {
      nextCalls += 1;
      nextArgs = args;
      return { value: "a", done: false };
    },
    [Symbol.asyncIterator]: () => iterable,
  };

  const rs = fromIterable(iterable);
  const reader = rs.getReader();

  await flushAsyncEvents();

  assert.strictEqual(nextCalls, 0, "next() should not be called yet");

  const read = await reader.read();
  assert.deepEqual(
    read,
    { value: "a", done: false },
    "first read should be correct"
  );
  assert.strictEqual(
    nextCalls,
    1,
    "next() should be called after first read()"
  );
  assert.deepEqual(nextArgs, [], "next() should be called with no arguments");
});

test("fromIterable: cancelling the returned stream calls and awaits return()", async () => {
  const theError = new Error("a unique string");

  let returnCalls = 0;
  let returnArgs: unknown[] | undefined;
  let resolveReturn: ((value?: unknown) => void) | undefined;
  let reached1 = false;
  let reached2 = false;
  const iterable = {
    next: () => (reached1 = true),
    throw: () => (reached2 = true),
    async return(...args: unknown[]): Promise<IteratorReturnResult<undefined>> {
      returnCalls += 1;
      returnArgs = args;
      await new Promise((r) => (resolveReturn = r));
      return { done: true, value: undefined };
    },
    [Symbol.asyncIterator]: () => iterable,
  };

  const rs = fromIterable(iterable as unknown as AsyncIterable<unknown>);
  const reader = rs.getReader();
  assert.strictEqual(returnCalls, 0, "return() should not be called yet");

  let cancelResolved = false;
  const cancelPromise = reader.cancel(theError).then(() => {
    cancelResolved = true;
  });

  await flushAsyncEvents();
  assert.strictEqual(returnCalls, 1, "return() should be called");
  assert.deepEqual(
    returnArgs,
    [theError],
    "return() should be called with cancel reason"
  );
  assert.isFalse(
    cancelResolved,
    "cancel() should not resolve while promise from return() is pending"
  );

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  (resolveReturn as (value?: unknown) => void)();
  await Promise.all([cancelPromise, reader.closed]);
  assert.isFalse(reached1, "next() should not be called");
  assert.isFalse(reached2, "throw() should not be called");
});

test("fromIterable: return() is not called when iterator completes normally", async () => {
  let nextCalls = 0;
  let returnCalls = 0;

  let reached = false;
  const iterable = {
    async next() {
      nextCalls += 1;
      return { value: undefined, done: true };
    },
    throw: () => {
      reached = true;
    },
    async return() {
      returnCalls += 1;
    },
    [Symbol.asyncIterator]: () => iterable,
  };

  const rs = fromIterable(iterable as unknown as AsyncIterable<undefined>);
  const reader = rs.getReader();

  const read = await reader.read();
  assert.deepEqual(
    read,
    { value: undefined, done: true },
    "first read should be done"
  );
  assert.strictEqual(nextCalls, 1, "next() should be called once");

  await reader.closed;
  assert.strictEqual(returnCalls, 0, "return() should not be called");

  assert.isFalse(reached);
});

test("fromIterable: reader.read() inside next()", async () => {
  let nextCalls = 0;
  let reader: ReadableStreamDefaultReader<string | undefined> | undefined =
    undefined;
  const values: string[] = ["a", "b", "c"];

  const iterable = {
    async next() {
      nextCalls += 1;
      if (nextCalls === 1) {
        (reader as ReadableStreamDefaultReader<string | undefined>).read();
      }
      return { value: values.shift(), done: false };
    },
    [Symbol.asyncIterator]: () => iterable,
  };

  const rs = fromIterable(iterable);
  reader = rs.getReader();

  const read1 = await reader.read();
  assert.deepEqual(
    read1,
    { value: "a", done: false },
    "first read should be correct"
  );
  await flushAsyncEvents();
  assert.strictEqual(nextCalls, 2, "next() should be called two times");

  const read2 = await reader.read();
  assert.deepEqual(
    read2,
    { value: "c", done: false },
    "second read should be correct"
  );
  assert.strictEqual(nextCalls, 3, "next() should be called three times");
});

test("fromIterable: reader.cancel() inside next()", async () => {
  let nextCalls = 0;
  let returnCalls = 0;
  let reader: ReadableStreamDefaultReader<string> | undefined = undefined;

  const iterable = {
    async next() {
      nextCalls++;
      await (reader as ReadableStreamDefaultReader<string>).cancel();
      assert.strictEqual(returnCalls, 1, "return() should be called once");
      return { value: "something else", done: false };
    },
    async return() {
      returnCalls++;
    },
    [Symbol.asyncIterator]: () => iterable,
  };

  const rs = fromIterable(iterable as unknown as AsyncIterable<string>);
  reader = rs.getReader();

  const read = await reader.read();
  assert.deepEqual(
    read,
    { value: undefined, done: true },
    "first read should be done"
  );
  assert.strictEqual(nextCalls, 1, "next() should be called once");

  await reader.closed;
});

test("fromIterable: reader.cancel() inside return()", async () => {
  let returnCalls = 0;
  let reader: ReadableStreamDefaultReader<unknown> | undefined = undefined;

  let reached = false;
  const iterable = {
    next: () => (reached = true),
    async return() {
      returnCalls++;
      await (reader as ReadableStreamDefaultReader<unknown>).cancel();
    },
    [Symbol.asyncIterator]: () => iterable,
  };

  const rs = fromIterable(iterable as unknown as AsyncIterable<unknown>);
  reader = rs.getReader();

  await reader.cancel();
  assert.strictEqual(returnCalls, 1, "return() should be called once");

  await reader.closed;
  assert.isFalse(reached, "next() should not be called");
});

test("fromIterable(array), push() to array while reading", async () => {
  const array = ["a", "b"];

  const rs = fromIterable(array);
  const reader = rs.getReader();

  const read1 = await reader.read();
  assert.deepEqual(
    read1,
    { value: "a", done: false },
    "first read should be correct"
  );
  const read2 = await reader.read();
  assert.deepEqual(
    read2,
    { value: "b", done: false },
    "second read should be correct"
  );

  array.push("c");

  const read3 = await reader.read();
  assert.deepEqual(
    read3,
    { value: "c", done: false },
    "third read after push() should be correct"
  );
  const read4 = await reader.read();
  assert.deepEqual(
    read4,
    { value: undefined, done: true },
    "fourth read should be done"
  );

  await reader.closed;
});
