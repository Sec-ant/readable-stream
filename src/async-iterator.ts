/// <reference lib="es2018.asynciterable" />

import { ReadableStreamDefaultReaderRead, ReadRequest } from "./default-reader";
import {
  ReadableStreamReaderGenericCancel,
  ReadableStreamReaderGenericRelease,
  readerLockException,
} from "./generic-reader";
import assert from "../../stub/assert";
import { AsyncIteratorPrototype } from "@@target/stub/async-iterator-prototype";
import { typeIsObject } from "../helpers/miscellaneous";
import {
  promiseRejectedWith,
  promiseResolvedWith,
  queueMicrotask,
  transformPromiseWith,
} from "../helpers/webidl";

/**
 * An async iterator returned by {@link ReadableStream.values}.
 *
 * @public
 */
export interface ReadableStreamAsyncIterator<R, TReturn = undefined>
  extends AsyncIterator<R, TReturn> {
  next(): Promise<IteratorYieldResult<R>>;
  return(value?: TReturn): Promise<IteratorReturnResult<TReturn>>;
}

export class ReadableStreamAsyncIteratorImpl<R, TReturn = undefined> {
  readonly #reader: ReadableStreamDefaultReader<R>;
  readonly #preventCancel: boolean;
  #ongoingPromise: Promise<ReadableStreamReadResult<R>> | undefined = undefined;
  #isFinished = false;

  constructor(reader: ReadableStreamDefaultReader<R>, preventCancel: boolean) {
    this.#reader = reader;
    this.#preventCancel = preventCancel;
  }

  next(): Promise<ReadableStreamReadResult<R>> {
    const nextSteps = () => this.#nextSteps();
    this.#ongoingPromise = this.#ongoingPromise
      ? this.#ongoingPromise.then(nextSteps, nextSteps)
      : nextSteps();
    return this.#ongoingPromise as Promise<ReadableStreamReadResult<R>>;
  }

  return(value: TReturn): Promise<ReadableStreamReadDoneResult<TReturn>> {
    const returnSteps = () => this.#returnSteps(value);
    return this.#ongoingPromise
      ? this.#ongoingPromise.then(returnSteps, returnSteps)
      : returnSteps();
  }

  #nextSteps(): Promise<ReadableStreamReadResult<R>> {
    if (this.#isFinished) {
      return Promise.resolve({ value: undefined, done: true });
    }

    const reader = this.#reader;

    // TODO: is this safe?
    /*
    if (reader._ownerReadableStream === undefined) {
      return promiseRejectedWith(readerLockException("iterate"));
    }
    */

    let resolvePromise: (result: ReadableStreamDefaultReadResult<R>) => void;
    let rejectPromise: <Reason>(reason: Reason) => void;
    const promise = new Promise<ReadableStreamDefaultReadResult<R>>(
      (resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
      }
    );
    const readRequest: ReadRequest<R> = {
      _chunkSteps: (chunk: R) => {
        this.#ongoingPromise = undefined;
        // This needs to be delayed by one microtask, otherwise we stop pulling too early which breaks a test.
        // FIXME Is this a bug in the specification, or in the test?
        queueMicrotask(() => resolvePromise({ value: chunk, done: false }));
      },
      _closeSteps: () => {
        this.#ongoingPromise = undefined;
        this.#isFinished = true;
        ReadableStreamReaderGenericRelease(reader);
        resolvePromise({ value: undefined, done: true });
      },
      _errorSteps: <Reason>(reason: Reason) => {
        this.#ongoingPromise = undefined;
        this.#isFinished = true;
        ReadableStreamReaderGenericRelease(reader);
        rejectPromise(reason);
      },
    };
    ReadableStreamDefaultReaderRead(reader, readRequest);
    return promise;
  }

  #returnSteps(value: any): Promise<ReadableStreamDefaultReadResult<any>> {
    if (this.#isFinished) {
      return Promise.resolve({ value, done: true });
    }
    this.#isFinished = true;

    const reader = this.#reader;
    if (reader._ownerReadableStream === undefined) {
      return promiseRejectedWith(readerLockException("finish iterating"));
    }

    assert(reader._readRequests.length === 0);

    if (!this.#preventCancel) {
      const result = ReadableStreamReaderGenericCancel(reader, value);
      ReadableStreamReaderGenericRelease(reader);
      return transformPromiseWith(result, () => ({ value, done: true }));
    }

    ReadableStreamReaderGenericRelease(reader);
    return promiseResolvedWith({ value, done: true });
  }
}

declare class ReadableStreamAsyncIteratorInstance<R>
  implements ReadableStreamAsyncIterator<R>
{
  /** @interal */
  _asyncIteratorImpl: ReadableStreamAsyncIteratorImpl<R>;

  next(): Promise<IteratorResult<R, undefined>>;

  return(value?: any): Promise<IteratorResult<any>>;
}

const ReadableStreamAsyncIteratorPrototype: ReadableStreamAsyncIteratorInstance<any> =
  {
    next(
      this: ReadableStreamAsyncIteratorInstance<any>
    ): Promise<ReadableStreamDefaultReadResult<any>> {
      if (!IsReadableStreamAsyncIterator(this)) {
        return promiseRejectedWith(
          streamAsyncIteratorBrandCheckException("next")
        );
      }
      return this._asyncIteratorImpl.next();
    },

    return(
      this: ReadableStreamAsyncIteratorInstance<any>,
      value: any
    ): Promise<ReadableStreamDefaultReadResult<any>> {
      if (!IsReadableStreamAsyncIterator(this)) {
        return promiseRejectedWith(
          streamAsyncIteratorBrandCheckException("return")
        );
      }
      return this._asyncIteratorImpl.return(value);
    },
  } as any;
if (AsyncIteratorPrototype !== undefined) {
  Object.setPrototypeOf(
    ReadableStreamAsyncIteratorPrototype,
    AsyncIteratorPrototype
  );
}

// Abstract operations for the ReadableStream.

export function AcquireReadableStreamAsyncIterator<R>(
  stream: ReadableStream<R>,
  preventCancel: boolean
): ReadableStreamAsyncIterator<R> {
  const reader = stream.getReader();
  const impl = new ReadableStreamAsyncIteratorImpl(reader, preventCancel);
  const iterator: ReadableStreamAsyncIteratorInstance<R> = Object.create(
    ReadableStreamAsyncIteratorPrototype
  );
  iterator._asyncIteratorImpl = impl;
  return iterator;
}

function IsReadableStreamAsyncIterator<R = any>(
  x: any
): x is ReadableStreamAsyncIterator<R> {
  if (!typeIsObject(x)) {
    return false;
  }

  if (!Object.prototype.hasOwnProperty.call(x, "_asyncIteratorImpl")) {
    return false;
  }

  try {
    // noinspection SuspiciousTypeOfGuard
    return (
      (x as ReadableStreamAsyncIteratorInstance<any>)
        ._asyncIteratorImpl instanceof ReadableStreamAsyncIteratorImpl
    );
  } catch {
    return false;
  }
}

// Helper functions for the ReadableStream.

function streamAsyncIteratorBrandCheckException(name: string): TypeError {
  return new TypeError(
    `ReadableStreamAsyncIterator.${name} can only be used on a ReadableSteamAsyncIterator`
  );
}
