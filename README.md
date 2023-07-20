# @sec-ant/readable-stream

A Simple Yet Spec-Compliant Asynchronous Iteration Polyfill for [`ReadableStream`](https://developer.mozilla.org/docs/Web/API/ReadableStream)s from [Web Streams API](https://developer.mozilla.org/docs/Web/API/Streams_API)

## Features

### Async Iteration of a `ReadableStream`

With this polyfill, you'll be able to consume a `ReadableStream` as an `AsyncIterable`.

- spec: https://streams.spec.whatwg.org/#rs-asynciterator
- tests: https://github.com/Sec-ant/readable-stream/blob/master/tests/asyncIteration.spec.ts (copied from [wpt](https://github.com/web-platform-tests/wpt/blob/c894f0086c99ab5efc37691ac60f33a2b37c2e7c/streams/readable-streams/async-iterator.any.js))

### Construction of a `ReadableStream` from an `AsyncIterable` or an `Iterable`

You can use the function `fromIterable` in this package to construct a `ReadableStream` from an `AsyncIterable` or an `Iterable`. This mimics the static method `ReadableStream.from`.

- spec: https://streams.spec.whatwg.org/#rs-from
- tests: https://github.com/Sec-ant/readable-stream/blob/master/tests/fromIterable.spec.ts (copied from [wpt](https://github.com/web-platform-tests/wpt/blob/b9a5d6d163c5797de3f3da1c74af6e437f25a3d9/streams/readable-streams/from.any.js))

This package passes all the aforementioned tests.

## Install

```bash
npm i @sec-ant/readable-stream
```

## Usage

This package can be used as a side effect if you only need the async iteration support:

```ts
import "@sec-ant/readable-stream";
```

You can also import the `fromIterable` function which enables you to construct a `ReadableStream` from an `Iterable` or an `AsyncIterable`:

```ts
import { fromIterable } from "@sec-ant/readable-stream";
```

With the help of this package, you can "`tee`" an `AsyncIterable` like this:

```ts
import { fromIterable } from "@sec-ant/readable-stream";

async function* createAsyncIterable() {
  yield "how";
  yield "are";
  yield "you";
}

const asyncIterable = createAsyncIterable();

const [asyncIterable1, asyncIterable2] = fromIterable(asyncIterable).tee();
```

## License

MIT
