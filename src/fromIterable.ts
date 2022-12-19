export function fromIterable<T>(
  iterable: Iterable<T> | AsyncIterable<T>
): ReadableStream<T> {
  const asyncIterator: AsyncIterator<T> = getAsyncIterator(iterable);
  return new ReadableStream(
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
        if (typeof asyncIterator.return == "function") {
          await asyncIterator.return(reason);
        }
      },
    },
    new CountQueuingStrategy({
      highWaterMark: 0,
    })
  );
}

function getAsyncIterator<T>(obj: AsyncIterable<T> | Iterable<T>) {
  let asyncIteratorMethod = (obj as AsyncIterable<T>)[
    Symbol.asyncIterator
  ]?.bind(obj);
  if (asyncIteratorMethod === undefined) {
    const syncIterator = (obj as Iterable<T>)[Symbol.iterator]();
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
