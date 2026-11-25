import { ProjectCategory, qorToBaseUnits } from "@qoresentinel/shared";

export interface DemoApplicationData {
  id: string;
  poolId: string;
  applicantName: string;
  applicantEmail: string;
  projectTitle: string;
  projectDescription: string;
  category: ProjectCategory;
  requestedAmountQOR: number;
  beneficiaryWalletAddress: string;
  budgetBreakdown: Array<{ item: string; percentage: number; amountQOR: number; description?: string }>;
  milestones: Array<{ title: string; description: string; percentage: number; expectedDeliveryWeeks: number }>;
  supportingDocuments: Array<{ filename: string; mimeType: string; contentBase64?: string; syntheticType?: any }>;
  scenarioType: "VALID" | "DUPLICATE" | "INVALID_BUDGET";
}

export class DemoDataService {
  public static readonly DEMO_POOLS = [
    {
      id: "pool_pqc_research",
      onChainPoolId: "0x111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0001",
      title: "Post-Quantum Cryptography & Lattice Migration Pool",
      description: "Dedicated microgrant funding pool for research and implementation of NIST FIPS 204 ML-DSA digital signatures, lattice cryptography, and quantum-resistant protocol upgrades.",
      category: "POST_QUANTUM_CRYPTO" as ProjectCategory,
      totalBudget: qorToBaseUnits(50000, true), // 50,000 QOR
      remainingBudget: qorToBaseUnits(38000, true), // 38,000 QOR
      maxGrantPerApplicant: qorToBaseUnits(5000, true), // 5,000 QOR
      dailyCap: qorToBaseUnits(10000, true),
      dailySpent: "0",
      tokenAddress: "0x0000000000000000000000000000000000000000",
      eligibilityCriteria: [
        "Open-source implementation with permissive licensing (MIT/Apache 2.0)",
        "Adherence to NIST FIPS 204 (ML-DSA) or FIPS 203 (ML-KEM) specifications",
        "Demonstrated quantum attack model threat analysis",
        "Formal test vectors matching official reference implementations",
      ],
      requiredDocuments: [
        "Technical Architecture Specification (PDF)",
        "Budget & Resource Allocation Sheet",
        "Cryptographic Proof & Milestone Roadmap",
      ],
      isActive: true,
    },
    {
      id: "pool_smart_account_sec",
      onChainPoolId: "0x22223333444455556666777788889999aaaabbbbccccddddeeeeffff00021111",
      title: "Autonomous Agent & Smart Account Security Vault",
      description: "Microgrants for designing deterministic policy enforcement, scoped session keys, and hardware security modules for autonomous on-chain agents.",
      category: "SMART_CONTRACT_SECURITY" as ProjectCategory,
      totalBudget: qorToBaseUnits(30000, true),
      remainingBudget: qorToBaseUnits(24000, true),
      maxGrantPerApplicant: qorToBaseUnits(3000, true),
      dailyCap: qorToBaseUnits(6000, true),
      dailySpent: "0",
      tokenAddress: "0x0000000000000000000000000000000000000000",
      eligibilityCriteria: [
        "Deterministic policy validation before execution",
        "Reentrancy and flash-loan attack protection audits",
        "Time-bounded session key revocation test suite",
      ],
      requiredDocuments: [
        "Security Architecture Document",
        "Detailed Threat Model",
      ],
      isActive: true,
    },
  ];

  public static readonly DEMO_APPLICATIONS: DemoApplicationData[] = [
    // 1. VALID APPLICATION: Should be approved; demo simulation never counts as payment
    {
      id: "app_demo_valid_001",
      poolId: "pool_pqc_research",
      applicantName: "Dr. Evelyn Reed (QoreSafe Labs)",
      applicantEmail: "evelyn.reed@qoresafe-quantum.org",
      projectTitle: "LatticeGuard: High-Performance ML-DSA-87 Verification Precompile",
      projectDescription: "Implementation of hardware-accelerated NIST FIPS 204 ML-DSA-87 signature evaluation primitives for QoreChain Diana Testnet. Includes constant-time polynomial multiplication, memory-safe bounds checks, and seamless EVM precompile integration for high-throughput smart contract transaction authorization.",
      category: "POST_QUANTUM_CRYPTO",
      requestedAmountQOR: 3500,
      beneficiaryWalletAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      budgetBreakdown: [
        { item: "Cryptographic Engineering & C/Wasm Kernels", percentage: 50, amountQOR: 1750, description: "Lead cryptographer time for ML-DSA-87 polynomial arithmetic" },
        { item: "Formal Security & Side-Channel Audit", percentage: 30, amountQOR: 1050, description: "Third-party audit for timing attack resistance" },
        { item: "Benchmarking & Diana Testnet Deployment", percentage: 20, amountQOR: 700, description: "Integration harness and open-source documentation" },
      ],
      milestones: [
        { title: "Milestone 1: Core Mathematical Primitives", description: "Deliver NTT polynomial multiplication kernel and test vectors", percentage: 40, expectedDeliveryWeeks: 3 },
        { title: "Milestone 2: Precompile & Benchmarking Harness", description: "Deliver EVM precompile bindings and gas usage report", percentage: 30, expectedDeliveryWeeks: 3 },
        { title: "Milestone 3: Production Diana Testnet Deployment", description: "Full integration test suite, open-source documentation and SDK adapters", percentage: 30, expectedDeliveryWeeks: 2 },
      ],
      supportingDocuments: [
        { filename: "LatticeGuard_Technical_Whitepaper.pdf", mimeType: "application/pdf", syntheticType: "TECHNICAL_SPEC", contentBase64: "synthetic_valid_pqc_whitepaper_latticeguard_2026" },
        { filename: "Budget_Allocation_Breakdown.pdf", mimeType: "application/pdf", syntheticType: "BUDGET_SHEET", contentBase64: "synthetic_valid_budget_sheet_qoresafe_2026" },
        { filename: "Team_Cryptography_Credentials.pdf", mimeType: "application/pdf", syntheticType: "TEAM_CREDENTIALS", contentBase64: "synthetic_credentials_evelyn_reed_phd" },
      ],
      scenarioType: "VALID",
    },

    // 2. DUPLICATE APPLICATION: Reuses title, email, and identical document hashes -> Must be FLAGGED/REJECTED
    {
      id: "app_demo_duplicate_002",
      poolId: "pool_pqc_research",
      applicantName: "Dr. Evelyn Reed (Clone Submission)",
      applicantEmail: "evelyn.reed@qoresafe-quantum.org", // Reused email!
      projectTitle: "LatticeGuard: High-Performance ML-DSA-87 Verification Precompile", // Reused title!
      projectDescription: "Duplicate submission attempting to double-dip the grant pool using previously funded technical specifications and identical budget line items.",
      category: "POST_QUANTUM_CRYPTO",
      requestedAmountQOR: 3500,
      beneficiaryWalletAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // Different wallet (Sybil attempt)
      budgetBreakdown: [
        { item: "Engineering Duplicate", percentage: 50, amountQOR: 1750 },
        { item: "Audit Duplicate", percentage: 30, amountQOR: 1050 },
        { item: "Deployment Duplicate", percentage: 20, amountQOR: 700 },
      ],
      milestones: [
        { title: "Milestone 1", description: "Initial phase", percentage: 40, expectedDeliveryWeeks: 3 },
        { title: "Milestone 2", description: "Mid phase", percentage: 30, expectedDeliveryWeeks: 3 },
        { title: "Milestone 3", description: "Final phase", percentage: 30, expectedDeliveryWeeks: 2 },
      ],
      supportingDocuments: [
        { filename: "LatticeGuard_Technical_Whitepaper.pdf", mimeType: "application/pdf", syntheticType: "TECHNICAL_SPEC", contentBase64: "synthetic_valid_pqc_whitepaper_latticeguard_2026" }, // Reused identical hash!
      ],
      scenarioType: "DUPLICATE",
    },

    // 3. INVALID APPLICATION: Exceeds pool max grant cap (requests 12,000 QOR when max is 5,000 QOR) and inconsistent budget -> Must be REJECTED
    {
      id: "app_demo_invalid_003",
      poolId: "pool_pqc_research",
      applicantName: "Overbudget Research Consortium",
      applicantEmail: "contact@overbudget-consortium.xyz",
      projectTitle: "Supercomputer Quantum Simulation Cluster",
      projectDescription: "Requested funding for speculative hardware acquisition without milestone breakdown or quantum security proofs.",
      category: "POST_QUANTUM_CRYPTO",
      requestedAmountQOR: 12000, // Exceeds 5,000 QOR max grant ceiling!
      beneficiaryWalletAddress: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
      budgetBreakdown: [
        { item: "Hardware Cluster Purchase", percentage: 80, amountQOR: 8000 },
        { item: "Miscellaneous Expenses", percentage: 20, amountQOR: 2000 }, // Total is 10,000 QOR != requested 12,000 QOR (Inconsistent budget!)
      ],
      milestones: [
        { title: "Hardware Procurement", description: "Order servers", percentage: 50, expectedDeliveryWeeks: 4 },
        { title: "Setup and Integration", description: "Turn on servers", percentage: 30, expectedDeliveryWeeks: 4 },
        { title: "Deployment and Verification", description: "Live verification", percentage: 30, expectedDeliveryWeeks: 2 }, // Sums to 110% != 100%
      ],
      supportingDocuments: [
        { filename: "Invoice_Hardware_Quote.pdf", mimeType: "application/pdf", syntheticType: "BUDGET_SHEET", contentBase64: "synthetic_unverified_vendor_quote_doc" },
      ],
      scenarioType: "INVALID_BUDGET",
    },
  ];
}
