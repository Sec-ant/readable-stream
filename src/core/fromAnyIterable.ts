/** Create a readable stream from an async iterable or a sync iterable. */
export function fromAnyIterable<R>(
  iterable: AsyncIterable<R>,
): ReadableStream<R>;
export function fromAnyIterable<R>(
  iterable: Iterable<R>,
): ReadableStream<Awaited<R>>;
export function fromAnyIterable<R>(
  iterable: Iterable<R> | AsyncIterable<R>,
): ReadableStream<R | Awaited<R>>;
export function fromAnyIterable<R>(
  iterable: Iterable<R> | AsyncIterable<R>,
): ReadableStream<R | Awaited<R>> {
  const asyncMethod = (iterable as AsyncIterable<R>)[Symbol.asyncIterator];
  const sync = asyncMethod == null;
  const method = sync
    ? (iterable as Iterable<R>)[Symbol.iterator]
    : asyncMethod;
  const iterator: Iterator<R> | AsyncIterator<R> = Reflect.apply(
    method,
    iterable,
    [],
  );
  assertObject(iterator);
  const next = iterator.next;
  let cancelled = false;

  return new ReadableStream<R | Awaited<R>>(
    {
      async pull(controller) {
        const nextResult = Reflect.apply(next, iterator, []) as
          | IteratorResult<R>
          | PromiseLike<IteratorResult<R>>;
        const result = sync
          ? (nextResult as IteratorResult<R>)
          : await nextResult;
        assertObject(result);
        const done = Boolean(result.done);
        let value: R | Awaited<R> | undefined;
        if (sync) {
          // Async-from-sync iterators unwrap values even on completion.
          const syncValue = result.value;
          try {
            value = await syncValue;
          } catch (error) {
            if (!done) {
              // IteratorClose preserves the original rejection if cleanup fails.
              try {
                const returnMethod = iterator.return;
                if (returnMethod != null) {
                  Reflect.apply(returnMethod, iterator, []);
                }
              } catch {
                /* Preserve the yielded value's rejection. */
              }
            }
            throw error;
          }
        } else if (!done) {
          value = result.value;
        }
        if (cancelled) {
          return;
        }
        if (done) {
          controller.close();
        } else {
          controller.enqueue(value as R | Awaited<R>);
        }
      },
      async cancel(reason) {
        cancelled = true;
        const returnMethod = iterator.return;
        if (returnMethod == null) {
          return;
        }
        const returnResult = Reflect.apply(returnMethod, iterator, [reason]) as
          | IteratorResult<R>
          | PromiseLike<IteratorResult<R>>;
        const result = sync
          ? (returnResult as IteratorResult<R>)
          : await returnResult;
        assertObject(result);
        if (sync) {
          // Read done before value, as AsyncFromSyncIteratorContinuation does.
          Boolean(result.done);
          await result.value;
        }
      },
    },
    { highWaterMark: 0 },
  );
}

function assertObject(value: unknown): asserts value is object {
  if (
    value === null ||
    (typeof value !== "object" && typeof value !== "function")
  ) {
    throw new TypeError("Iterator methods must return an object.");
  }
}
