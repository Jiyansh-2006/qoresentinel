# Solidity integration

QoreSentinel's GrantVault is maintained in `contracts/`. This Foundry profile is an isolated entry point for the QoreChain Asset Kit. The Asset Kit contracts require the upstream source and dependencies; install them with:

```powershell
cd integrations/solidity
forge install qorechain/qorechain-asset-kit@v0.1.0
forge build
```

The Asset Kit clients for native `x/asset` modules only use a mock today. Its EVM guard contracts are pre-1.0, not audited, and testnet-only. Do not use them to issue live assets or to secure the existing grants vault.
