import crypto from "node:crypto";
import { MLDSA87KeyPair, generateMLDSA87KeyPair, computeMLDSA87Fingerprint } from "./mldsa87.js";

export interface EncryptedKeystoreData {
  version: 1;
  algorithm: "ML-DSA-87";
  publicKeyHex: string;
  fingerprint: string;
  crypto: {
    cipher: "aes-256-gcm";
    ciphertext: string; // hex
    iv: string; // hex
    tag: string; // hex
    kdf: "pbkdf2";
    kdfparams: {
      iterations: number;
      salt: string; // hex
      hash: "sha256";
    };
  };
  metadata: {
    createdAt: number;
    rotatedAt?: number;
    rotationReason?: string;
    isActive: boolean;
  };
}

export class PQCKeystoreManager {
  private static deriveKey(secret: string, salt: Buffer, iterations: number = 100000): Buffer {
    return crypto.pbkdf2Sync(secret, salt, iterations, 32, "sha256");
  }

  /**
   * Encrypts and exports an ML-DSA-87 keypair into an AES-256-GCM encrypted keystore format.
   */
  public static encryptKeyPair(keyPair: MLDSA87KeyPair, passphraseSecret: string): EncryptedKeystoreData {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const key = this.deriveKey(passphraseSecret, salt);

    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const plaintext = Buffer.from(keyPair.secretKeyHex, "utf8");
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      version: 1,
      algorithm: "ML-DSA-87",
      publicKeyHex: keyPair.publicKeyHex,
      fingerprint: keyPair.fingerprint,
      crypto: {
        cipher: "aes-256-gcm",
        ciphertext: ciphertext.toString("hex"),
        iv: iv.toString("hex"),
        tag: tag.toString("hex"),
        kdf: "pbkdf2",
        kdfparams: {
          iterations: 100000,
          salt: salt.toString("hex"),
          hash: "sha256",
        },
      },
      metadata: {
        createdAt: Date.now(),
        isActive: true,
      },
    };
  }

  /**
   * Decrypts an encrypted keystore back to an MLDSA87KeyPair.
   */
  public static decryptKeystore(keystore: EncryptedKeystoreData, passphraseSecret: string): MLDSA87KeyPair {
    const salt = Buffer.from(keystore.crypto.kdfparams.salt, "hex");
    const iv = Buffer.from(keystore.crypto.iv, "hex");
    const tag = Buffer.from(keystore.crypto.tag, "hex");
    const ciphertext = Buffer.from(keystore.crypto.ciphertext, "hex");

    const key = this.deriveKey(passphraseSecret, salt, keystore.crypto.kdfparams.iterations);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const secretKeyHex = decrypted.toString("utf8");

    const secretKeyBytes = new Uint8Array(Buffer.from(secretKeyHex, "hex"));
    const publicKeyBytes = new Uint8Array(Buffer.from(keystore.publicKeyHex, "hex"));

    return {
      publicKey: publicKeyBytes,
      secretKey: secretKeyBytes,
      publicKeyHex: keystore.publicKeyHex,
      secretKeyHex,
      fingerprint: keystore.fingerprint,
    };
  }

  /**
   * Rotates an active keypair: generates a new keypair and marks previous as rotated.
   */
  public static rotateKey(
    oldKeystore: EncryptedKeystoreData,
    passphraseSecret: string,
    reason: string = "Scheduled periodic PQC key rotation"
  ): {
    oldKeystoreArchived: EncryptedKeystoreData;
    newKeystore: EncryptedKeystoreData;
    newKeyPair: MLDSA87KeyPair;
  } {
    const newKeyPair = generateMLDSA87KeyPair();
    const newKeystore = this.encryptKeyPair(newKeyPair, passphraseSecret);

    const oldKeystoreArchived: EncryptedKeystoreData = {
      ...oldKeystore,
      metadata: {
        ...oldKeystore.metadata,
        isActive: false,
        rotatedAt: Date.now(),
        rotationReason: reason,
      },
    };

    return {
      oldKeystoreArchived,
      newKeystore,
      newKeyPair,
    };
  }
}
