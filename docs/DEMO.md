# QoreSentinel Hackathon Demonstration Guide

## QoreChain Developer Fest 2026 – Build Before Q-Day
**Project:** QoreSentinel – Autonomous Post-Quantum Microgrant Allocation Platform

---

## 1. 3-Minute Live Demonstration Script

### **[0:00 - 0:30] Introduction & The Post-Quantum Problem**
> *"Judges, grants fund the future of Web3, but current grant operations are plagued by human bureaucracy, opaque committee delays, and classical cryptography vulnerable to Q-Day. Today we present **QoreSentinel**: an autonomous microgrant allocation vault combining a specialized 7-agent AI pipeline with NIST FIPS 204 ML-DSA-87 post-quantum digital signatures and QoreChain smart accounts."*

**Visual Action:**
- Show the Landing Page with the metric bar highlighting:
  - NIST FIPS 204 (Level 5) ML-DSA-87
  - QoreChain Diana Testnet (Chain ID 9800)
  - 7 Specialized Autonomous Agents
  - Scoped EVM Smart Account Authenticator

---

### **[0:30 - 1:15] Scenario 1: Valid Application & Autonomous Payout**
> *"Here in the Proposal Pipeline, we have a research proposal from Dr. Evelyn Reed requesting 3,500 QOR for an ML-DSA-87 verification precompile. Let's trigger the autonomous evaluation pipeline."*

**Visual Action:**
1. Click on **`app_demo_valid_001`** (LatticeGuard proposal).
2. Click **"Run AI Agent Analysis Pipeline"**.
3. Watch the real-time pipeline execute:
   - **Intake Agent**: Sanitizes beneficiary address `0x7099...79C8`.
   - **Document Agent**: Computes SHA-256 evidence digests and verifies synthetic whitepaper.
   - **Eligibility Agent**: Confirms `POST_QUANTUM_CRYPTO` category match and 3-phase milestone plan.
   - **Fraud Agent**: Confirms zero Sybil duplicate collisions.
   - **Financial Policy Agent**: Validates 3,500 QOR is within the 5,000 QOR pool limit.
   - **Coordinator Agent**: Renders verdict **APPROVED**, generates RFC 8785 canonical JSON payload, and signs with **NIST FIPS 204 ML-DSA-87**.
   - **Transaction Agent**: Validates the PQC signature, verifies the active EVM authorization window, and calls `GrantVault.releaseGrant()`.
4. Status turns **PAID / DISBURSED**.
5. Transaction hash appears with direct link to QoreChain Diana Testnet Explorer!

---

### **[1:15 - 2:00] Scenario 2: Fraud & Duplicate Proposal Defense**
> *"Now let's observe what happens when a Sybil actor attempts to clone the previous proposal and double-dip the treasury using a different wallet."*

**Visual Action:**
1. Select **`app_demo_duplicate_002`** (Clone proposal).
2. Click **"Run AI Agent Analysis Pipeline"**.
3. **Fraud Detection Agent** detects cryptographic collision on `LatticeGuard_Technical_Whitepaper.pdf` hash and matching applicant email.
4. Risk score spikes to 100/100.
5. Decision Coordinator renders verdict **REJECTED BY POLICY**.
6. **Zero funds are disbursed**. The smart contract is never invoked.

---

### **[2:00 - 2:30] Scenario 3: Overbudget & Inconsistent Proposal Defense**
> *"Next, an applicant requests 12,000 QOR—exceeding the pool's 5,000 QOR maximum limit—with line items that don't add up."*

**Visual Action:**
1. Select **`app_demo_invalid_003`** (Overbudget Research Consortium).
2. Click **"Run AI Agent Analysis Pipeline"**.
3. **Financial Policy Agent** evaluates integer base units and immediately flags ceiling violation.
4. Verdict is **REJECTED BY POLICY**.

---

### **[2:30 - 3:00] Security Centre & Revocation Killswitch**
> *"Finally, let's inspect the Security Centre. Here is our active ML-DSA-87 public key fingerprint and our scoped EVM session countdown. What if an agent is suspected of compromise? In one click, the administrator revokes the agent authenticator."*

**Visual Action:**
1. Navigate to **Security & PQC Centre**.
2. Show the ML-DSA-87 fingerprint and the live 2-hour EVM window countdown.
3. Click **"Revoke Authenticator"**.
4. Agent permissions are revoked; status turns to **REVOKED**.
5. Even if an agent attempted to execute a payment, `GrantVault.sol` immediately reverts on-chain!

---

## 2. 16:9 Cover Image Concept

```
+-----------------------------------------------------------------------------------+
|  [Background: Deep Navy / Charcoal Cyber-Grid with Subtle Quantum Lattice Lines]  |
|                                                                                   |
|            🛡️  Q O R E S E N T I N E L                                            |
|                                                                                   |
|     AUTONOMOUS POST-QUANTUM MICROGRANT ALLOCATION PLATFORM                        |
|                                                                                   |
|  [Left: 7 Specialized AI Agents]   [Center: NIST FIPS 204]   [Right: QoreChain]   |
|   - Intake & OCR Verification       - ML-DSA-87 Lattice       - Diana Testnet     |
|   - Fraud & Sybil Defense           - Canonical RFC 8785      - GrantVault.sol    |
|   - Integer Base Unit Policies      - 4,627-Byte Signatures   - Scoped EVM Window |
|                                                                                   |
|            "AI Recommends. Cryptography & Smart Contracts Enforce."               |
+-----------------------------------------------------------------------------------+
```
- **Dimensions**: 1920 × 1080 px (16:9 widescreen)
- **Palette**: Neon Cyan (`#00f0ff`), Cobalt Blue (`#3b82f6`), Charcoal Surface (`#0d1322`), Obsidian (`#070b14`).
- **Typography**: Space Grotesk / Inter with Monospace code accents.
