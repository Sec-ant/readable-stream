import { AsyncIterablePrototype } from "./asyncIterablePrototype.js";

declare global {
  interface AsyncIteratorObject<T, TReturn = unknown, TNext = unknown>
    extends AsyncIterator<T, TReturn, TNext> {
    [Symbol.asyncIterator](): AsyncIteratorObject<T, TReturn, TNext>;
  }

  interface ReadableStreamAsyncIterator<T>
    extends AsyncIteratorObject<T, undefined, unknown> {
    [Symbol.asyncIterator](): ReadableStreamAsyncIterator<T>;
  }
}

class ReadableStreamAsyncIterableIteratorImpl<R>
  implements AsyncIterator<R, unknown>
{
  #reader: ReadableStreamDefaultReader<R>;
  #preventCancel: boolean;
  #isFinished = false;
  #ongoingPromise: Promise<unknown> | undefined;
  #pendingOperations = 0;
  constructor(reader: ReadableStreamDefaultReader<R>, preventCancel: boolean) {
    this.#reader = reader;
    this.#preventCancel = preventCancel;
  }
  next() {
    return this.#enqueue(this.#nextSteps) as Promise<
      IteratorResult<R, undefined>
    >;
  }
  return(value?: unknown) {
    return this.#enqueue(() => this.#returnSteps(value));
  }
  #enqueue<T>(steps: () => Promise<T>): Promise<T> {
    this.#pendingOperations++;
    const promise = this.#ongoingPromise
      ? this.#ongoingPromise.then(steps, steps)
      : steps();
    // Finished iterators and preventCancel returns can finish synchronously.
    if (this.#pendingOperations > 0) {
      this.#ongoingPromise = promise;
    }
    return promise;
  }
  #finishOperation() {
    if (--this.#pendingOperations === 0) {
      this.#ongoingPromise = undefined;
    }
  }
  #onRead = (result: ReadableStreamReadResult<R>) => {
    if (result.done) {
      this.#isFinished = true;
      this.#reader.releaseLock();
    }
    this.#finishOperation();
    return result;
  };
  #onError = (error: unknown): never => {
    this.#isFinished = true;
    this.#reader.releaseLock();
    this.#finishOperation();
    throw error;
  };
  #nextSteps = (): Promise<ReadableStreamReadResult<R>> => {
    if (this.#isFinished) {
      this.#finishOperation();
      return Promise.resolve({ done: true, value: undefined });
    }
    return this.#reader.read().then(this.#onRead, this.#onError);
  };
  async #returnSteps(
    value?: unknown,
  ): Promise<ReadableStreamReadDoneResult<unknown>> {
    if (!this.#isFinished) {
      this.#isFinished = true;
      const result = this.#preventCancel
        ? undefined
        : this.#reader.cancel(value);
      this.#reader.releaseLock();
      if (result) {
        try {
          await result;
        } catch (error) {
          this.#finishOperation();
          throw error;
        }
      }
    }
    this.#finishOperation();
    return { done: true, value };
  }
}

const implementations = new WeakMap<
  object,
  ReadableStreamAsyncIterableIteratorImpl<unknown>
>();

function invalidIterator() {
  return Promise.reject(
    new TypeError("Invalid ReadableStream async iterator."),
  );
}

const readableStreamAsyncIterableIteratorPrototype: ReadableStreamAsyncIterator<unknown> =
  Object.assign(Object.create(AsyncIterablePrototype), {
    next(this: ReadableStreamAsyncIterator<unknown>) {
      return implementations.get(this)?.next() ?? invalidIterator();
    },
    return(this: ReadableStreamAsyncIterator<unknown>, value?: unknown) {
      return implementations.get(this)?.return(value) ?? invalidIterator();
    },
  });

export interface ReadableStreamIteratorOptions {
  preventCancel?: boolean;
}

/**
 * Get an async iterable iterator from a readable stream.
 * @param readableStream
 * @param readableStreamIteratorOptions
 * @returns
 */
export function asyncIterator<R>(
  readableStream: ReadableStream<R>,
  options: ReadableStreamIteratorOptions | null = {},
): ReadableStreamAsyncIterator<R> {
  if (
    options !== null &&
    typeof options !== "object" &&
    typeof options !== "function"
  ) {
    throw new TypeError("Iterator options must be an object.");
  }
  const preventCancel = Boolean(options?.preventCancel);
  const reader = readableStream.getReader();
  const implement = new ReadableStreamAsyncIterableIteratorImpl<R>(
    reader,
    preventCancel,
  );
  const readableStreamAsyncIterableIterator: ReadableStreamAsyncIterator<R> =
    Object.create(readableStreamAsyncIterableIteratorPrototype);
  implementations.set(
    readableStreamAsyncIterableIterator,
    implement as ReadableStreamAsyncIterableIteratorImpl<unknown>,
  );
  return readableStreamAsyncIterableIterator;
}
