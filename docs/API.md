# QoreSentinel REST API Documentation

The QoreSentinel backend exposes structured REST endpoints and a Server-Sent Events (SSE) live stream.

Base URL: `http://localhost:4000/api`

---

## 1. Dashboard

### `GET /api/dashboard/stats`
Returns aggregated treasury stats, pool counts, application breakdown, and network status.
```json
{
  "totalPools": 2,
  "totalAllocatedQOR": 18000,
  "totalDisbursedQOR": 1400,
  "pendingApplications": 0,
  "approvedApplications": 1,
  "rejectedApplications": 0,
  "completedDisbursements": 1,
  "activeAgentsCount": 7,
  "network": {
    "name": "QoreChain Diana Testnet",
    "chainId": 9800,
    "pqcStandard": "NIST FIPS 204 ML-DSA-87",
    "authenticatorStatus": "ACTIVE"
  }
}
```

---

## 2. Grant Pools

### `GET /api/pools`
List all active grant funding pools.

### `POST /api/pools`
Create a new funding pool.
```json
{
  "title": "Quantum Privacy Research Pool",
  "description": "Funding for zero-knowledge lattice implementations",
  "category": "PRIVACY_ZERO_KNOWLEDGE",
  "totalBudgetQOR": 25000,
  "maxGrantQOR": 4000,
  "dailyCapQOR": 8000,
  "eligibilityCriteria": ["Open-source", "ZKP proofs"],
  "requiredDocuments": ["Spec", "Budget"]
}
```

### `POST /api/pools/:id/deposit`
Deposit additional testnet QOR funds into a pool.

---

## 3. Grant Applications

### `GET /api/applications`
List all submitted applications with their current evaluation status.

### `GET /api/applications/:id`
Inspect a specific proposal, including its multi-agent evaluation, decision payload, and transaction receipts.

### `POST /api/applications`
Submit a microgrant application.

### `POST /api/applications/:id/analyse`
Executes the full 7-agent evaluation pipeline on a proposal, emits real-time SSE progress, generates canonical ML-DSA-87 signature, and triggers smart contract disbursement.

---

## 4. AI Agents & Real-Time Stream

### `GET /api/agents`
Returns metadata and operational status for all 7 specialized agents.

### `GET /api/agents/activity`
Returns the recent execution log of all autonomous agent actions.

### `GET /api/agents/stream` (Server-Sent Events)
Live event stream subscribed to by the frontend dashboard. Emits `agent_event` and `audit_event` in real time.

---

## 5. Security & Post-Quantum Cryptography

### `GET /api/security/status`
Returns PQC registration status, active ML-DSA-87 public key fingerprint, authenticator spending rules, and EVM authorization window status.

### `POST /api/security/authorise`
Opens or extends the scoped EVM authorization window (`durationSeconds`).

### `POST /api/security/revoke`
Immediately revokes the agent session authenticator, halting all smart contract payouts.

### `POST /api/security/rotate-keys`
Rotates the active ML-DSA-87 post-quantum keypair and encrypts the new keystore.

---

## 6. Transactions & Audit

### `GET /api/transactions`
Returns all executed transactions with Diana Testnet explorer links and block receipts.

### `GET /api/audit`
Returns the tamper-evident chronological audit trail with SHA-256 integrity hashes.
