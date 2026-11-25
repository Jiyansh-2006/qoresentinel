import {
  generateMLDSA87KeyPair,
  MLDSA87KeyPair,
  PQCKeystoreManager,
  EncryptedKeystoreData,
} from "@qoresentinel/crypto";
import { SecurityStatusReport, QORECHAIN_DIANA_CONFIG } from "@qoresentinel/shared";
import { AgentAuthenticatorManager } from "../blockchain/authenticatorManager.js";

export class PQCService {
  private static currentKeyPair: MLDSA87KeyPair = generateMLDSA87KeyPair();
  private static encryptedKeystore: EncryptedKeystoreData | null = null;
  private static lastVerification: SecurityStatusReport["lastVerifiedSignature"] = null;

  public static getActiveKeyPair(): MLDSA87KeyPair {
    return this.currentKeyPair;
  }

  public static getSecurityStatus(): SecurityStatusReport {
    const authenticator = AgentAuthenticatorManager.getAuthenticatorConfig();

    return {
      pqcRegistered: true,
      algorithm: "ML-DSA-87",
      fipsStandard: "FIPS 204 (Level 5)",
      publicKeyFingerprint: this.currentKeyPair.fingerprint,
      agentAuthenticatorLinked: true,
      authenticatorDetails: authenticator,
      activeTargetVault: authenticator.permittedContractTargets[0] || "None",
      network: QORECHAIN_DIANA_CONFIG.name,
      lastVerifiedSignature: this.lastVerification,
    };
  }

  public static recordSignatureVerification(valid: boolean, digest: string): void {
    this.lastVerification = {
      valid,
      timestamp: Date.now(),
      digest,
    };
  }

  public static rotateKeys(passphraseSecret: string, reason: string): {
    oldFingerprint: string;
    newFingerprint: string;
    newPublicKeyHex: string;
  } {
    const oldFingerprint = this.currentKeyPair.fingerprint;
    const newKeyPair = generateMLDSA87KeyPair();
    this.currentKeyPair = newKeyPair;

    if (passphraseSecret) {
      this.encryptedKeystore = PQCKeystoreManager.encryptKeyPair(newKeyPair, passphraseSecret);
    }

    return {
      oldFingerprint,
      newFingerprint: newKeyPair.fingerprint,
      newPublicKeyHex: newKeyPair.publicKeyHex,
    };
  }
}
