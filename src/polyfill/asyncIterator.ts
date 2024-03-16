/// <reference types="../types/async-iterator.d.ts" />

import { asyncIterator } from "../core/asyncIterator.js";

ReadableStream.prototype.values ??= ReadableStream.prototype[
  Symbol.asyncIterator
] ??= asyncIterator;

ReadableStream.prototype[Symbol.asyncIterator] ??=
  ReadableStream.prototype.values;
