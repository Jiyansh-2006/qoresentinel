# QoreChain integrations

QoreSentinel is TypeScript-first. The QoreChain additions are wired into the existing React web app and Express API:

| Integration | Where it is used |
| --- | --- |
| `@qorechain/sdk` | API account derivation, chain status, scoped EVM windows, PQC status, ML-DSA proof-of-possession creation and verification, and Qore-native signing. |
| `@qorechain/evm` | Diana Testnet chain configuration for viem grant calls. |
| `@qorechain/react` | Web provider and PQC account-status hook. |
| `@qorechain/svm` | Read-only SVM endpoint health check (confirmed slot); this app does not submit SVM transactions. |
| `@qorechain/qorex-types` | Existing QoreX provider typing and native wallet transaction integration. |
| `create-qorechain-dapp` | CLI scaffold available as `npm run scaffold:qorechain -- <name> --template fullstack-web --no-install`. |

## PQC key registration

When the API opens its scoped EVM window, it checks whether the derived account's ML-DSA-87 key is registered. If not, it verifies that Diana Testnet supports proof-of-possession registration, creates and locally validates the proof, submits the registration with the classical Qore signer, then checks that the chain reports both registration and proof. It stops if the network cannot confirm these conditions.

QoreX native wallet registration is initiated by the wallet when the user approves a native transaction. The Security page reports the connected account's on-chain registration and proof status. No wallet action or paid on-chain transaction is performed just by loading the page.

## Networks and boundaries

- EVM grant transactions target QoreChain Diana Testnet (`9800`) and use the configured EVM RPC.
- The SVM integration only reads a confirmed slot because public SVM transaction submission is disabled.
- QoreX transfers still require the connected user's explicit wallet approval.
- The scaffold command generates a separate starter project; it does not overwrite QoreSentinel.

After installing dependencies, build all TypeScript workspaces with `npm run build`.
