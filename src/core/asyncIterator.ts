import { AsyncIterablePrototype } from "./asyncIterablePrototype.js";

/**
 * the implementer that does all the heavy works
 */
class ReadableStreamAsyncIterableIteratorImpl<R, TReturn>
  implements AsyncIterator<R>
{
  #reader: ReadableStreamDefaultReader<R>;
  #preventCancel: boolean;
  #isFinished = false;
  #ongoingPromise:
    | Promise<
        ReadableStreamReadResult<R> | ReadableStreamReadDoneResult<TReturn>
      >
    | undefined = undefined;
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
  return(value?: TReturn) {
    const returnSteps = () => this.#returnSteps(value);
    return (
      this.#ongoingPromise
        ? this.#ongoingPromise.then(returnSteps, returnSteps)
        : returnSteps()
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
    value?: TReturn,
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

// incapsulation
const implementSymbol = Symbol();

/**
 * declare `ReadableStreamAsyncIterableIterator` interaface
 */
interface ReadableStreamAsyncIterableIterator<R, TReturn>
  extends AsyncIterableIterator<R> {
  [implementSymbol]: ReadableStreamAsyncIterableIteratorImpl<R, TReturn>;
}

/**
 * A next method in an iterator protocal
 * @param this
 * @returns
 */
function _next<R, TReturn>(
  this: ReadableStreamAsyncIterableIterator<R, TReturn>,
) {
  return this[implementSymbol].next();
}
Object.defineProperty(_next, "name", { value: "next" });

/**
 * A return method in an iterator protocal
 * @param this
 * @param returnValue
 * @returns
 */
function _return<R, TReturn>(
  this: ReadableStreamAsyncIterableIterator<R, TReturn>,
  returnValue?: TReturn,
) {
  return this[implementSymbol].return(returnValue);
}
Object.defineProperty(_return, "name", { value: "return" });

/**
 * create `readableStreamAsyncIterableIteratorPrototype`
 */
const readableStreamAsyncIterableIteratorPrototype: ReadableStreamAsyncIterableIterator<
  unknown,
  unknown
> = Object.create(AsyncIterablePrototype, {
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
 * Get an async iterable iterator from a readable stream
 * @param this
 * @param readableStreamIteratorOptions
 * @returns
 */
export function asyncIterator<R, TReturn>(
  this: ReadableStream<R>,
  { preventCancel = false }: ReadableStreamIteratorOptions = {},
) {
  const reader = this.getReader();
  const implement = new ReadableStreamAsyncIterableIteratorImpl<R, TReturn>(
    reader,
    preventCancel,
  );
  const readableStreamAsyncIterableIterator: ReadableStreamAsyncIterableIterator<
    R,
    TReturn
  > = Object.create(readableStreamAsyncIterableIteratorPrototype);
  readableStreamAsyncIterableIterator[implementSymbol] = implement;
  return readableStreamAsyncIterableIterator;
}
