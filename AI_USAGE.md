# AI Usage Disclosure

**Project:** QoreSentinel  
**Event:** QoreChain Developer Fest 2026 – Build Before Q-Day

## AI assistance during development

Large language model tools were used as development assistants for planning, code drafting, debugging, example data, and documentation. Their output was reviewed and adapted for this repository. AI assistance is not a substitute for code review, testing, security review, or independent audit; this project has not been independently audited or formally certified.

## AI features in the product

QoreSentinel's application review pipeline consists of seven software stages: intake validation, document checks, eligibility rules, fraud and duplicate checks, financial policy checks, decision coordination, and transaction authorization. The review checks and final approval or rejection are determined by application code and configured policy rules. A language model does not choose the verdict or set the approved amount.

When configured with `GROQ_API_KEY`, the application can call Groq for two optional language features:

- **Review explanations:** Groq receives the project title, category, description, requested amount, deterministic verdict, check results, and reasons to produce a plain-language explanation. The explanation is advisory and cannot approve, reject, or pay a grant. If Groq is unavailable or unconfigured, the application uses its own review summary.
- **Help assistant:** The assistant uses Groq to answer questions about the product and its workflows. User messages sent to this feature are processed by the configured Groq service. Do not include passwords, wallet private keys, recovery phrases, or other secrets in prompts.

Uploaded supporting documents are hashed by the application, but their contents are not sent to Groq for review. The document agent does not perform real OCR: its keyword checks are heuristic and based on document metadata or synthetic evidence. The demo stores uploaded files with the in-memory application record; durable document storage is not enabled.

## Cryptography and transaction controls

- ML-DSA-87 signing and verification use the `@noble/post-quantum` package, with SHA-256 from `@noble/hashes`.
- Decision payloads are serialized with sorted object keys and hashed with SHA-256 before signing. The code describes this as RFC 8785/JCS canonicalization; this implementation has not been independently validated for full RFC 8785 conformance.
- The transaction agent checks the decision signature, agent revocation status, authorization-window expiry, spending limits, and permitted contract target before attempting execution. Live execution uses a wallet signer and GrantVault contract checks. Demo mode generates a clearly marked simulated result and does not transfer funds.
- Smart contract and wallet controls, rather than language-model output, govern on-chain transactions. No model is given private signing keys or authority to alter contract storage.

## Limitations

QoreSentinel is a prototype. Its deterministic checks, cryptographic implementation, deployment configuration, and smart contracts have not received an independent security audit or formal certification. Demo results are simulations; testnet activity is not a production payment. AI-generated explanations may be incomplete or inaccurate and should be checked against the recorded review results.
