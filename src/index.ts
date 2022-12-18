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

export const AsyncIterableIteratorPrototype: object = Object.getPrototypeOf(
  Object.getPrototypeOf(async function* () {
    /* void */
  }).prototype
);

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

interface ReadableStreamAsyncIterableIterator<R, TReturn = unknown>
  extends AsyncIterableIterator<R> {
  implement: ReadableStreamAsyncIterableIteratorImpl<R, TReturn>;
}

function next<R, TReturn>(
  this: ReadableStreamAsyncIterableIterator<R, TReturn>
) {
  return this.implement.next();
}

function _return<R, TReturn>(
  this: ReadableStreamAsyncIterableIterator<R, TReturn>,
  returnValue?: TReturn
) {
  return this.implement.return(returnValue);
}

Object.defineProperty(_return, "name", { value: "return" });

const readableStreamAsyncIterableIteratorPrototype: ReadableStreamAsyncIterableIterator<unknown> =
  Object.create(AsyncIterableIteratorPrototype, {
    next: {
      enumerable: true,
      configurable: true,
      writable: true,
      value: next,
    },
    return: {
      enumerable: true,
      configurable: true,
      writable: true,
      value: _return,
    },
  });

ReadableStream.prototype.values ??= ReadableStream.prototype[
  Symbol.asyncIterator
] ??= function <R, TReturn = unknown>(
  this: ReadableStream<R>,
  { preventCancel = false }: ReadableStreamIteratorOptions = {
    preventCancel: false,
  }
) {
  const reader = this.getReader();
  const implement = new ReadableStreamAsyncIterableIteratorImpl<R, TReturn>(
    reader,
    preventCancel
  );
  const readableStreamAsyncIterableIterator: ReadableStreamAsyncIterableIterator<
    R,
    TReturn
  > = Object.create(readableStreamAsyncIterableIteratorPrototype);
  readableStreamAsyncIterableIterator.implement = implement;
  return readableStreamAsyncIterableIterator;
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
