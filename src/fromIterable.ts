/**
 * Create a new readable stream from an async iterable or a sync iterable
 * @param iterable
 * @returns a readable stream
 */
export function fromIterable<R>(
  iterable: Iterable<R> | AsyncIterable<R>
): ReadableStream<R> {
  const asyncIterator = getAsyncIterator(iterable);
  return new ReadableStream<R>(
    {
      async pull(controller) {
        const { value, done } = await asyncIterator.next();
        if (done) {
          controller.close();
        } else {
          controller.enqueue(value);
        }
      },
      async cancel(reason) {
        if (typeof asyncIterator.return === "function") {
          await asyncIterator.return(reason);
        }
      },
    },
    new CountQueuingStrategy({
      highWaterMark: 0,
    })
  );
}

/**
 * Get the async iterator from an async iterable or a sync iterable
 * @param iterable
 * @returns async iterator
 */
function getAsyncIterator<T>(iterable: AsyncIterable<T> | Iterable<T>) {
  let asyncIteratorMethod = (iterable as AsyncIterable<T>)[
    Symbol.asyncIterator
  ]?.bind(iterable);
  if (asyncIteratorMethod === undefined) {
    const syncIterator = (iterable as Iterable<T>)[Symbol.iterator]();
    const syncIterable = {
      [Symbol.iterator]: () => syncIterator,
    };
    asyncIteratorMethod = async function* () {
      return yield* syncIterable;
    };
  }
  const asyncIterator = asyncIteratorMethod();
  return asyncIterator;
}
