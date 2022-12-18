declare global {
  interface ReadableStreamIteratorOptions {
    preventCancel?: boolean;
  }
  interface ReadableStream<R> {
    [Symbol.asyncIterator](): AsyncIterableIterator<R>;
    values(options?: ReadableStreamIteratorOptions): AsyncIterableIterator<R>;
  }
}

ReadableStream.prototype.values ??= ReadableStream.prototype[
  Symbol.asyncIterator
] ??= function <R, TReturn = unknown>(
  this: ReadableStream<R>,
  { preventCancel = false }: ReadableStreamIteratorOptions = {
    preventCancel: false,
  }
) {
  const reader = this.getReader();
  let isFinished = false;
  let ongoingPromise:
    | Promise<
        ReadableStreamReadResult<R> | ReadableStreamReadDoneResult<TReturn>
      >
    | undefined = undefined;
  return {
    next() {
      ongoingPromise = ongoingPromise
        ? ongoingPromise.then(nextSteps, nextSteps)
        : nextSteps();
      return ongoingPromise;
    },
    return(value?: TReturn) {
      const localReturnSteps = () => returnSteps(value);
      return ongoingPromise
        ? ongoingPromise.then(localReturnSteps, localReturnSteps)
        : localReturnSteps();
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  } as AsyncIterableIterator<R>;
  async function nextSteps(): Promise<ReadableStreamReadResult<R>> {
    if (isFinished) {
      return {
        done: true,
        value: undefined,
      };
    }
    let readResult: ReadableStreamReadResult<R>;
    try {
      readResult = await reader.read();
    } catch (e) {
      ongoingPromise = undefined;
      isFinished = true;
      reader.releaseLock();
      throw e;
    }
    if (readResult.done) {
      ongoingPromise = undefined;
      isFinished = true;
      reader.releaseLock();
    }
    return readResult;
  }
  async function returnSteps(
    value?: TReturn
  ): Promise<ReadableStreamReadDoneResult<TReturn>> {
    if (isFinished) {
      return {
        done: true,
        value,
      };
    }
    isFinished = true;
    if (!preventCancel) {
      const result = reader.cancel(value);
      reader.releaseLock();
      await result;
      return {
        done: true,
        value,
      };
    }
    reader.releaseLock();
    return {
      done: true,
      value,
    };
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
