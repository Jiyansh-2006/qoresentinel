# QoreSentinel

[![CI](https://github.com/Jiyansh-2006/qoresentinel/actions/workflows/ci.yml/badge.svg)](https://github.com/Jiyansh-2006/qoresentinel/actions/workflows/ci.yml)

QoreSentinel is a QoreChain microgrant platform prototype. It combines a seven-step application review pipeline, deterministic grant policies, ML-DSA-87 decision signing, and a receipt-verified ledger for pool funding and grant payouts.

**Important:** this repository is not a production-ready grant service. AI agents assist with review, but they do not have authority to approve or pay grants. Live EVM payouts require an administrator to initiate the flow, a connected wallet to sign, and the API to verify the resulting QoreChain receipt and contract event.

## What it does

- Accepts grant applications and supporting documents.
- Runs intake, document-hash, eligibility, fraud, financial-policy, decision, and transaction checks.
- Signs deterministic decisions with ML-DSA-87.
- Lets administrators create and fund pools and initiate approved milestone payouts.
- Counts funds as deposited or distributed only after successful receipts and matching GrantVault events are verified.
- Persists accounts, sessions, applications, pools, decisions, audit records, and transaction ledger data in SQLite.
- Provides role-scoped student and administrator dashboards, activity feeds, and server-sent event updates.
- Offers an optional Groq-powered explanation and a separate website-help assistant.

Demo activity is clearly distinguished from live transactions. A simulated review, demo pool, wallet-reported transfer, pending receipt, or failed transaction is not counted as a verified grant payment.

## Technology

- **Web:** React, TypeScript, Vite, Tailwind CSS
- **API:** Node.js, Express, TypeScript, Zod
- **Runtime storage:** SQLite via `better-sqlite3`
- **Cryptography:** ML-DSA-87, SHA-256, AES-GCM keystore support
- **Contracts:** Solidity and Hardhat
- **Network target:** QoreChain Diana Testnet (EVM chain ID `9800`)

Prisma models and scripts are included for schema tooling, but the running API currently uses `DATABASE_PATH` with `better-sqlite3`; it does not use Prisma as its runtime data layer.

## Repository layout

```text
apps/
  api/          Express API, review pipeline, SQLite persistence
  web/          React frontend
contracts/      GrantVault contract, Hardhat config and tests
docs/           Architecture, demo, security, and threat-model documents
packages/
  crypto/       ML-DSA-87 signing and keystore utilities
  shared/       Shared types, schemas, and QoreChain constants
prisma/         Prisma schema for tooling
```

## Requirements

- Node.js 20 or newer
- npm
- Git
- Optional: Docker Compose, a Groq API key, and a QoreX wallet configured for Diana Testnet

## Local development

From the repository root in PowerShell:

```powershell
npm install
Copy-Item .env.example .env
```

Edit `.env` for your setup. At minimum, keep `DATABASE_PATH` writable. The following settings enable optional features:

| Variable | Purpose |
| --- | --- |
| `ADMIN_INVITATION_CODE` | Private invitation required for administrator registration. Leave empty to disable it. |
| `GROQ_API_KEY` | Enables assistant responses and optional plain-language review explanations. |
| `QORECHAIN_CONTRACT_ADDRESS` | GrantVault address used for receipt verification and live pool funding. |
| `MLDSA_KEY_ENCRYPTION_SECRET` | Private value of at least 32 characters, required by the key-rotation endpoint. |
| `VITE_WALLETCONNECT_PROJECT_ID` | Optional WalletConnect project ID for wallet pairing. |
| `APP_ORIGINS` | Comma-separated browser origins permitted by the API. |

Never commit `.env`, wallet private keys, invitation codes, Groq keys, or encryption secrets. Generate private secrets locally or use a secrets manager. The `.env.example` contains placeholders only.

Build workspace packages before starting the API:

```powershell
npm run build -w @qoresentinel/shared
npm run build -w @qoresentinel/crypto
```

Start the API and web app in separate terminals:

```powershell
npm run dev:api
```

```powershell
npm run dev:web
```

Open [http://localhost:5173](http://localhost:5173). The API listens on port `4000`; Vite proxies `/api` requests to it. Create a student account to submit and track applications. Administrator registration requires `ADMIN_INVITATION_CODE`.

## Build and tests

```powershell
npm run build -w @qoresentinel/shared
npm run build -w @qoresentinel/crypto
npm run build -w @qoresentinel/api
npm test -w @qoresentinel/api
npm run build -w @qoresentinel/web
npm run test:crypto
npm run test:contracts
```

The API test command runs the compiled tests, so build the API first. Prisma schema validation can be run with:

```powershell
$env:DATABASE_URL = "file:./prisma/dev.db"
npx prisma validate --schema=prisma/schema.prisma
```

GitHub Actions runs these build and test checks automatically on every push and pull request targeting `main`.

## Verified QOR accounting

GrantVault pool budgets and grant payouts use 18-decimal base units. Native QoreChain wallet transfers use `uqor` with 6 decimals; these units are not interchangeable.

For live GrantVault operations, the API records an intent and later verifies the submitted transaction against the configured network, contract, sender, pool/application, recipient, amount, milestone, and emitted event. Only verified events update live pool balances or grant distribution totals. Pending, failed, simulated, and user-reported wallet transfers remain separate.

The web app cannot switch a QoreX wallet's active network. Confirm the network in the wallet before signing. Live EVM grant operations currently target Diana Testnet (chain ID `9800`); do not use this prototype to handle funds you cannot afford to lose.

## Docker Compose

The Compose setup serves the web app on port `5173`, proxies `/api` requests to the API container on port `4000`, and stores the API SQLite file in a named volume.

1. Copy `.env.example` to `.env`.
2. Set any secrets and network configuration required for the features you intend to use.
3. Build and start:

```powershell
docker compose up --build
```

The web image is built with `VITE_WALLETCONNECT_PROJECT_ID`; set it before building if WalletConnect pairing is needed. Treat Compose as a local/demo deployment, not a production-hardening guide.

## Current limitations

- No live Diana Testnet transaction is claimed or tested by this repository handoff.
- Document verification hashes uploaded evidence; OCR or issuer verification is not configured.
- The Groq assistant is optional and cannot change deterministic decisions or execute transactions.
- Email verification and password recovery are not implemented.
- Agent execution history is held in API memory and is lost when the API restarts.
- Wallet-reported native transfers are not independently verified by the API.
- Review the deployment, key management, privacy, and contract assumptions before any production use.

## License

MIT. See [LICENSE](LICENSE).
