---
"@sec-ant/readable-stream": patch
---

Fix iterable conversion to validate iterator results, capture `next` once, and read `done` before `value`.
