/// <reference types=".."/>

import { setup } from "vite-test-utils";
import { test, assert } from "vitest";

await setup({
  mode: "dev",
  browser: true,
  browserOptions: {
    type: "chromium",
  },
});

function step_timeout(
  func: (...params: unknown[]) => unknown,
  timeout: number,
  ...args: unknown[]
) {
  return setTimeout(() => {
    func.apply(this, args);
  }, timeout);
}

const delay = (ms: number) =>
  new Promise((resolve) => step_timeout(resolve, ms));

const flushAsyncEvents = () =>
  delay(0)
    .then(() => delay(0))
    .then(() => delay(0))
    .then(() => delay(0));

const recordingReadableStream = <R>(
  extras: UnderlyingDefaultSource<R> = {},
  strategy: CountQueuingStrategy
) => {
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
};

function assertIterResult<R>(
  iterResult: IteratorResult<R, unknown>,
  value: R,
  done: boolean,
  message?: string
) {
  const prefix = message === undefined ? "" : `${message} `;
  assert.equal(typeof iterResult, "object", `${prefix}type is object`);
  assert.equal(
    Object.getPrototypeOf(iterResult),
    Object.prototype,
    `${prefix}[[Prototype]]`
  );
  assert.deepEqual(
    Object.getOwnPropertyNames(iterResult).sort(),
    ["done", "value"],
    `${prefix}property names`
  );
  assert.equal(iterResult.value, value, `${prefix}value`);
  assert.equal(iterResult.done, done, `${prefix}done`);
}

test("Async iterator instances should have the correct list of properties", async () => {
  const s = new ReadableStream();
  const it = s.values();
  const proto = Object.getPrototypeOf(it);

  const AsyncIteratorPrototype = Object.getPrototypeOf(
    Object.getPrototypeOf(async function* () {
      /* void */
    }).prototype
  );
  assert.equal(
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
    assert.equal(typeof it[m], "function", "method should be a function");
    assert.equal(it[m].name, m, "method should have the correct name");
  }

  assert.equal(it.next.length, 0, "next should have no parameters");
  assert.equal(it.return?.length, 1, "return should have 1 parameter");
  assert.equal(typeof it.throw, "undefined", "throw should not exist");
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
    assert.equal(e, "e");
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
