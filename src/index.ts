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
] ??= function (
  this: ReadableStream,
  { preventCancel = false }: ReadableStreamIteratorOptions = {
    preventCancel: false,
  }
) {
  const reader = this.getReader();
  let ongoingPromise: Promise<ReadableStreamReadResult<unknown>>;
  return {
    next() {
      // known issue: https://github.com/microsoft/TypeScript/issues/38479
      return (ongoingPromise = reader.read()) as Promise<
        IteratorResult<unknown, undefined>
      >;
    },
    async return() {
      await ongoingPromise;
      if (!preventCancel) {
        await reader.cancel();
      }
      reader.releaseLock();
      // not conform to the spec?: https://streams.spec.whatwg.org/#rs-asynciterator-prototype-return
      return {
        done: true,
        value: undefined,
      };
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
};

ReadableStream.prototype[Symbol.asyncIterator] ??=
  ReadableStream.prototype.values;
