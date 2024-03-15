export const AsyncIterablePrototype: object = Object.getPrototypeOf(
  Object.getPrototypeOf(
    /* istanbul ignore next */
    async function* () {
      /* void */
    },
  ).prototype,
);
