/**
 * The following tests are copied from
 * https://github.com/MattiasBuelens/wpt/blob/38c4fcee35b5376eac4cf037d9ca1f8343cf06e4/streams/readable-streams/from.any.js
 * and rewritten for Vitest
 */

import { assert, describe, test } from "vitest";
import { fromAnyIterable } from "../src/ponyfill/fromAnyIterable.js";
import { assumeAs, flushAsyncEvents } from "./utils";

const iterableFactories: [
  string,
  () => Iterable<unknown> | AsyncIterable<unknown>,
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
    "an async iterable without return method",
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

describe("fromAnyIterable accepts valid iterables", () => {
  for (const [label, factory] of iterableFactories) {
    test(`fromAnyIterable accepts ${label}`, async () => {
      await import("../src/polyfill/asyncIterator.js");
      const iterable = factory();
      const rs = fromAnyIterable(iterable);
      assert.strictEqual(
        rs.constructor,
        ReadableStream,
        "fromAnyIterable() should return a ReadableStream",
      );

      const reader = rs.getReader();
      assert.deepEqual(
        await reader.read(),
        { value: "a", done: false },
        "first read should be correct",
      );
      assert.deepEqual(
        await reader.read(),
        { value: "b", done: false },
        "second read should be correct",
      );
      assert.deepEqual(
        await reader.read(),
        { value: undefined, done: true },
        "third read should be done",
      );
      await reader.closed;
    });
  }
});

const badIterables = [
  ["null", null],
  ["undefined", undefined],
  ["0", 0],
  ["NaN", Number.NaN],
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

describe("fromAnyIterable throws on invalid iterables", () => {
  for (const [label, iterable] of badIterables) {
    test(`fromAnyIterable throws on invalid iterables; specifically ${label}`, () => {
      assert.throw(
        () => fromAnyIterable(iterable),
        TypeError,
        undefined,
        "fromAnyIterable() should throw a TypeError",
      );
    });
  }
});

test("fromAnyIterable re-throws errors from calling the @@iterator method", () => {
  const theError = new Error("a unique string");
  const iterable = {
    [Symbol.iterator]() {
      throw theError;
    },
  };

  assert.throw(
    () => fromAnyIterable(iterable),
    theError,
    "a unique string",
    "fromAnyIterable() should re-throw the error",
  );
});

test("fromAnyIterable re-throws errors from calling the @@asyncIterator method", () => {
  const theError = new Error("a unique string");
  const iterable = {
    [Symbol.asyncIterator]() {
      throw theError;
    },
  };

  assert.throw(
    () => fromAnyIterable(iterable),
    theError,
    "a unique string",
    "fromAnyIterable() should re-throw the error",
  );
});

test("fromAnyIterable ignores @@iterator if @@asyncIterator exists", () => {
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
    () => fromAnyIterable(iterable),
    theError,
    "a unique string",
    "fromAnyIterable() should re-throw the error",
  );

  assert.isFalse(reached);
});

test("fromAnyIterable accepts an empty iterable", async () => {
  const iterable = {
    async next() {
      return { value: undefined, done: true };
    },
    [Symbol.asyncIterator]: () => iterable,
  };

  const rs = fromAnyIterable(iterable);
  const reader = rs.getReader();

  const read = await reader.read();
  assert.deepEqual(
    read,
    { value: undefined, done: true },
    "first read should be done",
  );

  await reader.closed;
});

test("fromAnyIterable: stream errors when next() rejects", async () => {
  const theError = new Error("a unique string");

  const iterable = {
    async next() {
      throw theError;
    },
    [Symbol.asyncIterator]: () => iterable,
  };

  const rs = fromAnyIterable(iterable);
  const reader = rs.getReader();

  const rejectedPromises = await Promise.allSettled([
    reader.read(),
    reader.closed,
  ]);

  assert.strictEqual(rejectedPromises[0].status, "rejected");
  assert.strictEqual(
    (rejectedPromises[0] as PromiseRejectedResult).reason,
    theError,
  );

  assert.strictEqual(rejectedPromises[1].status, "rejected");
  assert.strictEqual(
    (rejectedPromises[1] as PromiseRejectedResult).reason,
    theError,
  );
});

test("fromAnyIterable: stream stalls when next() never settles", async () => {
  const iterable = {
    next() {
      return new Promise(() => {
        /* void */
      });
    },
    [Symbol.asyncIterator]: () => iterable,
  };

  const rs = fromAnyIterable(iterable as AsyncIterable<unknown>);
  const reader = rs.getReader();

  const reachFlag = [false, false, false, false];
  await Promise.race([
    reader.read().then(
      () => {
        reachFlag[0] = true;
      },
      () => {
        reachFlag[1] = true;
      },
    ),
    reader.closed.then(
      () => {
        reachFlag[2] = true;
      },
      () => {
        reachFlag[3] = true;
      },
    ),
    flushAsyncEvents(),
  ]);

  assert.isFalse(reachFlag[0], "read() should not resolve");
  assert.isFalse(reachFlag[1], "read() should not reject");
  assert.isFalse(reachFlag[2], "closed should not resolve");
  assert.isFalse(reachFlag[3], "closed should not reject");
});

test("fromAnyIterable: calls next() after first read()", async () => {
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

  const rs = fromAnyIterable(iterable);
  const reader = rs.getReader();

  await flushAsyncEvents();

  assert.strictEqual(nextCalls, 0, "next() should not be called yet");

  const read = await reader.read();
  assert.deepEqual(
    read,
    { value: "a", done: false },
    "first read should be correct",
  );
  assert.strictEqual(
    nextCalls,
    1,
    "next() should be called after first read()",
  );
  assert.deepEqual(nextArgs, [], "next() should be called with no arguments");
});

test("fromAnyIterable: cancelling the returned stream calls and awaits return()", async () => {
  const theError = new Error("a unique string");

  let returnCalls = 0;
  let returnArgs: unknown[] | undefined;
  let resolveReturn: ((value?: unknown) => void) | undefined;
  let reached1 = false;
  let reached2 = false;
  const iterable = {
    next: () => {
      reached1 = true;
    },
    throw: () => {
      reached2 = true;
    },
    async return(...args: unknown[]): Promise<IteratorReturnResult<undefined>> {
      returnCalls += 1;
      returnArgs = args;
      await new Promise((r) => {
        resolveReturn = r;
      });
      return { done: true, value: undefined };
    },
    [Symbol.asyncIterator]: () => iterable,
  };

  const rs = fromAnyIterable(iterable as unknown as AsyncIterable<unknown>);
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
    "return() should be called with cancel reason",
  );
  assert.isFalse(
    cancelResolved,
    "cancel() should not resolve while promise from return() is pending",
  );

  (resolveReturn as (value?: unknown) => void)();
  await Promise.all([cancelPromise, reader.closed]);
  assert.isFalse(reached1, "next() should not be called");
  assert.isFalse(reached2, "throw() should not be called");
});

test("fromAnyIterable: return() is not called when iterator completes normally", async () => {
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

  const rs = fromAnyIterable(iterable as unknown as AsyncIterable<undefined>);
  const reader = rs.getReader();

  const read = await reader.read();
  assert.deepEqual(
    read,
    { value: undefined, done: true },
    "first read should be done",
  );
  assert.strictEqual(nextCalls, 1, "next() should be called once");

  await reader.closed;
  assert.strictEqual(returnCalls, 0, "return() should not be called");

  assert.isFalse(reached);
});

test("fromAnyIterable: cancel() rejects when return() fulfills with a non-object", async () => {
  const theError = new Error("a unique string");

  let reached1 = false;
  let reached2 = false;
  const iterable = {
    next: () => {
      reached1 = true;
    },
    throw: () => {
      reached2 = true;
    },
    async return() {
      return 42;
    },
    [Symbol.asyncIterator]: () => iterable,
  };

  const rs = fromAnyIterable(iterable as unknown as AsyncIterable<unknown>);
  const reader = rs.getReader();

  let reached3 = false;
  try {
    await reader.cancel(theError);
    reached3 = true;
  } catch (e) {
    assert.instanceOf(e, TypeError, "cancel() should reject with a TypeError");
  }

  assert.isFalse(reached1, "next() should not be called");
  assert.isFalse(reached2, "throw() should not be called");
  assert.isFalse(reached3, "cancel() should not be fullfilled");
});

test("fromAnyIterable: reader.read() inside next()", async () => {
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

  const rs = fromAnyIterable(iterable);
  reader = rs.getReader();

  const read1 = await reader.read();
  assert.deepEqual(
    read1,
    { value: "a", done: false },
    "first read should be correct",
  );
  await flushAsyncEvents();
  assert.strictEqual(nextCalls, 2, "next() should be called two times");

  const read2 = await reader.read();
  assert.deepEqual(
    read2,
    { value: "c", done: false },
    "second read should be correct",
  );
  assert.strictEqual(nextCalls, 3, "next() should be called three times");
});

test("fromAnyIterable: reader.cancel() inside next()", async () => {
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

  const rs = fromAnyIterable(iterable as unknown as AsyncIterable<string>);
  reader = rs.getReader();

  const read = await reader.read();
  assert.deepEqual(
    read,
    { value: undefined, done: true },
    "first read should be done",
  );
  assert.strictEqual(nextCalls, 1, "next() should be called once");

  await reader.closed;
});

test("fromAnyIterable: reader.cancel() inside return()", async () => {
  let returnCalls = 0;
  let reader: ReadableStreamDefaultReader<unknown> | undefined = undefined;

  let reached = false;
  const iterable = {
    next: () => {
      reached = true;
    },
    async return() {
      returnCalls++;
      await (reader as ReadableStreamDefaultReader<unknown>).cancel();
      return { done: true };
    },
    [Symbol.asyncIterator]: () => iterable,
  };

  const rs = fromAnyIterable(iterable as unknown as AsyncIterable<unknown>);
  reader = rs.getReader();

  await reader.cancel();
  assert.strictEqual(returnCalls, 1, "return() should be called once");

  await reader.closed;
  assert.isFalse(reached, "next() should not be called");
});

test("fromAnyIterable(array), push() to array while reading", async () => {
  const array = ["a", "b"];

  const rs = fromAnyIterable(array);
  const reader = rs.getReader();

  const read1 = await reader.read();
  assert.deepEqual(
    read1,
    { value: "a", done: false },
    "first read should be correct",
  );
  const read2 = await reader.read();
  assert.deepEqual(
    read2,
    { value: "b", done: false },
    "second read should be correct",
  );

  array.push("c");

  const read3 = await reader.read();
  assert.deepEqual(
    read3,
    { value: "c", done: false },
    "third read after push() should be correct",
  );
  const read4 = await reader.read();
  assert.deepEqual(
    read4,
    { value: undefined, done: true },
    "fourth read should be done",
  );

  await reader.closed;
});

test("fromAnyIterable: polyfill", async () => {
  const array = ["a", "b"];
  delete (ReadableStream as { from?: unknown }).from;
  await import("../src/polyfill/fromAnyIterable.js");
  assumeAs<
    typeof ReadableStream & {
      from: typeof fromAnyIterable;
    }
  >(ReadableStream);
  const rs = ReadableStream.from(array);
  assert.strictEqual(
    rs.constructor,
    ReadableStream,
    "fromAnyIterable() should return a ReadableStream",
  );

  const reader = rs.getReader();
  assert.deepEqual(
    await reader.read(),
    { value: "a", done: false },
    "first read should be correct",
  );
  assert.deepEqual(
    await reader.read(),
    { value: "b", done: false },
    "second read should be correct",
  );
  assert.deepEqual(
    await reader.read(),
    { value: undefined, done: true },
    "third read should be done",
  );
  await reader.closed;
});
