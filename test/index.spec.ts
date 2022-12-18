/**
 * The following tests are copied from
 * https://github.com/MattiasBuelens/wpt/blob/c894f0086c99ab5efc37691ac60f33a2b37c2e7c/streams/readable-streams/async-iterator.any.js
 * and rewritten for Vitest
 */

import { test, assert } from "vitest";

// remove possibly already implemented polyfills or apis
delete (ReadableStream.prototype as Partial<ReadableStream>).values;
delete (ReadableStream.prototype as Partial<ReadableStream>)[
  Symbol.asyncIterator
];

// import this polyfill
await import("../src/index");

const error1 = new Error("error1");

test.skip("Async iterator instances should have the correct list of properties", async () => {
  const s = new ReadableStream();
  const it = s.values();
  const proto = Object.getPrototypeOf(it);

  const AsyncIteratorPrototype = Object.getPrototypeOf(
    Object.getPrototypeOf(async function* () {
      /* void */
    }).prototype
  );
  assert.strictEqual(
    Object.getPrototypeOf(proto),
    AsyncIteratorPrototype,
    "prototype should extend AsyncIteratorPrototype"
  );
  const methods = ["next", "return"].sort();
  assert.deepEqual(
    Object.getOwnPropertyNames(proto).sort(),
    methods,
    "should have all the correct methods"
  );

  for (const m of methods) {
    const propDesc = Object.getOwnPropertyDescriptor(
      proto,
      m
    ) as PropertyDescriptor;
    assert.isTrue(propDesc.enumerable, "method should be enumerable");
    assert.isTrue(propDesc.configurable, "method should be configurable");
    assert.isTrue(propDesc.writable, "method should be writable");
    assert.strictEqual(typeof it[m], "function", "method should be a function");
    assert.strictEqual(it[m].name, m, "method should have the correct name");
  }

  assert.strictEqual(it.next.length, 0, "next should have no parameters");
  assert.strictEqual(it.return?.length, 1, "return should have 1 parameter");
  assert.strictEqual(typeof it.throw, "undefined", "throw should not exist");
});

test("Async-iterating a push source", async () => {
  const s = new ReadableStream({
    start(c) {
      c.enqueue(1);
      c.enqueue(2);
      c.enqueue(3);
      c.close();
    },
  });

  const chunks: unknown[] = [];
  for await (const chunk of s) {
    chunks.push(chunk);
  }
  assert.deepEqual(chunks, [1, 2, 3]);
});

test("Async-iterating a pull source", async () => {
  let i = 1;
  const s = new ReadableStream({
    pull(c) {
      c.enqueue(i);
      if (i >= 3) {
        c.close();
      }
      i += 1;
    },
  });

  const chunks: unknown[] = [];
  for await (const chunk of s) {
    chunks.push(chunk);
  }
  assert.deepEqual(chunks, [1, 2, 3]);
});

test("Async-iterating a push source with undefined values", async () => {
  const s = new ReadableStream({
    start(c) {
      c.enqueue(undefined);
      c.enqueue(undefined);
      c.enqueue(undefined);
      c.close();
    },
  });

  const chunks: unknown[] = [];
  for await (const chunk of s) {
    chunks.push(chunk);
  }
  assert.deepEqual(chunks, [undefined, undefined, undefined]);
});

test("Async-iterating a pull source with undefined values", async () => {
  let i = 1;
  const s = new ReadableStream({
    pull(c) {
      c.enqueue(undefined);
      if (i >= 3) {
        c.close();
      }
      i += 1;
    },
  });

  const chunks: unknown[] = [];
  for await (const chunk of s) {
    chunks.push(chunk);
  }
  assert.deepEqual(chunks, [undefined, undefined, undefined]);
});

test("Async-iterating a pull source manually", async () => {
  let i = 1;
  const s = recordingReadableStream(
    {
      pull(c) {
        c.enqueue(i);
        if (i >= 3) {
          c.close();
        }
        i += 1;
      },
    },
    new CountQueuingStrategy({ highWaterMark: 0 })
  );

  const it = s.values();
  assert.deepEqual(s.events, []);

  const read1 = await it.next();
  assertIterResult(read1, 1, false);
  assert.deepEqual(s.events, ["pull"]);

  const read2 = await it.next();
  assertIterResult(read2, 2, false);
  assert.deepEqual(s.events, ["pull", "pull"]);

  const read3 = await it.next();
  assertIterResult(read3, 3, false);
  assert.deepEqual(s.events, ["pull", "pull", "pull"]);

  const read4 = await it.next();
  assertIterResult(read4, undefined, true);
  assert.deepEqual(s.events, ["pull", "pull", "pull"]);
});

test("Async-iterating an errored stream throws", async () => {
  const s = new ReadableStream({
    start(c) {
      c.error("e");
    },
  });
  let reached = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of s) {
      /* empty */
    }
    reached = true;
  } catch (e) {
    assert.isFalse(reached);
    assert.strictEqual(e, "e");
  }
});

test("Async-iterating a closed stream never executes the loop body, but works fine", async () => {
  const s = new ReadableStream({
    start(c) {
      c.close();
    },
  });

  let reached = false;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for await (const _ of s) {
    reached = true;
  }

  assert.isFalse(reached);
});

test("Async-iterating an empty but not closed/errored stream never executes the loop body and stalls the async function", async () => {
  const s = new ReadableStream();
  let reached1 = false;
  let reached2 = false;

  const loop = async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of s) {
      reached1 = true;
    }
    reached2 = true;
  };

  await Promise.race([loop(), flushAsyncEvents()]);

  assert.isFalse(reached1);
  assert.isFalse(reached2);
});

test("Async-iterating a partially consumed stream", async () => {
  const s = new ReadableStream({
    start(c) {
      c.enqueue(1);
      c.enqueue(2);
      c.enqueue(3);
      c.close();
    },
  });

  const reader = s.getReader();
  const readResult = (await reader.read()) as IteratorResult<unknown, unknown>;
  assertIterResult(readResult, 1, false);
  reader.releaseLock();

  const chunks: unknown[] = [];
  for await (const chunk of s) {
    chunks.push(chunk);
  }
  assert.deepEqual(chunks, [2, 3]);
});

for (const type of ["throw", "break", "return"]) {
  for (const preventCancel of [false, true]) {
    test(`Cancellation behavior when ${type}ing inside loop body; preventCancel = ${preventCancel}`, async () => {
      const s = recordingReadableStream({
        start(c) {
          c.enqueue(0);
        },
      });

      // use a separate function for the loop body so return does not stop the test
      const loop = async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _ of s.values({ preventCancel })) {
          if (type === "throw") {
            throw new Error();
          } else if (type === "break") {
            break;
          } else if (type === "return") {
            return;
          }
        }
      };

      try {
        await loop();
      } catch (e) {
        /* empty */
      }

      if (preventCancel) {
        assert.deepEqual(s.events, ["pull"], "cancel() should not be called");
      } else {
        assert.deepEqual(
          s.events,
          ["pull", "cancel", undefined],
          "cancel() should be called"
        );
      }
    });
  }
}

for (const preventCancel of [false, true]) {
  test(`Cancellation behavior when manually calling return(); preventCancel = ${preventCancel}`, async () => {
    const s = recordingReadableStream({
      start(c) {
        c.enqueue(0);
      },
    });

    const it = s.values({ preventCancel });
    await it.return?.();

    if (preventCancel) {
      assert.deepEqual(s.events, [], "cancel() should not be called");
    } else {
      assert.deepEqual(
        s.events,
        ["cancel", undefined],
        "cancel() should be called"
      );
    }
  });
}

test("next() rejects if the stream errors", async () => {
  let timesPulled = 0;
  const s = new ReadableStream({
    pull(c) {
      if (timesPulled === 0) {
        c.enqueue(0);
        ++timesPulled;
      } else {
        c.error(error1);
      }
    },
  });

  const it = s[Symbol.asyncIterator]();

  const iterResult1 = await it.next();
  assertIterResult(iterResult1, 0, false, "1st next()");

  let reached = false;
  try {
    await it.next();
    reached = true;
  } catch (e) {
    assert.strictEqual(error1, e, "2nd next()");
  }
  assert.isFalse(reached);
});

test("return() does not rejects if the stream has not errored yet", async () => {
  let timesPulled = 0;
  const s = new ReadableStream({
    pull(c) {
      if (timesPulled === 0) {
        c.enqueue(0);
        ++timesPulled;
      } else {
        c.error(error1);
      }
    },
  });

  const it = s[Symbol.asyncIterator]();

  const iterResult = (await it.return?.("return value")) as IteratorResult<
    unknown,
    unknown
  >;
  assertIterResult(iterResult, "return value", true);
});

test("return() rejects if the stream has errored", async () => {
  const s = new ReadableStream({
    pull(c) {
      // Do not error in start() because doing so would prevent acquiring a reader/async iterator.
      c.error(error1);
    },
  });

  const it = s[Symbol.asyncIterator]();

  await flushAsyncEvents();
  let reached = false;
  try {
    await it.return?.("return value");
    reached = true;
  } catch (e) {
    assert.strictEqual(e, error1);
  }
  assert.isFalse(reached);
});

test("next() that succeeds; next() that reports an error; next()", async () => {
  let timesPulled = 0;
  const s = new ReadableStream({
    pull(c) {
      if (timesPulled === 0) {
        c.enqueue(0);
        ++timesPulled;
      } else {
        c.error(error1);
      }
    },
  });

  const it = s[Symbol.asyncIterator]();

  const iterResult1 = await it.next();
  assertIterResult(iterResult1, 0, false, "1st next()");

  let reached = false;
  try {
    await it.next();
    reached = true;
  } catch (e) {
    assert.strictEqual(e, error1, "2nd next()");
  }
  assert.isFalse(reached);

  const iterResult3 = await it.next();
  assertIterResult(iterResult3, undefined, true, "3rd next()");
});

test("next() that succeeds; next() that reports an error; next() [no awaiting]", async () => {
  let timesPulled = 0;
  const s = new ReadableStream({
    pull(c) {
      if (timesPulled === 0) {
        c.enqueue(0);
        ++timesPulled;
      } else {
        c.error(error1);
      }
    },
  });

  const it = s[Symbol.asyncIterator]();

  const iterResults = await Promise.allSettled([
    it.next(),
    it.next(),
    it.next(),
  ]);

  assert.strictEqual(
    iterResults[0].status,
    "fulfilled",
    "1st next() promise status"
  );
  assertIterResult(
    (iterResults[0] as PromiseFulfilledResult<IteratorResult<unknown, unknown>>)
      .value,
    0,
    false,
    "1st next()"
  );

  assert.strictEqual(
    iterResults[1].status,
    "rejected",
    "2nd next() promise status"
  );
  assert.strictEqual(
    (iterResults[1] as PromiseRejectedResult).reason,
    error1,
    "2nd next() rejection reason"
  );

  assert.strictEqual(
    iterResults[2].status,
    "fulfilled",
    "3rd next() promise status"
  );
  assertIterResult(
    (iterResults[2] as PromiseFulfilledResult<IteratorResult<unknown, unknown>>)
      .value,
    undefined,
    true,
    "3rd next()"
  );
});

test("next() that succeeds; next() that reports an error; return()", async () => {
  let timesPulled = 0;
  const s = new ReadableStream({
    pull(c) {
      if (timesPulled === 0) {
        c.enqueue(0);
        ++timesPulled;
      } else {
        c.error(error1);
      }
    },
  });

  const it = s[Symbol.asyncIterator]();

  const iterResult1 = await it.next();
  assertIterResult(iterResult1, 0, false, "1st next()");

  let reached = false;
  try {
    await it.next();
    reached = true;
  } catch (e) {
    assert.strictEqual(e, error1, "2nd next()");
  }
  assert.isFalse(reached);

  const iterResult3 = (await it.return?.("return value")) as IteratorResult<
    unknown,
    unknown
  >;
  assertIterResult(iterResult3, "return value", true, "return()");
});

test("next() that succeeds; next() that reports an error; return() [no awaiting]", async () => {
  let timesPulled = 0;
  const s = new ReadableStream({
    pull(c) {
      if (timesPulled === 0) {
        c.enqueue(0);
        ++timesPulled;
      } else {
        c.error(error1);
      }
    },
  });

  const it = s[Symbol.asyncIterator]();

  const iterResults = await Promise.allSettled([
    it.next(),
    it.next(),
    it.return?.("return value"),
  ]);

  assert.strictEqual(
    iterResults[0].status,
    "fulfilled",
    "1st next() promise status"
  );
  assertIterResult(
    (iterResults[0] as PromiseFulfilledResult<IteratorResult<unknown, unknown>>)
      .value,
    0,
    false,
    "1st next()"
  );

  assert.strictEqual(
    iterResults[1].status,
    "rejected",
    "2nd next() promise status"
  );
  assert.strictEqual(
    (iterResults[1] as PromiseRejectedResult).reason,
    error1,
    "2nd next() rejection reason"
  );

  assert.strictEqual(
    iterResults[2].status,
    "fulfilled",
    "return() promise status"
  );
  assertIterResult(
    (iterResults[2] as PromiseFulfilledResult<IteratorResult<unknown, unknown>>)
      .value,
    "return value",
    true,
    "return()"
  );
});

test("next() that succeeds; return()", async () => {
  let timesPulled = 0;
  const s = new ReadableStream({
    pull(c) {
      c.enqueue(timesPulled);
      ++timesPulled;
    },
  });
  const it = s[Symbol.asyncIterator]();

  const iterResult1 = await it.next();
  assertIterResult(iterResult1, 0, false, "next()");

  const iterResult2 = (await it.return?.("return value")) as IteratorResult<
    unknown,
    unknown
  >;
  assertIterResult(iterResult2, "return value", true, "return()");

  assert.strictEqual(timesPulled, 2);
});

test("next() that succeeds; return() [no awaiting]", async () => {
  let timesPulled = 0;
  const s = new ReadableStream({
    pull(c) {
      c.enqueue(timesPulled);
      ++timesPulled;
    },
  });
  const it = s[Symbol.asyncIterator]();

  const iterResults = await Promise.allSettled([
    it.next(),
    it.return?.("return value"),
  ]);

  assert.strictEqual(
    iterResults[0].status,
    "fulfilled",
    "next() promise status"
  );
  assertIterResult(
    (iterResults[0] as PromiseFulfilledResult<IteratorResult<unknown, unknown>>)
      .value,
    0,
    false,
    "next()"
  );

  assert.strictEqual(
    iterResults[1].status,
    "fulfilled",
    "return() promise status"
  );
  assertIterResult(
    (iterResults[1] as PromiseFulfilledResult<IteratorResult<unknown, unknown>>)
      .value,
    "return value",
    true,
    "return()"
  );

  assert.strictEqual(timesPulled, 2);
});

test("return(); next()", async () => {
  const rs = new ReadableStream();
  const it = rs.values();

  const iterResult1 = (await it.return?.("return value")) as IteratorResult<
    unknown,
    unknown
  >;
  assertIterResult(iterResult1, "return value", true, "return()");

  const iterResult2 = await it.next();
  assertIterResult(iterResult2, undefined, true, "next()");
});

test("return(); next() [no awaiting]", async () => {
  const rs = new ReadableStream();
  const it = rs.values();

  const iterResults = await Promise.allSettled([
    it.return?.("return value"),
    it.next(),
  ]);

  assert.strictEqual(
    iterResults[0].status,
    "fulfilled",
    "return() promise status"
  );
  assertIterResult(
    (iterResults[0] as PromiseFulfilledResult<IteratorResult<unknown, unknown>>)
      .value,
    "return value",
    true,
    "return()"
  );

  assert.strictEqual(
    iterResults[1].status,
    "fulfilled",
    "next() promise status"
  );
  assertIterResult(
    (iterResults[1] as PromiseFulfilledResult<IteratorResult<unknown, unknown>>)
      .value,
    undefined,
    true,
    "next()"
  );
});

test("return(); return()", async () => {
  const rs = new ReadableStream();
  const it = rs.values();

  const iterResult1 = (await it.return?.("return value 1")) as IteratorResult<
    unknown,
    unknown
  >;
  assertIterResult(iterResult1, "return value 1", true, "1st return()");

  const iterResult2 = (await it.return?.("return value 2")) as IteratorResult<
    unknown,
    unknown
  >;
  assertIterResult(iterResult2, "return value 2", true, "1st return()");
});

test("return(); return() [no awaiting]", async () => {
  const rs = new ReadableStream();
  const it = rs.values();

  const iterResults = await Promise.allSettled([
    it.return?.("return value 1"),
    it.return?.("return value 2"),
  ]);

  assert.strictEqual(
    iterResults[0].status,
    "fulfilled",
    "1st return() promise status"
  );
  assertIterResult(
    (iterResults[0] as PromiseFulfilledResult<IteratorResult<unknown, unknown>>)
      .value,
    "return value 1",
    true,
    "1st return()"
  );

  assert.strictEqual(
    iterResults[1].status,
    "fulfilled",
    "2nd return() promise status"
  );
  assertIterResult(
    (iterResults[1] as PromiseFulfilledResult<IteratorResult<unknown, unknown>>)
      .value,
    "return value 2",
    true,
    "1st return()"
  );
});

test("values() throws if there's already a lock", () => {
  const s = new ReadableStream({
    start(c) {
      c.enqueue(0);
      c.close();
    },
  });
  s.values();
  assert.throw(() => s.values(), TypeError, undefined, "values() should throw");
});

test("Acquiring a reader after exhaustively async-iterating a stream", async () => {
  const s = new ReadableStream({
    start(c) {
      c.enqueue(1);
      c.enqueue(2);
      c.enqueue(3);
      c.close();
    },
  });

  const chunks: unknown[] = [];
  for await (const chunk of s) {
    chunks.push(chunk);
  }
  assert.deepEqual(chunks, [1, 2, 3]);

  const reader = s.getReader();
  await reader.closed;
});

test("Acquiring a reader after returning from a stream that errors", async () => {
  let timesPulled = 0;
  const s = new ReadableStream({
    pull(c) {
      if (timesPulled === 0) {
        c.enqueue(0);
        ++timesPulled;
      } else {
        c.error(error1);
      }
    },
  });

  const it = s.values({ preventCancel: true });

  const iterResult1 = await it.next();
  assertIterResult(iterResult1, 0, false, "1st next()");

  let reached1 = false;
  try {
    await it.next();
    reached1 = true;
  } catch (e) {
    assert.strictEqual(e, error1, "2nd next()");
  }
  assert.isFalse(reached1);

  const iterResult2 = (await it.return?.("return value")) as IteratorResult<
    unknown,
    unknown
  >;
  assertIterResult(iterResult2, "return value", true, "return()");

  // i.e. it should not reject with a generic "this stream is locked" TypeError.
  const reader = s.getReader();
  let reached2 = false;
  try {
    await reader.closed;
    reached2 = true;
  } catch (e) {
    assert.strictEqual(
      e,
      error1,
      "closed on the new reader should reject with the error"
    );
  }
  assert.isFalse(reached2);
});

test("Acquiring a reader after partially async-iterating a stream", async () => {
  const s = new ReadableStream({
    start(c) {
      c.enqueue(1);
      c.enqueue(2);
      c.enqueue(3);
      c.close();
    },
  });

  // read the first two chunks, then cancel
  const chunks: unknown[] = [];
  for await (const chunk of s) {
    chunks.push(chunk);
    if (chunk >= 2) {
      break;
    }
  }
  assert.deepEqual(chunks, [1, 2]);

  const reader = s.getReader();
  await reader.closed;
});

test("Acquiring a reader and reading the remaining chunks after partially async-iterating a stream with preventCancel = true", async () => {
  const s = new ReadableStream({
    start(c) {
      c.enqueue(1);
      c.enqueue(2);
      c.enqueue(3);
      c.close();
    },
  });

  // read the first two chunks, then release lock
  const chunks: unknown[] = [];
  for await (const chunk of s.values({ preventCancel: true })) {
    chunks.push(chunk);
    if (chunk >= 2) {
      break;
    }
  }
  assert.deepEqual(chunks, [1, 2]);

  const reader = s.getReader();
  const readResult = (await reader.read()) as IteratorResult<unknown, unknown>;
  assertIterResult(readResult, 3, false);
  await reader.closed;
});

for (const preventCancel of [false, true]) {
  test(`return() should unlock the stream synchronously when preventCancel = ${preventCancel}`, () => {
    const rs = new ReadableStream();
    rs.values({ preventCancel }).return?.();
    // The test passes if this line doesn't throw.
    rs.getReader();
  });
}

test("close() while next() is pending", async () => {
  const rs = new ReadableStream({
    async start(c) {
      c.enqueue("a");
      c.enqueue("b");
      c.enqueue("c");
      await flushAsyncEvents();
      // At this point, the async iterator has a read request in the stream's queue for its pending next() promise.
      // Closing the stream now causes two things to happen *synchronously*:
      //  1. ReadableStreamClose resolves reader.[[closedPromise]] with undefined.
      //  2. ReadableStreamClose calls the read request's close steps, which calls ReadableStreamReaderGenericRelease,
      //     which replaces reader.[[closedPromise]] with a rejected promise.
      c.close();
    },
  });

  const chunks: unknown[] = [];
  for await (const chunk of rs) {
    chunks.push(chunk);
  }
  assert.deepEqual(chunks, ["a", "b", "c"]);
});

function stepTimeout<R>(
  func: (...params: R[]) => unknown,
  timeout: number,
  ...args: R[]
) {
  return setTimeout(() => {
    func.apply(this, args);
  }, timeout);
}

function delay(ms: number) {
  return new Promise((resolve) => stepTimeout(resolve, ms));
}

async function flushAsyncEvents() {
  await delay(0);
  await delay(0);
  await delay(0);
  return await delay(0);
}

function recordingReadableStream<R>(
  extras: UnderlyingDefaultSource<R> = {},
  strategy?: CountQueuingStrategy
) {
  interface ExposedRecords {
    events: unknown[];
    eventsWithoutPulls: unknown[];
    controller: ReadableStreamDefaultController<R>;
  }
  let controllerToCopyOver: ReadableStreamDefaultController<R> | undefined;
  const stream: ReadableStream<R> & ExposedRecords = new ReadableStream(
    {
      type: extras.type,
      start(controller) {
        controllerToCopyOver = controller;

        if (extras.start) {
          return extras.start(controller);
        }

        return undefined;
      },
      pull(controller) {
        stream.events.push("pull");

        if (extras.pull) {
          return extras.pull(controller);
        }

        return undefined;
      },
      cancel(reason) {
        stream.events.push("cancel", reason);
        stream.eventsWithoutPulls.push("cancel", reason);

        if (extras.cancel) {
          return extras.cancel(reason);
        }

        return undefined;
      },
    },
    strategy
  ) as ReadableStream<R> & ExposedRecords;

  stream.controller =
    controllerToCopyOver as ReadableStreamDefaultController<R>;
  stream.events = [];
  stream.eventsWithoutPulls = [];

  return stream;
}

function assertIterResult<R>(
  iterResult: IteratorResult<R, unknown>,
  value: R,
  done: boolean,
  message?: string
) {
  const prefix = message === undefined ? "" : `${message} `;
  assert.strictEqual(typeof iterResult, "object", `${prefix}type is object`);
  assert.strictEqual(
    Object.getPrototypeOf(iterResult),
    Object.prototype,
    `${prefix}[[Prototype]]`
  );
  assert.deepEqual(
    Object.getOwnPropertyNames(iterResult).sort(),
    ["done", "value"],
    `${prefix}property names`
  );
  assert.strictEqual(iterResult.value, value, `${prefix}value`);
  assert.strictEqual(iterResult.done, done, `${prefix}done`);
}
