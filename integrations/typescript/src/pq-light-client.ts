import {
  decodeSignedCheckpoint,
  decodeValidatorSet,
  newTrustedState,
  verifyCheckpoint,
  type TrustedState,
} from "@qorechain/pq-light-client";

/**
 * Verify an externally supplied checkpoint sequence against a caller-selected
 * trust root. This verifier is for simulated/reference data only: live QoreChain
 * nodes do not publish these checkpoints.
 */
export function verifySimulatedCheckpointSequence(input: {
  rootCheckpointHex: string;
  validatorSetHex: string;
  nextValidatorSetHex?: string;
  checkpointHexes: string[];
  nowSeconds: bigint;
  trustingPeriodSeconds: bigint;
  maxClockDriftSeconds: bigint;
}) {
  const bytes = (hex: string) => {
    const normalized = hex.replace(/^0x/, "");
    if (!/^(?:[0-9a-f]{2})+$/i.test(normalized)) throw new Error("Checkpoint data must be even-length hex.");
    return Uint8Array.from(Buffer.from(normalized, "hex"));
  };
  const root = decodeSignedCheckpoint(bytes(input.rootCheckpointHex));
  const validatorSet = decodeValidatorSet(bytes(input.validatorSetHex));
  const nextValidatorSet = input.nextValidatorSetHex
    ? decodeValidatorSet(bytes(input.nextValidatorSetHex))
    : validatorSet;
  let trusted: TrustedState = newTrustedState({
    checkpoint: root.checkpoint,
    signatures: root.signatures,
    validatorSet,
    nextValidatorSet,
    trustingPeriod: input.trustingPeriodSeconds,
    maxClockDrift: input.maxClockDriftSeconds,
  });
  const accepted = [];
  for (const hex of input.checkpointHexes) {
    const checkpoint = decodeSignedCheckpoint(bytes(hex));
    trusted = verifyCheckpoint(trusted, checkpoint, input.nowSeconds);
    accepted.push({ epoch: trusted.checkpoint.epoch, height: trusted.checkpoint.height });
  }
  return { trusted: accepted, finalCheckpoint: accepted.at(-1) ?? { epoch: trusted.checkpoint.epoch, height: trusted.checkpoint.height } };
}
