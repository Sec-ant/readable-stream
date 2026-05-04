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
  #ongoingPromise: Promise<ReadableStreamReadResult<R>> | undefined = undefined;
  constructor(reader: ReadableStreamDefaultReader<R>, preventCancel: boolean) {
    this.#reader = reader;
    this.#preventCancel = preventCancel;
  }
  next() {
    const nextSteps = () => this.#nextSteps();
    this.#ongoingPromise = this.#ongoingPromise
      ? this.#ongoingPromise.then(nextSteps, nextSteps)
      : nextSteps();
    return this.#ongoingPromise as Promise<IteratorResult<R, undefined>>;
  }
  return(value?: unknown) {
    const returnSteps = () => this.#returnSteps(value);
    return (
      this.#ongoingPromise
        ? this.#ongoingPromise.then(returnSteps, returnSteps)
        : returnSteps()
    ) as Promise<IteratorReturnResult<unknown>>;
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
    value?: unknown,
  ): Promise<ReadableStreamReadDoneResult<unknown>> {
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

const implementSymbol = Symbol();

interface InternalReadableStreamAsyncIterableIterator<R>
  extends ReadableStreamAsyncIterator<R> {
  [implementSymbol]: ReadableStreamAsyncIterableIteratorImpl<R>;
}

function _next<R>(this: InternalReadableStreamAsyncIterableIterator<R>) {
  return this[implementSymbol].next();
}
Object.defineProperty(_next, "name", { value: "next" });

function _return<R>(
  this: InternalReadableStreamAsyncIterableIterator<R>,
  returnValue?: unknown,
) {
  return this[implementSymbol].return(returnValue);
}
Object.defineProperty(_return, "name", { value: "return" });

const readableStreamAsyncIterableIteratorPrototype: InternalReadableStreamAsyncIterableIterator<unknown> =
  Object.create(AsyncIterablePrototype, {
    next: {
      enumerable: true,
      configurable: true,
      writable: true,
      value: _next,
    },
    return: {
      enumerable: true,
      configurable: true,
      writable: true,
      value: _return,
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
  { preventCancel = false }: ReadableStreamIteratorOptions = {},
): ReadableStreamAsyncIterator<R> {
  const reader = readableStream.getReader();
  const implement = new ReadableStreamAsyncIterableIteratorImpl<R>(
    reader,
    preventCancel,
  );
  const readableStreamAsyncIterableIterator: InternalReadableStreamAsyncIterableIterator<R> =
    Object.create(readableStreamAsyncIterableIteratorPrototype);
  readableStreamAsyncIterableIterator[implementSymbol] = implement;
  return readableStreamAsyncIterableIterator;
}
