import type { asyncIterator } from "../core/asyncIterator.js";

type AsyncIteratorOptions = Parameters<typeof asyncIterator>[1];

declare global {
  // biome-ignore lint/suspicious/noExplicitAny: to be compatible with lib.dom.d.ts
  interface ReadableStream<R = any> {
    [Symbol.asyncIterator](
      options?: AsyncIteratorOptions,
    ): ReadableStreamAsyncIterator<R>;
    values(options?: AsyncIteratorOptions): ReadableStreamAsyncIterator<R>;
  }
}
