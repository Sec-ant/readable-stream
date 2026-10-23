import { fromAnyIterable } from "../core/fromAnyIterable.js";

// sadly we are not allowed to extend or override a declared var.

type AugmentedReadableStreamConstructor<R = unknown> =
  typeof ReadableStream<R> & {
    from?: typeof fromAnyIterable<R>;
  };

const { from } = {
  from(iterable: Iterable<unknown> | AsyncIterable<unknown>) {
    if (
      iterable === null ||
      (typeof iterable !== "object" && typeof iterable !== "function")
    ) {
      throw new TypeError("ReadableStream.from requires an iterable object.");
    }
    return fromAnyIterable(iterable);
  },
};

(ReadableStream as AugmentedReadableStreamConstructor).from ??= from;
