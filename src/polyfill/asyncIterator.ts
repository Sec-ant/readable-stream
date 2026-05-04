/// <reference types="../types/async-iterator.d.ts" />

import { asyncIterator } from "../core/asyncIterator.js";

const values =
  ReadableStream.prototype.values ??
  ReadableStream.prototype[Symbol.asyncIterator] ??
  function values(
    this: ReadableStream<unknown>,
    ...args: Parameters<typeof asyncIterator> extends [infer _, ...infer T]
      ? T
      : never
  ) {
    return asyncIterator(this, ...args);
  };

if (ReadableStream.prototype.values == null) {
  Object.defineProperty(ReadableStream.prototype, "values", {
    value: values,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

if (ReadableStream.prototype[Symbol.asyncIterator] == null) {
  Object.defineProperty(ReadableStream.prototype, Symbol.asyncIterator, {
    value: ReadableStream.prototype.values,
    writable: true,
    enumerable: false,
    configurable: true,
  });
}
