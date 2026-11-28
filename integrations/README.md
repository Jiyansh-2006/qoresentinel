# QoreChain polyglot integrations

This repository keeps its deployed product TypeScript-first. The code under `integrations/` adds **isolated companion toolchains** for the other languages and tools in the QoreChain ecosystem. They are intentionally not npm workspaces: some have different runtime/compiler requirements, and the wallet adapter's CosmJS peer range conflicts with the app's CosmJS version if installed into one dependency tree.

## Install a toolchain

- TypeScript ecosystem: use Node.js 26 for the Asset Kit client; from `integrations/typescript`, run `npm install --legacy-peer-deps --registry=https://registry.npmjs.org`. This manifest includes the SDK, React/EVM/SVM kits, QoreX React adapters, PQC, QoreSign, QoreSeal, RDK, MCP/CLI, Asset Kit, QoreScan, chain bridge, handles and PQ light client. The QoreX mock/Synpress tools and RDK CLI are dev tools.

  The TypeScript toolkit has runnable entry points: `npm run inspect -- <tx-hash> [qor-address]`, `npm run rdk:status`, `npm run asset:mock`, `npm run seal:demo -- <text>`, `npm run bridge:features -- Solana Ethereum`, `npm run mcp`, `npm run qore`, and `npm run qorescan:contracts`. The mock asset flow and seal demo are local examples; the latter uses temporary keys and must not be used to protect real records.

  From the repository root, install this separate toolchain with `npm run toolkit:install`, then use `npm run qore:chain`, `npm run qore:mcp`, `npm run qore:inspect -- <tx-hash> [qor-address]`, `npm run qore:rdk-status`, `npm run qore:asset-mock`, `npm run qore:seal-demo -- <text>`, or `npm run qorescan:contracts`.
- Python: `python -m venv .venv`, activate it, then `pip install -r integrations/python/requirements.txt`. QoreSign/QoreSeal Python wheels are not published for Windows; source builds need Rust and native build tools. `qorechain-pqc` needs liboqs.
- Go: install Go 1.26, then run `go mod download` from `integrations/go`.
- Rust: install stable Rust, then run `cargo fetch` from `integrations/rust`.
- JVM: install JDK 21 and Maven/Gradle. The Maven and Gradle descriptors cover the QoreChain SDK, PQC, QoreSign, QoreSeal, RDK and Asset Kit.
- Swift: use Swift Package Manager on iOS 16+ or macOS 13+ for QoreSign and QoreSeal.
- Android: open `integrations/android` in Android Studio with Kotlin 2.3+ and Android API 24+.
- Solidity: in `integrations/solidity`, use Foundry and install `qorechain/qorechain-asset-kit@v0.1.0` as described in its guide.

The main app remains runnable with the root `npm install` and its existing scripts. These companion manifests do not get installed by that command.

## What is live versus a development/reference integration

The main app currently uses the TypeScript SDK/React/EVM/SVM packages, QoreX provider typing, and `qorechain-pqc`. It also has the checked screenshot flows: hybrid ML-DSA-87 native transfer reporting and PQC key registration with proof-of-possession verification.

Other toolchains are declared as isolated integrations, not silently represented as production features. In particular:

- SVM transaction submission is not open on public networks; the app only reads endpoint health.
- Asset Kit native modules are a proposal and are not deployed. Its EVM contracts are testnet-only and pre-1.0.
- PQ light client verifies simulated checkpoints and does not connect to QoreChain.
- QoreScan is an inventory/reporting tool, not a certification or security audit.
- Custody Kit is vendored/reference code rather than a general package. Use the upstream repository and its test vectors.
- MCP and `qore` CLI are read-only. The chain bridge can submit transactions and must be configured as a separately secured service.
- QoreSeal's construction is pre-1.0 and pending external review; do not use it as the only protection for sensitive student records.

For the detailed package-to-language mapping and the screenshot coverage list, see [qorechain-stack-coverage.md](../docs/qorechain-stack-coverage.md).
