import type { ReadableStreamIteratorOptions } from "../core/asyncIterator.js";
/**
 * augment global readable stream interface
 */
declare global {
  interface AsyncIteratorObject<T, TReturn = unknown, TNext = unknown>
    extends AsyncIterator<T, TReturn, TNext> {
    [Symbol.asyncIterator](): AsyncIteratorObject<T, TReturn, TNext>;
  }
  interface ReadableStreamAsyncIterator<T>
    extends AsyncIteratorObject<T, undefined, unknown> {
    [Symbol.asyncIterator](): ReadableStreamAsyncIterator<T>;
  }
  // biome-ignore lint/suspicious/noExplicitAny: to be compatible with lib.dom.d.ts
  interface ReadableStream<R = any> {
    [Symbol.asyncIterator](
      options?: ReadableStreamIteratorOptions,
    ): ReadableStreamAsyncIterator<R>;
    values(
      options?: ReadableStreamIteratorOptions,
    ): ReadableStreamAsyncIterator<R>;
  }
}
