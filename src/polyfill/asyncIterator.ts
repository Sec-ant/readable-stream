/// <reference types="../types/async-iterator.d.ts" />

import { asyncIterator } from "../core/asyncIterator.js";

ReadableStream.prototype.values ??= ReadableStream.prototype[
  Symbol.asyncIterator
] ??= function (
  ...args: Parameters<typeof asyncIterator> extends [infer _, ...infer T]
    ? T
    : never
) {
  return asyncIterator(this, ...args);
};

ReadableStream.prototype[Symbol.asyncIterator] ??=
  ReadableStream.prototype.values;
