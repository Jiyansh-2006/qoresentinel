# Build report — QoreSentinel

## Implemented in this handoff

- React + TypeScript responsive dashboard with Overview, Applications, Agent network, Security, and Transactions views.
- Express API with Zod input validation and SQLite persistence.
- Demo seed data for one passing application, one over-budget application, and one duplicate.
- Multi-agent review pipeline with six named agents and deterministic policy as the final veto.
- Optional Groq explanation endpoint; model output cannot change policy results.
- ML-DSA-87 agent-command signing and verification via `@qorechain/pqc`.
- QoreChain Diana testnet adapter using `@qorechain/sdk` 0.14.x and CosmJS for PQC registration / hybrid EVM-window authorisation.
- Scoped EVM window opens for 1,200 blocks, five transactions, a 5,000,000 uqor value budget, and the GrantVault allowlisted target.
- Smart-account spending-rule configuration message for a linked session/authenticator rule.
- Solidity GrantVault with executor access, per-grant and programme caps, duplicate-payment protection, pause, and events.
- viem transaction simulation, pre-broadcast window/target checks, receipt confirmation, and explorer link.
- Dockerfiles, compose file, README, threat model, AI disclosure, and MIT license.

## Checks run in this environment

- TypeScript / TSX syntax transpilation: **passed** for all TypeScript source files.
- Deterministic policy smoke tests: **passed** (valid application approved at 100, over-cap application blocked, duplicate application blocked).
- Full npm dependency installation: **not completed**; repeated `npm install` calls timed out in this environment. Therefore a full `tsc` build, Vite production build, Hardhat compile, and live Diana testnet transaction have **not** been verified here.

## Not complete / must be done before claiming full production readiness

- The current payout call uses the unified account's owner EVM key. The smart-account spending rule is configured for linked authenticators/session keys, but the delegated agent authenticator is not yet linked and used for payouts. The root owner key is not constrained by those authenticator rules.
- Replace the process-local agent ML-DSA key with a persistent, protected signer.
- Replace evidence URL hashing with file-content hashing and issuer-signed evidence attestations.
- Add auth/RBAC/MFA, rate limits, idempotency/outbox, PII encryption, and audit-grade key management.
- Audit and fuzz the Solidity contract and end-to-end payout workflow.

Do not represent the application as deployed, audited, or live until the missing steps are completed and testnet transactions are verified.
