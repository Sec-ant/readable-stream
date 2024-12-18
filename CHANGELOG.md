# @sec-ant/readable-stream

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
