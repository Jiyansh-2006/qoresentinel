# QoreSentinel Architecture Specification

QoreSentinel is an autonomous microgrant allocation platform built for the **QoreChain Developer Fest 2026 – Build Before Q-Day**.

---

## 1. High-Level System Architecture

```
+-----------------------------------------------------------------------------------+
|                                 QoreSentinel UI                                   |
| (React + Vite + Tailwind CSS + Framer Motion + TanStack Query + Dark Fintech UX)  |
+------------------------------------------+----------------------------------------+
                                           | REST APIs + SSE Real-Time Stream
                                           v
+-----------------------------------------------------------------------------------+
|                              Express API & Pipeline                               |
|        - Request Validation (Zod)              - Session & Wallet Authenticator   |
|        - Server-Sent Events (SSE) Bus          - Dual DB Repository (Prisma/Mem)  |
+------------------------------------------+----------------------------------------+
                                           |
                   +-----------------------+-----------------------+
                   |                                               |
                   v                                               v
+--------------------------------------+       +------------------------------------+
|     Autonomous Multi-Agent Layer     |       |    Post-Quantum Cryptography       |
|                                      |       |                                    |
| 1. Intake Agent (Sanitize & IDs)     |       | - NIST FIPS 204 ML-DSA-87 Level 5  |
| 2. Document Verification Agent (OCR) |<----->| - Canonical JSON (RFC 8785 JCS)    |
| 3. Eligibility Agent (Criteria Match)|       | - SHA-256 Canonical Message Digest |
| 4. Fraud & Duplicate Detection Agent |       | - AES-256-GCM Keystore Encryption  |
| 5. Financial Policy Agent (Integers) |       | - Keypair Fingerprinting & Rotate  |
| 6. Decision Coordinator Agent        |       +------------------------------------+
| 7. Autonomous Transaction Agent      |
+--------------------------------------+
                   |
                   v
+-----------------------------------------------------------------------------------+
|                        QoreChain Diana Testnet Layer                              |
|                                                                                   |
|  - EVM Chain ID: 9800 | Native Chain ID: qorechain-diana                          |
|  - Account Abstraction (x/abstractaccount) & Scoped Agent Authenticators          |
|  - Spending Rules: Per-Tx Cap, Daily Pool Ceiling, Expiry Windows                 |
|  - GrantVault.sol Contract: ReentrancyGuard, Pausable, Milestone Tranches         |
|  - Native PQC Precompile Evaluation (0x0000000000000000000000000000000000000a01)  |
+-----------------------------------------------------------------------------------+
```

---

## 2. Multi-Agent Pipeline Workflow

1. **Intake**: Parses proposal metadata, validates EVM addresses (`0x...`), assigns deterministic application ID.
2. **Document Verification**: Computes SHA-256 document digests, parses OCR keywords, builds evidence root hash.
3. **Eligibility**: Analyzes proposal scope against pool category, grant ceiling, and phased milestone definitions.
4. **Fraud Detection**: Cross-references applicant email, project title, and cryptographic hashes against existing historical submissions to flag Sybil patterns.
5. **Financial Policy**: Evaluates treasury balances and milestone tranches in integer base units (`uqor` / `wei`). Zero floating-point math.
6. **Coordinator**: Evaluates deterministic decision matrix. If approved, emits `CanonicalDecisionPayload` and triggers ML-DSA-87 signing.
7. **Transaction Agent**: Verifies ML-DSA-87 signature, confirms active EVM authorization window, checks remaining daily allowance, and calls `GrantVault.releaseGrant()`.

---

## 3. Post-Quantum Signing Flow

```
Raw Decision Data
       │
       ▼
RFC 8785 Canonical JSON Serialization (Lexicographic Key Ordering)
       │
       ▼
SHA-256 Digest Computation (32 Bytes)
       │
       ▼
NIST FIPS 204 ML-DSA-87 Signing (Security Level 5, 4627-Byte Signature)
       │
       ▼
Bundled PQCSignatureBundle (Fingerprint + Signature Hex + Digest Hex)
       │
       ▼
On-Chain Precompile / Smart Contract Authorisation Verification
```

---

## 4. Smart Account Boundary Security

The Autonomous Transaction Agent **never** holds root wallet keys:
* Operates through a time-bounded **Scoped EVM Authorization Window** (e.g. 2 hours).
* Per-transaction payment limit enforced on-chain.
* Daily cumulative cap resets every 24 hours.
* Target contract whitelist: Agent cannot call arbitrary contracts or unapproved recipient addresses.
* Instant administrator killswitch (`revokeAgent`).
