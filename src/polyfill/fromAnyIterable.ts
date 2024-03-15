import { fromAnyIterable } from "../core/fromAnyIterable.js";

// sadly we are not allowed to extend or override a declared var.

type AugmentedReadableStreamConstructor<R = unknown> =
  typeof ReadableStream<R> & {
    from?: typeof fromAnyIterable<R>;
  };

(ReadableStream as AugmentedReadableStreamConstructor).from ??= fromAnyIterable;
