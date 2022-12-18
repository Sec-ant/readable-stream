export function fromIterable<R = unknown>(
  iterable: Iterable<R> | AsyncIterable<R>
) {
  if (iterable instanceof ReadableStream) {
    return iterable;
  }
  let iterator: AsyncIterator<R, undefined> | Iterator<R, undefined>;
  return new ReadableStream<R>({
    start() {
      if (isIterable(iterable)) {
        iterator = iterable[Symbol.iterator]();
      } else if (isAsyncIterable(iterable)) {
        iterator = iterable[Symbol.asyncIterator]();
      } else {
        throw new Error("Not an iterable: " + iterable);
      }
    },
    async pull(controller: ReadableStreamDefaultController<R>) {
      const { value, done } = await iterator.next();
      if (done) {
        controller.close();
        return;
      }
      controller.enqueue(value);
    },
    cancel(reason) {
      iterator.return && iterator.return(reason);
    },
  });
}

function isIterable<R = unknown>(
  iterable: Iterable<R> | AsyncIterable<R>
): iterable is Iterable<R> {
  return Symbol.iterator in iterable;
}

function isAsyncIterable<R = unknown>(
  iterable: Iterable<R> | AsyncIterable<R>
): iterable is AsyncIterable<R> {
  return Symbol.asyncIterator in iterable;
}
