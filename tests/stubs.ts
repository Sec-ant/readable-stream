function stepTimeout<R>(
  func: (...params: R[]) => unknown,
  timeout: number,
  ...args: R[]
) {
  return setTimeout(() => {
    func.apply(this, args);
  }, timeout);
}

function delay(ms: number) {
  return new Promise((resolve) => stepTimeout(resolve, ms));
}

export async function flushAsyncEvents() {
  await delay(0);
  await delay(0);
  await delay(0);
  return await delay(0);
}
