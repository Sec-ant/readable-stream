import type {
  asyncIterator,
  ReadableStreamIteratorOptions,
} from "../core/asyncIterator.js";

type AsyncIteratorOptions =
  Parameters<typeof asyncIterator> extends [unknown, infer Options]
    ? Options
    : ReadableStreamIteratorOptions | undefined;

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
      options?: AsyncIteratorOptions,
    ): ReadableStreamAsyncIterator<R>;
    values(options?: AsyncIteratorOptions): ReadableStreamAsyncIterator<R>;
  }
}
