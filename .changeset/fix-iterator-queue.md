---
"@sec-ant/readable-stream": patch
---

Serialize `next()` and `return()` through stream cancellation. Reuse reader callbacks to reduce promise allocations and release consumed chunks after operations settle.
