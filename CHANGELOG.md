# @sec-ant/readable-stream

## 0.7.0

### Minor Changes

- bf594cf: Fix TypeScript issues with the ponyfill (#66)
  - `asyncIterator()` now returns `ReadableStreamAsyncIterator<R>` instead of an internal interface that exposed a private `unique symbol` brand. The package provides a compatible global declaration for older TypeScript versions and merges with modern `lib.dom.d.ts`, so ponyfill and polyfill usage share the same iterator type surface.
  - Breaking type change: the unused `TReturn` generic parameter on `asyncIterator()` has been removed from the public signature. Runtime `iterator.return(value)` behavior remains spec-compliant and resolves with `{ done: true, value }`, while the public type follows `lib.dom`'s `ReadableStreamAsyncIterator<T>` shape.
  - Added a top-level `types` field and a `typesVersions` map mirroring every subpath in `exports`, so the package's type definitions can be resolved under classic `moduleResolution: "node"` in addition to `node16` / `nodenext` / `bundler`.
  - The polyfill now installs `ReadableStream.prototype.values` and `ReadableStream.prototype[Symbol.asyncIterator]` with Web IDL-conformant descriptors (`values` is enumerable, `[Symbol.asyncIterator]` is not) and guarantees the two slots reference the same function object.

## 0.6.1

### Patch Changes

- bd69b3e: Bump deps and switch to OIDC publishing

## 0.6.0

### Minor Changes

- 3b16e97: Update iterator-related types to cope with typescript 5.6 changes. See [this writeup](<https://devblogs.microsoft.com/typescript/announcing-typescript-5-6/#strict-builtin-iterator-checks-(and---strictbuiltiniteratorreturn)>) and [this PR](https://github.com/microsoft/TypeScript/pull/58243).

## 0.5.0

### Minor Changes

- 7cb5954: Refactor `asyncIterator` ponyfill API

  **BREAKING**: The `asyncIterator` from the ponyfill API is refactored, you should now use it like this:

  ```ts
  asyncIterator(readableStream);
  ```

  instead of

  ```ts
  asyncIterator.call(readableStream);
  ```

## 0.4.1

### Patch Changes

- 82a7030: Fix package.json main and module entry point.

## 0.4.0

### Minor Changes

- 0398fc0: Restructure codebase and export ponyfill entry points.

  **BREAKING CHANGE**: The API is redesgined. Check [REAMDE.md](https://github.com/Sec-ant/readable-stream/blob/main/README.md) for details.
