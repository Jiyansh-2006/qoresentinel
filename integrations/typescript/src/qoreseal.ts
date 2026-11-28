import { envelopeToText, generateSealKeys, open, recipientOf, seal } from "@qorechain/qoreseal";

/** Offline example for a caller that already has an authorized recipient key. */
export function sealPrivateNote(plaintext: string, recipientKeys = generateSealKeys()) {
  const chainId = process.env.QORE_CHAIN_ID ?? "qorechain-diana";
  const purpose = "qoresentinel-private-note";
  const envelope = seal({
    chainId,
    purpose,
    recipients: [recipientOf(recipientKeys)],
    plaintext: new TextEncoder().encode(plaintext),
  });
  return {
    envelope: envelopeToText(envelope),
    open: () => new TextDecoder().decode(open({ chainId, purpose, envelope, keys: recipientKeys })),
  };
}
