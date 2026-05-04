---
"@sec-ant/readable-stream": minor
---

Fix TypeScript issues with the ponyfill (#66)

- `asyncIterator()` now returns `ReadableStreamAsyncIterator<R>` instead of an internal interface that exposed a private `unique symbol` brand. The package provides a compatible global declaration for older TypeScript versions and merges with modern `lib.dom.d.ts`, so ponyfill and polyfill usage share the same iterator type surface.
- Breaking type change: the unused `TReturn` generic parameter on `asyncIterator()` has been removed from the public signature. Runtime `iterator.return(value)` behavior remains spec-compliant and resolves with `{ done: true, value }`, while the public type follows `lib.dom`'s `ReadableStreamAsyncIterator<T>` shape.
- Added a top-level `types` field and a `typesVersions` map mirroring every subpath in `exports`, so the package's type definitions can be resolved under classic `moduleResolution: "node"` in addition to `node16` / `nodenext` / `bundler`.
- The polyfill now installs `ReadableStream.prototype.values` and `ReadableStream.prototype[Symbol.asyncIterator]` with Web IDL-conformant descriptors (`values` is enumerable, `[Symbol.asyncIterator]` is not) and guarantees the two slots reference the same function object.
