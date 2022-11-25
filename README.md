# @sec-ant/readable-stream

A Very Simple Web Streams API ReadableStream Asynchronous Iteration Polyfill

https://streams.spec.whatwg.org/#rs-asynciterator

## Install

```bash
npm i @sec-ant/readable-stream
```

## Usage

This package can be used as a side effect if you only need async iteration support:

```ts
import "@sec-ant/readable-stream";
```

You can also import the `fromIterable` function which enables you to create a `ReadableStream` from an `Iterable` or an `AsyncIterable`:

```ts
import { fromIterable } from "@sec-ant/readable-stream";
```

With the help of this package, you can `tee` an `AsyncIterable` like this:

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
