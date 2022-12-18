/* eslint-disable indent */
declare global {
  interface ReadableStreamIteratorOptions {
    preventCancel?: boolean;
  }
  interface ReadableStream<R> {
    [Symbol.asyncIterator](): AsyncIterableIterator<R>;
    values(options?: ReadableStreamIteratorOptions): AsyncIterableIterator<R>;
  }
}

/*
class ReadableStreamAsyncIterator<R, TReturn = unknown>
  implements AsyncIterator<R>
{
  #reader: ReadableStreamDefaultReader<R>;
  #isFinished = false;
  #ongoingPromise:
    | Promise<
        ReadableStreamReadResult<R> | ReadableStreamReadDoneResult<TReturn>
      >
    | undefined = undefined;
  #preventCancel: boolean;
  constructor(reader: ReadableStreamDefaultReader<R>, preventCancel = false) {
    this.#reader = reader;
    this.#preventCancel = preventCancel;
  }
  next() {
    this.#ongoingPromise = this.#ongoingPromise
      ? this.#ongoingPromise.then(this.#nextSteps, this.#nextSteps)
      : this.#nextSteps();
    return this.#ongoingPromise as Promise<IteratorResult<R>>;
  }
  return(value?: TReturn) {
    const localReturnSteps = () => this.#returnSteps(value);
    return (
      this.#ongoingPromise
        ? this.#ongoingPromise.then(localReturnSteps, localReturnSteps)
        : localReturnSteps()
    ) as Promise<IteratorReturnResult<TReturn>>;
  }
  async #nextSteps(): Promise<ReadableStreamReadResult<R>> {
    if (this.#isFinished) {
      return {
        done: true,
        value: undefined,
      };
    }
    let readResult: ReadableStreamReadResult<R>;
    try {
      readResult = await this.#reader.read();
    } catch (e) {
      this.#ongoingPromise = undefined;
      this.#isFinished = true;
      this.#reader.releaseLock();
      throw e;
    }
    if (readResult.done) {
      this.#ongoingPromise = undefined;
      this.#isFinished = true;
      this.#reader.releaseLock();
    }
    return readResult;
  }
  async #returnSteps(
    value?: TReturn
  ): Promise<ReadableStreamReadDoneResult<TReturn>> {
    if (this.#isFinished) {
      return {
        done: true,
        value,
      };
    }
    this.#isFinished = true;
    if (!this.#preventCancel) {
      const result = this.#reader.cancel(value);
      this.#reader.releaseLock();
      await result;
      return {
        done: true,
        value,
      };
    }
    this.#reader.releaseLock();
    return {
      done: true,
      value,
    };
  }
}
*/

ReadableStream.prototype.values = ReadableStream.prototype[
  Symbol.asyncIterator
] = function <R, TReturn = unknown>(
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
