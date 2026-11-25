# QoreSentinel Threat Model & Security Analysis

This threat model outlines potential attack vectors against an autonomous grant allocation system, their impact, and QoreSentinel's multi-layered mitigations.

---

## Threat Matrix

| Threat ID | Threat Description | Attack Vector | Severity | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **THREAT-01** | **Compromised AI Agent** | Malicious prompt injection or model hallucination attempting to approve invalid grants | **HIGH** | **Dual Deterministic Policy Gates**: Even if an LLM is tricked into recommending approval, deterministic code gates verify exact integer bounds, category matching, and historical duplicate records. AI makes recommendations; code enforces rules. |
| **THREAT-02** | **Signature Tampering & Replay** | Adversary alters beneficiary address or approved amount in transit | **CRITICAL** | **RFC 8785 Canonical Serialization + ML-DSA-87**: Any byte change in payload creates an immediate SHA-256 digest mismatch and invalidates the lattice signature. The smart contract additionally marks decision hashes as executed, preventing replay. |
| **THREAT-03** | **Sybil & Duplicate Proposals** | Applicant submits same proposal with slight variations or conflicting wallets | **MEDIUM** | **Cross-Proposal Hash Matrix**: FraudDetectionAgent computes SHA-256 digests of all uploaded evidence documents and flags matches against historical records across all applicant identities. |
| **THREAT-04** | **Runaway Agent / Treasury Drain** | Compromised agent loop attempts to drain vault treasury | **CRITICAL** | **Smart-Account Spending Rules**: Enforced directly on Diana Testnet via `GrantVault.sol`. Max per-transaction ceiling and 24-hour daily cumulative limits make an automated treasury drain mathematically impossible. |
| **THREAT-05** | **Expired Session Exploitation** | Transaction dispatched after authorization window closes | **HIGH** | **Timestamped EVM Authorization Window**: GrantVault reverts any transaction submitted after `authorizationExpiry`. Frontend and backend countdown monitors expiry continuously. |
| **THREAT-06** | **Smart Contract Reentrancy** | Malicious beneficiary fallback contract re-enters vault during payment | **CRITICAL** | **OpenZeppelin ReentrancyGuard + Checks-Effects-Interactions**: State variables (`totalPaidAmount`, `currentMilestoneIndex`, `isReleased`) are updated before the external ETH/QOR transfer is invoked. |
| **THREAT-07** | **Prompt Injection via Uploaded PDFs** | Attacker embeds adversarial prompt text inside uploaded whitepaper | **MEDIUM** | **Untrusted Content Treatment**: Document text is never passed directly into execution commands. OCR extracts only structured keywords against an allowed whitelist, and document digests are treated as opaque hashes. |
| **THREAT-08** | **Key Compromise of Local Machine** | Attacker accesses server filesystem | **HIGH** | **AES-256-GCM Keystore Encryption**: Private keys are stored encrypted at rest with PBKDF2 key derivation (100,000 iterations). Plaintext keys are never written to disk or logged. |

---

## Security Invariants

1. `Vault Balance >= Sum(Pool Remaining Budgets)`
2. `Agent Disbursed Amount <= Agent Max Spend Per Tx`
3. `Daily Disbursed Amount <= Pool Daily Cap`
4. `Current Milestone Index == Completed Milestones Count` (Strict Sequential Release)
5. `Decision Hash Execution Count == 1` (Strict Idempotency)
