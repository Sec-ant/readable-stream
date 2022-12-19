export function fromIterable<T>(
  iterable: Iterable<T> | AsyncIterable<T>
): ReadableStream<T> {
  const asyncIterator: AsyncIterator<T> = getAsyncIterator(iterable);
  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await asyncIterator.next();
      if (done) {
        controller.close();
      } else {
        controller.enqueue(value);
      }
    },
    async cancel(reason) {
      if (typeof asyncIterator.throw == "function") {
        try {
          await asyncIterator.throw(reason);
        } catch {
          /* `iterator.throw()` always throws on site. We catch it. */
        }
      }
    },
  });
}

function getAsyncIterator<T>(obj: AsyncIterable<T> | Iterable<T>) {
  let asyncIteratorMethod = (obj as AsyncIterable<T>)[
    Symbol.asyncIterator
  ]?.bind(obj);
  if (asyncIteratorMethod === undefined) {
    // TODO can we improve this try?
    (obj as Iterable<T>)[Symbol.iterator]();
    asyncIteratorMethod = async function* () {
      return yield* obj as Iterable<T>;
    };
  }
  const asyncIterator = asyncIteratorMethod();
  /*
  if (typeof asyncIterator !== "object") {
    throw new TypeError(`${typeof asyncIterator} is not an object`);
  }
  */
  return asyncIterator;
}
