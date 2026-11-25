import { ml_dsa87 } from "@noble/post-quantum/ml-dsa";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes, randomBytes } from "@noble/hashes/utils";
import {
  canonicalizeJson,
  CanonicalDecisionPayload,
  PQCSignatureBundle,
} from "@qoresentinel/shared";

export interface MLDSA87KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
  publicKeyHex: string;
  secretKeyHex: string;
  fingerprint: string;
}

/**
 * Calculates a standard QoreChain PQC fingerprint from an ML-DSA-87 public key.
 * Format: qor-pqc:dsa87:<hex(sha256(pk))[0..32]>
 */
export function computeMLDSA87Fingerprint(publicKey: Uint8Array): string {
  const hash = sha256(publicKey);
  const hex = bytesToHex(hash);
  return `qor-pqc:dsa87:${hex.slice(0, 32)}`;
}

/**
 * Generates a NIST FIPS 204 ML-DSA-87 (Security Level 5) KeyPair.
 * Public key size: 2592 bytes. Secret key size: 4896 bytes.
 */
export function generateMLDSA87KeyPair(seed?: Uint8Array): MLDSA87KeyPair {
  const seedBytes = seed || randomBytes(32);
  const keys = ml_dsa87.keygen(seedBytes);
  const publicKeyHex = bytesToHex(keys.publicKey);
  const secretKeyHex = bytesToHex(keys.secretKey);
  const fingerprint = computeMLDSA87Fingerprint(keys.publicKey);

  return {
    publicKey: keys.publicKey,
    secretKey: keys.secretKey,
    publicKeyHex,
    secretKeyHex,
    fingerprint,
  };
}

/**
 * Signs a canonical decision payload using NIST FIPS 204 ML-DSA-87.
 * Workflow:
 * 1. Canonicalize payload using RFC 8785 JSON Canonicalization Scheme (JCS).
 * 2. Compute SHA-256 digest of canonical bytes.
 * 3. Sign the SHA-256 digest with ML-DSA-87 secret key.
 * 4. Package complete PQCSignatureBundle with fingerprint and digest.
 */
export function signCanonicalDecisionPayload(
  secretKey: Uint8Array | string,
  publicKey: Uint8Array | string,
  payload: CanonicalDecisionPayload
): PQCSignatureBundle {
  const skBytes = typeof secretKey === "string" ? hexToBytes(secretKey) : secretKey;
  const pkBytes = typeof publicKey === "string" ? hexToBytes(publicKey) : publicKey;

  const canonicalJson = canonicalizeJson(payload);
  const encoder = new TextEncoder();
  const payloadBytes = encoder.encode(canonicalJson);

  const digestBytes = sha256(payloadBytes);
  const digestSha256Hex = bytesToHex(digestBytes);

  // Sign digest with ML-DSA-87
  const signatureBytes = ml_dsa87.sign(skBytes, digestBytes);
  const signatureHex = bytesToHex(signatureBytes);
  const publicKeyFingerprint = computeMLDSA87Fingerprint(pkBytes);

  return {
    algorithm: "ML-DSA-87",
    publicKeyHex: bytesToHex(pkBytes),
    publicKeyFingerprint,
    signatureHex,
    digestSha256Hex,
    signedAt: Date.now(),
  };
}

/**
 * Verifies an ML-DSA-87 signature over a canonical decision payload.
 * Verifies:
 * 1. Payload canonicalization and SHA-256 re-calculation matches bundle digest.
 * 2. Cryptographic signature verification with ML-DSA-87 public key.
 */
export function verifyCanonicalDecisionSignature(
  publicKey: Uint8Array | string,
  payload: CanonicalDecisionPayload,
  signatureBundle: PQCSignatureBundle
): {
  valid: boolean;
  computedDigestHex: string;
  fingerprintMatches: boolean;
  error?: string;
} {
  try {
    const pkBytes = typeof publicKey === "string" ? hexToBytes(publicKey) : publicKey;
    const sigBytes = hexToBytes(signatureBundle.signatureHex);

    const canonicalJson = canonicalizeJson(payload);
    const encoder = new TextEncoder();
    const payloadBytes = encoder.encode(canonicalJson);
    const computedDigest = sha256(payloadBytes);
    const computedDigestHex = bytesToHex(computedDigest);

    // Verify digest integrity
    if (computedDigestHex !== signatureBundle.digestSha256Hex) {
      return {
        valid: false,
        computedDigestHex,
        fingerprintMatches: false,
        error: "Payload digest mismatch: payload has been tampered with or altered",
      };
    }

    // Verify fingerprint
    const computedFingerprint = computeMLDSA87Fingerprint(pkBytes);
    const fingerprintMatches = computedFingerprint === signatureBundle.publicKeyFingerprint;
    if (!fingerprintMatches) {
      return {
        valid: false,
        computedDigestHex,
        fingerprintMatches: false,
        error: "Public key fingerprint mismatch with signature bundle",
      };
    }

    // Verify cryptographic ML-DSA-87 signature: (publicKey, msg, sig)
    const isValid = ml_dsa87.verify(pkBytes, computedDigest, sigBytes);

    return {
      valid: isValid,
      computedDigestHex,
      fingerprintMatches: true,
      error: isValid ? undefined : "Cryptographic ML-DSA-87 signature validation failed",
    };
  } catch (err: any) {
    return {
      valid: false,
      computedDigestHex: "",
      fingerprintMatches: false,
      error: `Verification exception: ${err.message}`,
    };
  }
}
