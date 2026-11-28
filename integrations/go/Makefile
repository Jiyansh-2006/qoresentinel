.PHONY: qorescan

# QoreScan is a CLI rather than an importable library. Install a tagged version,
# then run it separately from Go library builds.
qorescan:
	go install github.com/qorechain/qorescan/cmd/qorescan@v0.1.0
	qorescan solidity ../../contracts --out -
