---
"@sec-ant/readable-stream": minor
---

Refactor `asyncIterator` ponyfill API

**BREAKING**: The `asyncIterator` from the ponyfill API is refactored, you should now use it like this:

```ts
asyncIterator(readableStream);
```

instead of

```ts
asyncIterator.call(readableStream);
```
