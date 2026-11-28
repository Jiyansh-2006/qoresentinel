# Reference-only custody kit

The QoreChain custody kit is a source/reference kit, not five language package releases. The project does not implement a custodian or exchange workflow yet. For an actual integration, pin and review upstream release `v0.1.1`, vendor only the needed language folder, and run its published test vectors before enabling deposits or withdrawals.

```text
git clone --depth 1 --branch v0.1.1 https://github.com/qorechain/qorechain-custody-kit
```

Use `code/ts`, `code/python`, `code/go`, `code/rust`, or `code/java`. The Go module is separately available as `github.com/qorechain/qorechain-custody-kit/code/go@v0.1.1`.
