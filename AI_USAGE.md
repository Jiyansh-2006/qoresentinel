# AI Usage Disclosure & Engineering Methodology

**Project:** QoreSentinel  
**Event:** QoreChain Developer Fest 2026 – Build Before Q-Day  

---

## 1. AI Assistance Summary

In compliance with hackathon guidelines, this document details the AI tools and methodologies employed during the design, implementation, and auditing of QoreSentinel.

### AI Systems Used:
* **Large Language Models**: Used for architectural scaffolding, TypeScript interface definitions, synthetic grant proposal dataset generation, and threat model analysis.
* **Autonomous Agent Pipeline**: The product itself implements a specialized 7-agent pipeline designed to parse, evaluate, and audit microgrant proposals with deterministic safety guarantees.

---

## 2. Cryptographic Rigor & Verification

* **Zero Hand-Rolled Cryptography**: Cryptographic operations rely on `@noble/post-quantum`, an auditable, peer-reviewed implementation of NIST FIPS 204 (Module-Lattice-Based Digital Signature Algorithm).
* **FIPS 204 Standard Adherence**: The ML-DSA-87 implementation uses exact NIST parameter vectors (Security Level 5, 2592-byte public key, 4896-byte private key, 4627-byte signature).
* **Deterministic Normalization**: JSON payloads are strictly formatted according to RFC 8785 JSON Canonicalization Scheme (JCS) before computing SHA-256 digests.

---

## 3. Human Oversight & Deterministic Boundaries

A primary tenet of QoreSentinel is:
**"AI makes recommendations; cryptographic verification, deterministic policies, and smart contracts enforce permissions."**

* LLM inference or agent heuristics are **strictly prohibited** from directly moving funds or modifying contract storage.
* Payout amounts are checked against integer base units (`uqor` / `wei`) via deterministic code.
* The Autonomous Transaction Agent executes transactions only when an unexpired, cryptographically valid session key exists and the requested amount is within on-chain spending limits.
