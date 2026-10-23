# @sec-ant/readable-stream

[![npm version](https://img.shields.io/npm/v/@sec-ant/readable-stream?cacheSeconds=300)](https://www.npmjs.com/package/@sec-ant/readable-stream/v/latest) [![npm downloads](https://img.shields.io/npm/dm/@sec-ant/readable-stream?cacheSeconds=300)](https://www.npmjs.com/package/@sec-ant/readable-stream/v/latest) [![](https://img.shields.io/jsdelivr/npm/hm/@sec-ant/readable-stream?cacheSeconds=300&color=ff5627)](https://www.jsdelivr.com/package/npm/@sec-ant/readable-stream) [![bundlephobia minzipped](https://img.shields.io/bundlephobia/minzip/@sec-ant/readable-stream?cacheSeconds=300)](https://bundlephobia.com/package/@sec-ant/readable-stream@latest) [![npm license](https://img.shields.io/npm/l/@sec-ant/readable-stream?cacheSeconds=300)](https://www.npmjs.com/package/@sec-ant/readable-stream/v/latest)

A tiny, zero-dependency asynchronous iterator polyfill/ponyfill for [`ReadableStream`](https://developer.mozilla.org/docs/Web/API/ReadableStream)s.

## Features

### Asynchronously iterate a `ReadableStream`

With this package, you can consume a `ReadableStream` as an `AsyncIterable`.

- spec: https://streams.spec.whatwg.org/#rs-asynciterator
- tests: https://github.com/Sec-ant/readable-stream/blob/main/tests/asyncIterator.spec.ts (copied from [wpt](https://github.com/web-platform-tests/wpt/blob/309231a7f3e900d04914bc4963b016efd9989a00/streams/readable-streams/async-iterator.any.js))

### Convert an `AsyncIterable` or an `Iterable` into a `ReadableStream`

With this package, you can construct a `ReadableStream` from an `AsyncIterable` or an `Iterable`.

- spec: https://streams.spec.whatwg.org/#rs-from
- tests: https://github.com/Sec-ant/readable-stream/blob/main/tests/fromAnyIterable.spec.ts (copied from [wpt](https://github.com/web-platform-tests/wpt/blob/309231a7f3e900d04914bc4963b016efd9989a00/streams/readable-streams/from.any.js))

This package passes all the aforementioned tests.

## Install

```bash
npm i @sec-ant/readable-stream
```

## Usage

### Ponyfill

This package can be imported as a _ponyfill_ to avoid side effects:

#### `asyncIterator`

Path:

```
@sec-ant/readable-stream/ponyfill/asyncIterator
```

Example:

```ts
import {
  asyncIterator,
  type ReadableStreamIteratorOptions,
} from "@sec-ant/readable-stream/ponyfill/asyncIterator";

const readableStream = (await fetch("https://www.example.org/")).body;

let total = 0;
for await (const chunk of asyncIterator(readableStream)) {
  total += chunk.length;
}

console.log(total);
```

Check https://streams.spec.whatwg.org/#rs-class-definition and https://streams.spec.whatwg.org/#rs-asynciterator for further explanation on `ReadableStreamIteratorOptions`.

#### `fromAnyIterable`

Path:

```
@sec-ant/readable-stream/ponyfill/fromAnyIterable
```

Example:

```ts
import { fromAnyIterable } from "@sec-ant/readable-stream/ponyfill/fromAnyIterable";

const readableStream = fromAnyIterable(["a", "b"]);
```

#### All-in-One

Path:

```
@sec-ant/readable-stream/ponyfill
```

Example:

```ts
import {
  fromAnyIterable,
  asyncIterator,
  type ReadableStreamIteratorOptions,
} from "@sec-ant/readable-stream/ponyfill";
```

### Polyfill

This package can be imported as a drop-in _polyfill_ with side effects.

#### `ReadableStream.prototype[Symbol.asyncIterator]` and `ReadableStream.prototype.values`

Path:

```
@sec-ant/readable-stream/polyfill/asyncIterator
```

Example:

```ts
import "@sec-ant/readable-stream/polyfill/asyncIterator";

const readableStream = (await fetch("https://www.example.org/")).body;

let total = 0;
for await (const chunk of readableStream) {
  total += chunk.length;
}

console.log(total);
```

#### `ReadableStream.from`

Path:

```
@sec-ant/readable-stream/polyfill/fromAnyIterable
```

Example:

```js
import "@sec-ant/readable-stream/polyfill/fromAnyIterable";

const readableStream = ReadableStream.from(["a", "b"]);
```

The `fromAnyIterable` export provides TypeScript types for iterable-to-stream conversion.

#### All-in-One

Path:

```
@sec-ant/readable-stream/polyfill
```

Example:

```ts
import "@sec-ant/readable-stream/polyfill";
```

### Ponyfill + Polyfill

#### `asyncIterator`

Path:

```
@sec-ant/readable-stream/asyncIterator
```

Example:

```ts
import {
  asyncIterator,
  type ReadableStreamIteratorOptions,
} from "@sec-ant/readable-stream/asyncIterator";
// also with side effects
```

#### `fromAnyIterable`

Path:

```
@sec-ant/readable-stream/fromAnyIterable
```

Example:

```ts
import { fromAnyIterable } from "@sec-ant/readable-stream/fromAnyIterable";
// also with side effects
```

#### All-in-One

Path:

```
@sec-ant/readable-stream
```

Example:

```ts
import {
  fromAnyIterable,
  asyncIterator,
  type ReadableStreamIteratorOptions,
} from "@sec-ant/readable-stream";
// also with side effects
```

### Types

You can also use this package to augment the `ReadableStream` type for async iteration if the runtime already supports it but the type system does not.

Path:

```
@sec-ant/readable-stream/async-iterator
```

Example:

```ts
/// <reference types="@sec-ant/readable-stream/async-iterator" />
```

## Development

Use Node.js 24 and the pnpm version declared in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm test:coverage
pnpm test:wpt
pnpm benchmark
pnpm benchmark:memory
```

Browser tests run in Chromium, Firefox, and WebKit. WPT runs the upstream async
iteration, iterable conversion, cross-realm, and Streams IDL suites in Window and
Dedicated Worker environments. The IDL suite compares polyfill results with the
browser's native baseline. The upstream revision is pinned in
`compatibility/prepare.mjs` and configurable through `WPT_REVISION`.

The verified runtime matrix includes Chromium 156, Firefox 157, WebKit 27.2,
Safari 27.2, Chrome 114, Firefox 115, and WebKit 17. These tests use native
`ReadableStream` support and the package's ESNext build. WebKit entries refer to
Playwright engine builds.

For Safari, enable remote automation and run `safaridriver -p 4444` in a separate
terminal. The legacy installer provides isolated macOS browser downloads.

```sh
COMPAT_BROWSERS=safari pnpm test:wpt
node compatibility/install-legacy.mjs
COMPAT_BROWSERS=chrome-114,firefox-legacy,webkit-legacy pnpm test:wpt
```

Benchmarks compare the current implementation with the revision pinned in
`benchmarks/prepare.mjs`. Each workload has six warmup rounds and 25 measured
rounds with rotating implementation order. Node, Chromium, and Firefox run
sequentially. Individual runtimes can be selected with `pnpm benchmark node` or
`pnpm benchmark chromium firefox`.

Allocation sampling measures allocated bytes across the Node workload. The
retention check verifies collection of consumed buffers while iterators remain
alive. Reports, upstream sources, and browser downloads are generated under
`.vitest/`.

## License

MIT
