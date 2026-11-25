import { ethers } from "ethers";
import {
  CanonicalDecisionPayload,
  PQCSignatureBundle,
  TransactionExecutionResult,
  AgentAuthenticatorConfig,
  QORECHAIN_DIANA_CONFIG,
} from "@qoresentinel/shared";
import { verifyCanonicalDecisionSignature } from "@qoresentinel/crypto";

export class AutonomousTransactionAgent {
  public static readonly role = "TRANSACTION_AGENT";
  public static readonly name = "Autonomous Transaction Agent";

  /**
   * Evaluates session key restrictions, verifies ML-DSA-87 signature,
   * checks EVM authorization window, and executes disbursement via GrantVault.
   */
  public static async executeDisbursement(params: {
    canonicalPayload: CanonicalDecisionPayload;
    signatureBundle: PQCSignatureBundle;
    agentAuthenticator: AgentAuthenticatorConfig;
    contractAddress: string;
    signerOrProvider: ethers.Signer | ethers.Provider | null;
    isDemoMode: boolean;
  }): Promise<TransactionExecutionResult> {
    const {
      canonicalPayload,
      signatureBundle,
      agentAuthenticator,
      contractAddress,
      signerOrProvider,
      isDemoMode,
    } = params;

    const timestampNow = Math.floor(Date.now() / 1000);

    // 1. Verify ML-DSA-87 signature over canonical payload
    const verification = verifyCanonicalDecisionSignature(
      signatureBundle.publicKeyHex,
      canonicalPayload,
      signatureBundle
    );

    if (!verification.valid) {
      return {
        success: false,
        txHash: "",
        blockNumber: 0,
        network: QORECHAIN_DIANA_CONFIG.name,
        contractAddress,
        beneficiary: canonicalPayload.beneficiary,
        amountBaseUnits: canonicalPayload.approvedAmountBaseUnits,
        explorerUrl: "",
        isSimulated: isDemoMode,
        gasUsed: "0",
        timestamp: Date.now(),
        errorMessage: `Post-quantum signature verification failed: ${verification.error}`,
      };
    }

    // 2. Check if agent is revoked
    if (agentAuthenticator.isRevoked) {
      return {
        success: false,
        txHash: "",
        blockNumber: 0,
        network: QORECHAIN_DIANA_CONFIG.name,
        contractAddress,
        beneficiary: canonicalPayload.beneficiary,
        amountBaseUnits: canonicalPayload.approvedAmountBaseUnits,
        explorerUrl: "",
        isSimulated: isDemoMode,
        gasUsed: "0",
        timestamp: Date.now(),
        errorMessage: "Agent authenticator permissions have been revoked by administrator",
      };
    }

    // 3. Verify EVM authorization window
    if (
      !agentAuthenticator.scopedEvmAuthWindow.isOpen ||
      timestampNow > agentAuthenticator.scopedEvmAuthWindow.expiresAt
    ) {
      return {
        success: false,
        txHash: "",
        blockNumber: 0,
        network: QORECHAIN_DIANA_CONFIG.name,
        contractAddress,
        beneficiary: canonicalPayload.beneficiary,
        amountBaseUnits: canonicalPayload.approvedAmountBaseUnits,
        explorerUrl: "",
        isSimulated: isDemoMode,
        gasUsed: "0",
        timestamp: Date.now(),
        errorMessage: "EVM Authorization Window has expired. Agent is prohibited from executing transactions.",
      };
    }

    // 4. Verify spending limits against base units
    const approvedAmount = BigInt(canonicalPayload.approvedAmountBaseUnits);
    const maxSpendPerTx = BigInt(agentAuthenticator.maxSpendPerTransaction);
    const dailyLimit = BigInt(agentAuthenticator.dailySpendingLimit);
    const currentDailySpent = BigInt(agentAuthenticator.currentDailySpent);

    if (approvedAmount > maxSpendPerTx) {
      return {
        success: false,
        txHash: "",
        blockNumber: 0,
        network: QORECHAIN_DIANA_CONFIG.name,
        contractAddress,
        beneficiary: canonicalPayload.beneficiary,
        amountBaseUnits: canonicalPayload.approvedAmountBaseUnits,
        explorerUrl: "",
        isSimulated: isDemoMode,
        gasUsed: "0",
        timestamp: Date.now(),
        errorMessage: `Approved amount (${approvedAmount}) exceeds restricted agent max spend per transaction (${maxSpendPerTx})`,
      };
    }

    if (currentDailySpent + approvedAmount > dailyLimit) {
      return {
        success: false,
        txHash: "",
        blockNumber: 0,
        network: QORECHAIN_DIANA_CONFIG.name,
        contractAddress,
        beneficiary: canonicalPayload.beneficiary,
        amountBaseUnits: canonicalPayload.approvedAmountBaseUnits,
        explorerUrl: "",
        isSimulated: isDemoMode,
        gasUsed: "0",
        timestamp: Date.now(),
        errorMessage: `Transaction would exceed agent daily limit (${dailyLimit})`,
      };
    }

    // 5. Check permitted target contract
    const isTargetAllowed = agentAuthenticator.permittedContractTargets.some(
      (target) => target.toLowerCase() === contractAddress.toLowerCase()
    );
    if (!isTargetAllowed && agentAuthenticator.permittedContractTargets.length > 0) {
      return {
        success: false,
        txHash: "",
        blockNumber: 0,
        network: QORECHAIN_DIANA_CONFIG.name,
        contractAddress,
        beneficiary: canonicalPayload.beneficiary,
        amountBaseUnits: canonicalPayload.approvedAmountBaseUnits,
        explorerUrl: "",
        isSimulated: isDemoMode,
        gasUsed: "0",
        timestamp: Date.now(),
        errorMessage: `Target contract ${contractAddress} is not in agent permitted target contracts list`,
      };
    }

    // 6. Blockchain Execution (Live Testnet or Transparent Simulation)
    if (isDemoMode) {
      // Deterministic demo execution simulation with realistic gas and block
      const simulatedHash = ethers.keccak256(
        ethers.toUtf8Bytes(
          `simulated_tx:${canonicalPayload.applicationId}:${canonicalPayload.nonce}:${Date.now()}`
        )
      );

      return {
        success: true,
        txHash: simulatedHash,
        blockNumber: 142089 + Math.floor(Math.random() * 100),
        network: "QoreChain Diana Testnet (Demo Simulation)",
        contractAddress,
        beneficiary: canonicalPayload.beneficiary,
        amountBaseUnits: canonicalPayload.approvedAmountBaseUnits,
        explorerUrl: `${QORECHAIN_DIANA_CONFIG.explorerUrl}/tx/${simulatedHash}`,
        isSimulated: true,
        gasUsed: "68420",
        timestamp: Date.now(),
      };
    }

    if (!signerOrProvider) {
      return {
        success: false,
        txHash: "",
        blockNumber: 0,
        network: QORECHAIN_DIANA_CONFIG.name,
        contractAddress,
        beneficiary: canonicalPayload.beneficiary,
        amountBaseUnits: canonicalPayload.approvedAmountBaseUnits,
        explorerUrl: "",
        isSimulated: false,
        gasUsed: "0",
        timestamp: Date.now(),
        errorMessage: "Live execution requires QoreX wallet confirmation in the browser",
      };
    }

    try {
      // Live execution on Diana Testnet via GrantVault contract
      const signer = signerOrProvider as ethers.Signer;
      const vaultAbi = [
        "function releaseGrant(bytes32 applicationId, uint256 milestoneIndex, bytes32 evidenceHash) external",
        "function registerApplication(bytes32 applicationId, bytes32 poolId, bytes32 decisionPayloadHash, address payable beneficiary, uint256 totalApprovedAmount, uint256[] calldata milestonePercentages) external",
      ];
      const vault = new ethers.Contract(contractAddress, vaultAbi, signer);

      const appIdBytes32 = ethers.keccak256(ethers.toUtf8Bytes(canonicalPayload.applicationId));
      const evidenceHashBytes32 = canonicalPayload.evidenceRootHash.startsWith("0x")
        ? canonicalPayload.evidenceRootHash
        : `0x${canonicalPayload.evidenceRootHash}`;

      const tx = await vault.releaseGrant(
        appIdBytes32,
        canonicalPayload.milestoneIndex,
        evidenceHashBytes32,
        { gasLimit: 250000 }
      );

      const receipt = await tx.wait(1);

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        network: QORECHAIN_DIANA_CONFIG.name,
        contractAddress,
        beneficiary: canonicalPayload.beneficiary,
        amountBaseUnits: canonicalPayload.approvedAmountBaseUnits,
        explorerUrl: `${QORECHAIN_DIANA_CONFIG.explorerUrl}/tx/${receipt.hash}`,
        isSimulated: false,
        gasUsed: receipt.gasUsed.toString(),
        timestamp: Date.now(),
      };
    } catch (err: any) {
      return {
        success: false,
        txHash: "",
        blockNumber: 0,
        network: QORECHAIN_DIANA_CONFIG.name,
        contractAddress,
        beneficiary: canonicalPayload.beneficiary,
        amountBaseUnits: canonicalPayload.approvedAmountBaseUnits,
        explorerUrl: "",
        isSimulated: false,
        gasUsed: "0",
        timestamp: Date.now(),
        errorMessage: `Blockchain transaction execution failed: ${err.message}`,
      };
    }
  }
}
