# Build report — QoreSentinel

## Implementation plan and current state

1. **Frontend and navigation — implemented.** Responsive React dashboard with pool, application, agent, security, audit, and transaction screens.
2. **Backend and persistence — implemented with SQLite.** Express APIs, role-based sessions, SQLite records, SSE activity, and receipt-verified ledger. Prisma schema is tooling only; PostgreSQL is not the runtime database.
3. **Agent orchestration — implemented as deterministic custom orchestration.** Seven named review stages emit API events; Groq is optional and only writes explanatory text. Execution reports now persist in SQLite.
4. **GrantVault — implemented and locally tested.** Hardhat contract and failure-path tests are present.
5. **QoreChain Diana — integration implemented, live transaction not verified.** Uses the official `@qorechain/sdk` package for native PQC/window operations and standard EVM tooling for contract calls.
6. **PQC and delegated permissions — partially implemented.** ML-DSA-87 decision signatures and chain PQC registration/window operations exist. The payout signer is still administrator-controlled; a restricted delegated authenticator is not yet the signer for GrantVault payouts.
7. **End-to-end readiness — local checks pass; live chain and deployment are unverified.** See limitations below.

## Implemented in this handoff

- React + TypeScript responsive dashboard with Overview, Applications, Agent network, Security, and Transactions views.
- Express API with Zod input validation and SQLite persistence.
- Demo seed data for one passing application, one over-budget application, and one duplicate.
- Multi-agent review pipeline with seven named stages and deterministic policy as the final veto.
- Optional Groq explanation endpoint; model output cannot change policy results.
- ML-DSA-87 agent-command signing and verification via `@qorechain/pqc`.
- QoreChain Diana testnet adapter using `@qorechain/sdk` 0.14.x and CosmJS for PQC registration / hybrid EVM-window authorisation.
- Scoped EVM window opens for 1,200 blocks, five transactions, a 5,000,000 uqor value budget, and the GrantVault allowlisted target.
- Smart-account spending-rule configuration support; the delegated authenticator is not yet linked or used by the payout execution path.
- Solidity GrantVault with executor access, per-grant and programme caps, duplicate-payment protection, pause, and events.
- viem transaction simulation, pre-broadcast window/target checks, receipt confirmation, and explorer link.
- Dockerfiles, compose file, README, threat model, AI disclosure, and MIT license.

## Checks run in this environment

- Monorepo TypeScript and Vite production build: **passed**.
- API tests: **24 passed**.
- ML-DSA-87 crypto tests: **5 passed**.
- GrantVault Hardhat tests: **12 passed**.
- Live Diana Testnet transaction: **not performed or claimed**.

## Not complete / must be done before claiming full production readiness

- A restricted delegated authenticator is not yet linked and used as the GrantVault payout signer; live payout remains administrator-controlled.
- Replace the process-local agent ML-DSA key with a persistent, protected signer.
- Configure actual OCR and issuer-signed evidence attestations; current document inspection hashes evidence and uses deterministic metadata keyword checks.
- Add auth/RBAC/MFA, rate limits, idempotency/outbox, PII encryption, and audit-grade key management.
- Audit and fuzz the Solidity contract and end-to-end payout workflow.
- Replace SQLite with PostgreSQL if the deployment requires the requested PostgreSQL runtime.

Do not represent the application as deployed, audited, or live until the missing steps are completed and testnet transactions are verified.
