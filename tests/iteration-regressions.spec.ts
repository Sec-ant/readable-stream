import { describe, expect, expectTypeOf, test } from "vitest";
import { asyncIterator } from "../src/ponyfill/asyncIterator.js";
import { fromAnyIterable } from "../src/ponyfill/fromAnyIterable.js";
import { flushAsyncEvents } from "./utils.js";

function fromUnknown(value: unknown) {
  return fromAnyIterable(value as AsyncIterable<unknown>);
}

function iterable(iterator: unknown, sync = false) {
  return { [sync ? Symbol.iterator : Symbol.asyncIterator]: () => iterator };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

for (const sync of [false, true]) {
  describe(`${sync ? "sync" : "async"} iterator protocol`, () => {
    test.each([null, undefined, 42, "result"])(
      "rejects a non-object iterator: %s",
      (iterator) => {
        expect(() => fromUnknown(iterable(iterator, sync))).toThrow(TypeError);
      },
    );

    test.each([null, undefined, 42, "result"])(
      "rejects a non-object next result: %s",
      async (result) => {
        const reader = fromUnknown(
          iterable({ next: () => result }, sync),
        ).getReader();
        await Promise.all([
          expect(reader.read()).rejects.toBeInstanceOf(TypeError),
          expect(reader.closed).rejects.toBeInstanceOf(TypeError),
        ]);
      },
    );

    test("captures next once at construction and preserves its receiver", async () => {
      let gets = 0;
      const iterator = {
        get next() {
          gets++;
          return function (this: unknown, ...args: unknown[]) {
            expect(this).toBe(iterator);
            expect(args).toEqual([]);
            return { value: 1, done: false };
          };
        },
      };
      const reader = fromUnknown(iterable(iterator, sync)).getReader();
      expect(gets).toBe(1);
      Object.defineProperty(iterator, "next", {
        value: () => ({ value: 2, done: false }),
      });
      expect(await reader.read()).toEqual({ value: 1, done: false });
      await reader.cancel();
      expect(gets).toBe(1);
    });

    test("reads done before value", async () => {
      const events: string[] = [];
      const reader = fromUnknown(
        iterable(
          {
            next: () => ({
              get done() {
                events.push("done");
                return false;
              },
              get value() {
                events.push("value");
                return 1;
              },
            }),
          },
          sync,
        ),
      ).getReader();
      expect(await reader.read()).toEqual({ done: false, value: 1 });
      await reader.cancel();
      expect(events).toEqual(["done", "value"]);
    });

    test.each([null, 42, "result"])(
      "rejects a non-object return result: %s",
      async (result) => {
        const stream = fromUnknown(
          iterable(
            { next: () => ({ done: true }), return: () => result },
            sync,
          ),
        );
        await expect(stream.cancel()).rejects.toBeInstanceOf(TypeError);
      },
    );

    test("accepts callable iterator results", async () => {
      const result = Object.assign(() => {}, { done: true });
      const stream = fromUnknown(
        iterable({ next: () => result, return: () => result }, sync),
      );
      await expect(stream.getReader().read()).resolves.toEqual({
        done: true,
        value: undefined,
      });
      await expect(
        fromUnknown(
          iterable({ next: () => result, return: () => result }, sync),
        ).cancel(),
      ).resolves.toBeUndefined();
    });

    test("rejects a noncallable return method", async () => {
      const stream = fromUnknown(
        iterable({ next: () => ({ done: true }), return: 42 }, sync),
      );
      await expect(stream.cancel()).rejects.toBeInstanceOf(TypeError);
    });

    test("reads return once and forwards the reason and receiver", async () => {
      let gets = 0;
      const reason = {};
      const iterator = {
        next: () => ({ done: true }),
        get return() {
          gets++;
          return function (this: unknown, ...args: unknown[]) {
            expect(this).toBe(iterator);
            expect(args).toEqual([reason]);
            return { done: true };
          };
        },
      };
      await fromUnknown(iterable(iterator, sync)).cancel(reason);
      expect(gets).toBe(1);
    });

    test("cancellation does not await the cancellation reason", async () => {
      const reason = deferred<void>();
      const stream = fromUnknown(
        iterable({ next: () => ({ done: true }) }, sync),
      );
      let cancelled = false;
      const cancel = stream.cancel(reason.promise).then(() => {
        cancelled = true;
      });
      await flushAsyncEvents();
      const settledBeforeReason = cancelled;
      reason.resolve();
      await cancel;
      expect(settledBeforeReason).toBe(true);
    });
  });
}

test("async iteration ignores the value of a completed result", async () => {
  const stream = fromUnknown(
    iterable({
      next: () => ({
        done: true,
        get value() {
          throw new Error("completed value should not be read");
        },
      }),
    }),
  );
  await expect(stream.getReader().read()).resolves.toEqual({
    done: true,
    value: undefined,
  });
});

test("sync cancellation closes an iterator before its first read", async () => {
  const reasons: unknown[] = [];
  const stream = fromUnknown(
    iterable(
      {
        next: () => ({ done: false, value: 1 }),
        return(reason: unknown) {
          reasons.push(reason);
          return { done: true };
        },
      },
      true,
    ),
  );
  await stream.cancel("stop");
  expect(reasons).toEqual(["stop"]);
});

test("sync cancellation does not wait for a pending iteration value", async () => {
  const value = deferred<number>();
  let returns = 0;
  const reader = fromUnknown(
    iterable(
      {
        next: () => ({ done: false, value: value.promise }),
        return() {
          returns++;
          return { done: true };
        },
      },
      true,
    ),
  ).getReader();
  const read = reader.read();
  await flushAsyncEvents();
  let cancelled = false;
  const cancel = reader.cancel().then(() => {
    cancelled = true;
  });
  await flushAsyncEvents();
  const state = { returns, cancelled };
  value.resolve(1);
  await Promise.all([read, cancel]);
  expect(state).toEqual({ returns: 1, cancelled: true });
});

test("sync cancellation waits for the return result's value", async () => {
  const cleanup = deferred<void>();
  const events: string[] = [];
  const stream = fromUnknown(
    iterable(
      {
        next: () => ({ done: false, value: 1 }),
        return: () => ({
          get done() {
            events.push("done");
            return true;
          },
          get value() {
            events.push("value");
            return cleanup.promise;
          },
        }),
      },
      true,
    ),
  );
  let cancelled = false;
  const cancel = stream.cancel().then(() => {
    cancelled = true;
  });
  await flushAsyncEvents();
  const early = cancelled;
  cleanup.resolve();
  await cancel;
  expect(events).toEqual(["done", "value"]);
  expect(early).toBe(false);
});

test("a rejected sync value closes the iterator and preserves the rejection", async () => {
  const error = new Error("value rejected");
  let returns = 0;
  function* generator() {
    try {
      yield Promise.reject(error);
    } finally {
      returns++;
      // biome-ignore lint/correctness/noUnsafeFinally: exercise a failing cleanup.
      throw new Error("cleanup rejected");
    }
  }
  const reader = fromAnyIterable(generator()).getReader();
  await Promise.all([
    expect(reader.read()).rejects.toBe(error),
    expect(reader.closed).rejects.toBe(error),
  ]);
  expect(returns).toBe(1);
});

test("sync values are unwrapped while async values retain their identity", async () => {
  const value = Promise.resolve(42);
  const syncStream = fromAnyIterable([value]);
  expectTypeOf(syncStream).toEqualTypeOf<ReadableStream<number>>();
  expect(await syncStream.getReader().read()).toEqual({
    done: false,
    value: 42,
  });
  const asyncIterable: AsyncIterable<Promise<number>> = {
    [Symbol.asyncIterator]: () => ({
      next: async () => ({ done: false, value }),
    }),
  };
  const asyncStream = fromAnyIterable(asyncIterable);
  expectTypeOf(asyncStream).toEqualTypeOf<ReadableStream<Promise<number>>>();
  const reader = asyncStream.getReader();
  expect((await reader.read()).value).toBe(value);
  await reader.cancel();
});

for (const following of ["next", "return"] as const) {
  test(`${following} after return waits for cancellation`, async () => {
    const cleanup = deferred<void>();
    const stream = new ReadableStream({ cancel: () => cleanup.promise });
    const iterator = asyncIterator(stream);
    const first = iterator.return?.("first" as unknown as undefined);
    expect(stream.locked).toBe(false);
    let finished = false;
    const second = iterator[following]?.().then(() => {
      finished = true;
    });
    await flushAsyncEvents();
    const early = finished;
    cleanup.resolve();
    await Promise.all([first, second]);
    expect(early).toBe(false);
  });
}

test("queued operations continue after cancellation rejects", async () => {
  const error = new Error("cancel rejected");
  const stream = new ReadableStream({
    cancel() {
      throw error;
    },
  });
  const iterator = asyncIterator(stream);
  const first = expect(iterator.return?.()).rejects.toBe(error);
  const second = iterator.next();
  await first;
  expect(await second).toEqual({ done: true, value: undefined });
  expect(stream.locked).toBe(false);
});

test("null iterator options use the defaults", async () => {
  const stream = new ReadableStream();
  await asyncIterator(stream, null).return?.();
  expect(stream.locked).toBe(false);
});

test("invalid iterator options throw before locking the stream", () => {
  const stream = new ReadableStream();
  expect(() => asyncIterator(stream, 42 as unknown as object)).toThrow(
    TypeError,
  );
  expect(stream.locked).toBe(false);
});

test("a throwing options getter does not lock the stream", () => {
  const stream = new ReadableStream();
  const error = new Error("options rejected");
  expect(() =>
    asyncIterator(stream, {
      get preventCancel(): boolean {
        throw error;
      },
    }),
  ).toThrow(error);
  expect(stream.locked).toBe(false);
});

for (const method of ["next", "return"] as const) {
  test(`${method} rejects invalid receivers without throwing synchronously`, async () => {
    const stream = new ReadableStream();
    const iterator = asyncIterator(stream);
    const operation = iterator[method] as (...args: unknown[]) => unknown;
    expect(() => Reflect.construct(Object, [], operation)).toThrow(TypeError);
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    const receivers = [
      undefined,
      null,
      1,
      "iterator",
      Symbol(),
      {},
      Object.create(iterator),
      new Proxy(iterator, {}),
      revoked.proxy,
    ];
    for (const receiver of receivers) {
      let result: unknown;
      expect(() => {
        result = Reflect.apply(operation, receiver, []);
      }).not.toThrow();
      expect(result).toBeInstanceOf(Promise);
      await expect(result).rejects.toBeInstanceOf(TypeError);
    }
    expect(stream.locked).toBe(true);
    await iterator.return?.();
    expect(stream.locked).toBe(false);
  });
}
