# 3-minute hackathon demo script

## 0:00–0:20 — Problem

“Small community grants are often slow, opaque, and hard to audit. Giving an AI agent a treasury key creates a second problem: the agent can make mistakes or be compromised. QoreSentinel separates intelligence from authority.”

## 0:20–0:55 — Agent pipeline

Open the dashboard and Applications. Select the STEM Lab sample and show the Intake, Evidence, Duplicate, Eligibility, Policy, and Treasury checks. Explain that the optional LLM writes the explanation only; the deterministic policy engine makes the decision.

## 0:55–1:25 — Adversarial examples

Select the over-budget request and the duplicate. Show that the policy blocks them before execution and gives specific reasons. Explain that a forged or incomplete evidence attestation would also be blocked in the production evidence-verifier module; the hackathon MVP currently demonstrates HTTPS reference + digest checks only.

## 1:25–2:10 — Post-quantum and transaction boundaries

Open Security. Show the ML-DSA-87 agent public key and explain that the payout command is signed and verified before it reaches the transaction layer. Show the QoreChain PQC key registration / hybrid-signed Native EVM-window flow. The window is scoped to the deployed GrantVault and bounded by blocks, transaction count and value.

## 2:10–2:45 — On-chain vault

Show the GrantVault source: only the executor can pay; every grant is capped; programme outflow is capped; application IDs cannot be paid twice; owner can pause. If live testnet is configured, execute one small grant and open the explorer receipt. Otherwise use Demo Mode and clearly label the payout as simulated.

## 2:45–3:00 — Close

“QoreSentinel does not ask the model to be trusted. The model helps interpret, deterministic rules decide, ML-DSA authenticates agent intent, QoreChain bounds the execution window, and the contract enforces the final payout limits.”
