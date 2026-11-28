# QoreChain stack coverage

This is a mapping of the technologies shown in the QoreChain screenshots to project code or isolated companion manifests. It avoids claiming that an installable package is an active product feature.

## Product runtime and selected capabilities

| Screenshot area | Languages/packages | Project integration |
| --- | --- | --- |
| QoreChain SDK | TypeScript, React, EVM, SVM; Python, Rust, Go, Java | TypeScript packages are used by the API/web app. The other SDK families are listed in `integrations/` manifests. |
| `create-qorechain-dapp` | TypeScript CLI | Root `scaffold:qorechain` script and isolated TypeScript toolchain. |
| `qorechain-pqc` | TypeScript, Python, Rust, Go, Java (C source is also available upstream) | TypeScript package is used by the API; other language packages are in isolated manifests. |
| QoreSign | TypeScript, Rust, Go, Swift, Kotlin/JVM, Kotlin/Android, Python | Isolated TypeScript, Rust, Go, Python, JVM, Swift, and Android manifests. |
| QoreSeal | TypeScript, Rust, Go, Python, Swift, Kotlin/JVM, Kotlin/Android | Isolated language manifests. Not used to encrypt production student records. |
| QoreX integrations | TypeScript provider types and React adapters | Existing native/EVM QoreX integration remains in the app; companion manifest includes the React adapter families and test tools. |
| Wallet adapter | TypeScript | Isolated optional dependency because its CosmJS peer range conflicts with the app's CosmJS 0.39 dependency. |
| RDK | TypeScript, CLI, Python, Rust, Go, Java | Isolated package/toolchain manifests. No rollup is deployed by this project. |
| MCP + `qore` CLI | TypeScript server, TypeScript CLI, Python | Isolated TypeScript and Python manifests. These tools are read-only. |
| Asset Kit | TypeScript, Python, Go, Java, Solidity | Client dependencies and Foundry config are included. Native-module calls only run against mocks; Solidity contracts are testnet-only. |
| QoreScan | npm CLI, PyPI wrapper, Go CLI | npm/Python/Go tool declarations are included. It inventories; it does not certify. |
| Custody Kit | TypeScript, Python, Go, Rust, Java | Upstream reference-kit usage is documented; Go module and language sources are identified in the companion guide. |
| Chain bridge | TypeScript Node.js server | Included in isolated TypeScript manifest; not wired to an endpoint that can broadcast automatically. |
| Handles | TypeScript | Included in isolated TypeScript manifest; production use requires a trusted registry key and application pin store. |
| PQ light client | TypeScript, Rust, Go | Isolated manifests; test/reference checkpoints only, no live chain connection. |

## What the active app does

- `apps/web` and `apps/api` remain TypeScript-first; the web app is React + TypeScript.
- The API uses the QoreChain SDK and EVM chain adapter for account/PQC operations and scoped grant transactions.
- The Security page reads QoreX native account PQC registration/proof status and checks the SVM endpoint's confirmed slot.
- Native transfer UI displays the hybrid-signature result returned by QoreX.
- Backend registration creates and locally verifies a proof of possession, broadcasts the key registration, then requires the network to confirm registration and the proof before opening an EVM window.
- The Security page includes a read-only Network Features panel backed by `GET /api/network/features`. It queries Diana Testnet for PQC protocol features, smart-account configuration, RDK/Cross-VM/staking parameters, AMM pools, IBC channels, ERC-20 token pairs, EVM chain ID, and connected-account PQC/EVM-window/QoreSeal status.
- The panel deliberately labels setup-only or externally operated features (light nodes, Native contracts, sidechains, QORel, MCP/CLI, and QoreScan) instead of reporting them as deployed. It never submits transactions or starts a relayer.

## Running and claiming support

Use `integrations/README.md` for environment-specific install commands. On this Windows development machine, Node.js and Python are present; Go and Rust toolchains are not currently installed. Swift builds require macOS/Xcode. Android builds require Android Studio/SDK. Those language manifests are therefore present but were not compiled here.

Published packages and source-only kits change independently. Confirm their upstream versions and network support before using them in production. The QoreChain package catalog is documented at [Developer Packages](https://docs.qorechain.io/developer-tools/overview/) and the language SDK family at [SDK Overview](https://docs.qorechain.io/sdk/overview/).
