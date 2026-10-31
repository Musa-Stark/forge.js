import sodium from "libsodium-wrappers-sumo";

/** Resolves once libsodium's WASM is initialised. */
export const getSodium = async (): Promise<typeof sodium> => {
  await sodium.ready;
  return sodium;
};
