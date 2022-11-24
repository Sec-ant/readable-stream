export interface ReadableStreamIteratorOptions {
  preventCancel?: boolean;
}

declare global {
  interface ReadableStream<R> {
    [Symbol.asyncIterator](): AsyncIterator<R, undefined>;
    values(
      options?: ReadableStreamIteratorOptions
    ): AsyncIterator<R, undefined>;
  }
}

ReadableStream.prototype.values ??= ReadableStream.prototype[
  Symbol.asyncIterator
] ??= function (
  this: ReadableStream<never>,
  { preventCancel = false }: ReadableStreamIteratorOptions = {
    preventCancel: false,
  }
) {
  const reader = this.getReader();
  let temp: Promise<ReadableStreamReadResult<never>>;
  return {
    next() {
      return (temp = reader.read());
    },
    async return() {
      await temp;
      if (!preventCancel) {
        await reader.cancel();
      }
      reader.releaseLock();
      return {
        done: true,
        value: undefined,
      };
    },
  };
};
