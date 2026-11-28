import { HandleClient, type PinStore } from "@qorechain/handles";

export function createHandleResolver(input: {
  registryUrl: string;
  registryPubkeyHex: string;
  pins: PinStore;
}) {
  const client = new HandleClient({ baseUrl: input.registryUrl, registryPubkeyHex: input.registryPubkeyHex });
  return async (handle: string) => {
    const result = await client.resolve(handle, input.pins);
    if (result.pin.status === "CHANGED") {
      throw new Error("QoreX handle address changed. Require the user to review the full address before proceeding.");
    }
    return { record: result.record, pinStatus: result.pin.status };
  };
}
