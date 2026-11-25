# QoreSentinel Security Architecture & Post-Quantum Implementation

Post-quantum security is the foundation of QoreSentinel. The platform guarantees that grant allocations remain mathematically immutable even against future quantum computing adversaries possessing Shor's algorithm.

---

## 1. Cryptographic Primitives

| Component | Standard / Specification | Key / Output Size | Security Purpose |
| :--- | :--- | :--- | :--- |
| **Digital Signatures** | **NIST FIPS 204 ML-DSA-87** (Dilithium-5) | Public Key: 2592 bytes<br>Secret Key: 4896 bytes<br>Signature: 4627 bytes | Post-quantum authenticity of AI decisions and payout authorizations |
| **Evidence Digest** | **SHA-256** (FIPS 180-4) | 32 bytes (256 bits) | Tamper-proof fingerprinting of proposal documents and payloads |
| **Payload Normalization** | **RFC 8785 JCS** | Canonical UTF-8 bytes | Eliminates key ordering malleability across platforms |
| **Keystore Storage** | **AES-256-GCM** + PBKDF2 (100k iters) | 256-bit symmetric key + 96-bit IV + 128-bit Tag | Encrypted at rest; no plaintext private keys stored in DB |

---

## 2. ML-DSA-87 Verification Workflow

When an autonomous allocation decision is rendered:
1. All payload fields are serialized strictly according to RFC 8785.
2. A SHA-256 digest is calculated over the canonical byte stream.
3. The private key generates an ML-DSA-87 signature using Module-Lattice vectors.
4. The signature bundle includes the public key fingerprint formatted as:
   `qor-pqc:dsa87:<sha256(publicKey)[0..32]>`
5. The Transaction Agent and the GrantVault smart account verify:
   - Payload SHA-256 digest matches signature bundle.
   - Public key fingerprint matches registered authenticator.
   - ML-DSA-87 cryptographic polynomial verification succeeds.

---

## 3. Account Abstraction & Scoped Permissions

```
+-----------------------------------------------------------+
|              QoreChain Smart Account Root                 |
|             (Held by Grant Pool Administrator)            |
+-----------------------------+-----------------------------+
                              |
                Delegates Time-Bounded Role
                              |
                              v
+-----------------------------------------------------------+
|              Scoped Agent Authenticator Key               |
|                                                           |
| - Max Spend Per Transaction: 5,000 QOR                    |
| - Daily Limit: 15,000 QOR                                 |
| - Time-To-Live (TTL): 7,200 Seconds (2 Hours)             |
| - Target Contract Whitelist: [GrantVault.sol only]        |
| - Beneficiary Enforced by Canonical Decision Hash         |
| - Immediate Revocation Hook: active                       |
+-----------------------------------------------------------+
```

---

## 4. Key Management & Rotation Protocol

- **Demonstration vs Production**: Demo mode uses locally derived ML-DSA-87 test keys with distinct fingerprints. Testnet and mainnet keys are provisioned through QoreX wallet and Diana Testnet credentials.
- **Zero Secret Exposure**: Neither secret keys nor encryption passphrases are ever sent over API responses or exposed in frontend code.
- **Audited Rotation**: The Security Centre provides an authenticated `/api/security/rotate-keys` endpoint that generates a fresh ML-DSA-87 keypair, archives the previous key with an audit trail, and re-encrypts the active keystore.
