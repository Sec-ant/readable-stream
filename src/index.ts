declare global {
  interface ReadableStreamIteratorOptions {
    preventCancel?: boolean;
  }
  interface ReadableStream<R> {
    [Symbol.asyncIterator](): AsyncIterableIterator<R>;
    values(options?: ReadableStreamIteratorOptions): AsyncIterableIterator<R>;
  }
}

ReadableStream.prototype.values = ReadableStream.prototype[
  Symbol.asyncIterator
] = function (
  this: ReadableStream,
  { preventCancel = false }: ReadableStreamIteratorOptions = {
    preventCancel: false,
  }
) {
  const reader = this.getReader();
  let isReleased = false;
  let isFinished = false;
  let ongoingPromise: Promise<ReadableStreamReadResult<unknown>> | undefined =
    undefined;
  return {
    next() {
      return (ongoingPromise =
        ongoingPromise?.finally(nextSteps) || nextSteps());
    },
    async return(value: unknown) {
      await ongoingPromise;
      if (!preventCancel) {
        await reader.cancel();
      }
      reader.releaseLock();
      // not conform to the spec?: https://streams.spec.whatwg.org/#rs-asynciterator-prototype-return
      return {
        done: true,
        value,
      };
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
  async function nextSteps() {
    if (isFinished) {
      return {
        done: true,
        value: undefined,
      };
    }
    if (isReleased) {
      throw new TypeError("Cannot iterate a stream using a released reader");
    }
    let readResult: ReadableStreamReadResult<unknown>;
    try {
      readResult = await reader.read();
    } catch (e) {
      ongoingPromise = undefined;
      isFinished = true;
      reader.releaseLock();
      isReleased = true;
      throw e;
    }
    if (readResult.done) {
      ongoingPromise = undefined;
      isFinished = true;
      reader.releaseLock();
      isReleased = true;
    }
    return readResult;
  }
};

ReadableStream.prototype[Symbol.asyncIterator] ??=
  ReadableStream.prototype.values;

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
