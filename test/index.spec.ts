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
