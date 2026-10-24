for (const method of ["next", "return"]) {
  promise_test(async (t) => {
    const stream = new ReadableStream();
    const iterator = stream.values();
    t.add_cleanup(() => iterator.return());
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    for (const receiver of [
      undefined,
      null,
      1,
      "iterator",
      Symbol(),
      {},
      Object.create(iterator),
      new Proxy(iterator, {}),
      revoked.proxy,
    ]) {
      const result = Reflect.apply(iterator[method], receiver, []);
      assert_true(
        result instanceof Promise,
        "invalid receiver returns a Promise",
      );
      await promise_rejects_js(t, TypeError, result);
    }
    assert_true(stream.locked, "invalid calls leave the real iterator alone");
    await iterator.return();
    assert_false(stream.locked, "the valid iterator remains usable");
  }, `${method} rejects incompatible receivers asynchronously`);
}
