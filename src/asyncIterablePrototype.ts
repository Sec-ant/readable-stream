export const AsyncIterablePrototype: object = Object.getPrototypeOf(
  Object.getPrototypeOf(async function* () {
    /* void */
  }).prototype
);
