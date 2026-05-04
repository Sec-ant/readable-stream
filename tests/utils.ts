function stepTimeout<R>(
  func: (...params: R[]) => unknown,
  timeout: number,
  ...args: R[]
) {
  return setTimeout(() => {
    func(...args);
  }, timeout);
}

function delay(ms: number) {
  return new Promise((resolve) => stepTimeout(resolve, ms));
}

export async function flushAsyncEvents() {
  await delay(0);
  await delay(0);
  await delay(0);
  return await delay(0);
}

export function assumeAs<T>(_: unknown): asserts _ is T {
  /* void */
}

type NativeIteratorMethod = () => undefined;
type ReadableStreamPrototypeStub = {
  values?: NativeIteratorMethod;
  [Symbol.asyncIterator]?: NativeIteratorMethod;
};

export async function polyfillWithExistingValues() {
  const savedReadableStream = globalThis.ReadableStream;
  const nativeValues = function nativeValues() {
    return undefined;
  };
  const prototype: ReadableStreamPrototypeStub = {};
  const LocalReadableStream = { prototype } as unknown as typeof ReadableStream;

  Object.defineProperty(prototype, "values", {
    value: nativeValues,
    writable: true,
    enumerable: false,
    configurable: true,
  });

  Object.defineProperty(globalThis, "ReadableStream", {
    value: LocalReadableStream,
    configurable: true,
  });
  try {
    /* @ts-expect-error for testing only */
    await import("../src/polyfill/asyncIterator.js?existing-values");
  } finally {
    Object.defineProperty(globalThis, "ReadableStream", {
      value: savedReadableStream,
      configurable: true,
    });
  }

  return {
    valuesIsNative: prototype.values === nativeValues,
    asyncIteratorIsNative: prototype[Symbol.asyncIterator] === nativeValues,
    asyncIteratorDescriptor: Object.getOwnPropertyDescriptor(
      prototype,
      Symbol.asyncIterator,
    ) as PropertyDescriptor,
  };
}

export async function polyfillWithExistingAsyncIterator() {
  const savedReadableStream = globalThis.ReadableStream;
  const nativeAsyncIterator = function nativeAsyncIterator() {
    return undefined;
  };
  const prototype: ReadableStreamPrototypeStub = {};
  const LocalReadableStream = { prototype } as unknown as typeof ReadableStream;

  Object.defineProperty(prototype, Symbol.asyncIterator, {
    value: nativeAsyncIterator,
    writable: true,
    enumerable: false,
    configurable: true,
  });

  Object.defineProperty(globalThis, "ReadableStream", {
    value: LocalReadableStream,
    configurable: true,
  });
  try {
    /* @ts-expect-error for testing only */
    await import("../src/polyfill/asyncIterator.js?existing-async-iterator");
  } finally {
    Object.defineProperty(globalThis, "ReadableStream", {
      value: savedReadableStream,
      configurable: true,
    });
  }

  return {
    valuesIsNative: prototype.values === nativeAsyncIterator,
    asyncIteratorIsNative:
      prototype[Symbol.asyncIterator] === nativeAsyncIterator,
    valuesDescriptor: Object.getOwnPropertyDescriptor(
      prototype,
      "values",
    ) as PropertyDescriptor,
  };
}
