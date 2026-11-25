import { expect } from "chai";
import { ethers } from "hardhat";
import { GrantVault } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("GrantVault Smart Contract - QoreSentinel", function () {
  let vault: GrantVault;
  let admin: SignerWithAddress;
  let agent: SignerWithAddress;
  let unauthorizedAgent: SignerWithAddress;
  let beneficiary: SignerWithAddress;

  const poolId = ethers.keccak256(ethers.toUtf8Bytes("pool_pqc_2026"));
  const appId = ethers.keccak256(ethers.toUtf8Bytes("app_grant_001"));
  const decisionHash = ethers.keccak256(ethers.toUtf8Bytes("canonical_decision_mldsa87_hash_001"));
  const evidenceHash1 = ethers.keccak256(ethers.toUtf8Bytes("milestone_1_evidence_pdf_hash"));
  const evidenceHash2 = ethers.keccak256(ethers.toUtf8Bytes("milestone_2_evidence_pdf_hash"));

  const initialBudget = ethers.parseEther("10"); // 10 QOR
  const maxGrant = ethers.parseEther("5"); // 5 QOR max per grant
  const dailyCap = ethers.parseEther("8"); // 8 QOR daily pool cap

  const agentMaxSpend = ethers.parseEther("3"); // 3 QOR per tx
  const agentDailyLimit = ethers.parseEther("6"); // 6 QOR daily
  const agentValidityDuration = 3600 * 24; // 24 hours
  const agentFingerprint = ethers.keccak256(ethers.toUtf8Bytes("qor-pqc:dsa87:fingerprint_agent"));

  beforeEach(async function () {
    [admin, agent, unauthorizedAgent, beneficiary] = await ethers.getSigners();

    const GrantVaultFactory = await ethers.getContractFactory("GrantVault");
    vault = (await GrantVaultFactory.deploy()) as GrantVault;
    await vault.waitForDeployment();

    // Authorize agent
    await vault.authorizeAgent(
      agent.address,
      agentMaxSpend,
      agentDailyLimit,
      agentValidityDuration,
      agentFingerprint
    );

    // Create pool and fund it with native QOR
    await vault.createPool(
      poolId,
      "Post-Quantum Security Pool",
      "POST_QUANTUM_CRYPTO",
      initialBudget,
      maxGrant,
      dailyCap,
      ethers.ZeroAddress,
      { value: initialBudget }
    );
  });

  describe("1. Valid Payouts & Flow", function () {
    it("Should successfully register application and release milestone 0 payout", async function () {
      const grantAmount = ethers.parseEther("2"); // 2 QOR
      const milestones = [40, 30, 30]; // 0.8 QOR, 0.6 QOR, 0.6 QOR

      // Register application via authorized agent
      await expect(
        vault.connect(agent).registerApplication(
          appId,
          poolId,
          decisionHash,
          beneficiary.address,
          grantAmount,
          milestones
        )
      )
        .to.emit(vault, "ApplicationRegistered")
        .withArgs(appId, poolId, beneficiary.address, grantAmount);

      const initialBeneficiaryBalance = await ethers.provider.getBalance(beneficiary.address);

      // Release milestone 0 (0.8 QOR)
      const tx = await vault.connect(agent).releaseGrant(appId, 0, evidenceHash1);
      await expect(tx)
        .to.emit(vault, "GrantReleased")
        .withArgs(appId, poolId, beneficiary.address, ethers.parseEther("0.8"), 0);

      const finalBeneficiaryBalance = await ethers.provider.getBalance(beneficiary.address);
      expect(finalBeneficiaryBalance - initialBeneficiaryBalance).to.equal(ethers.parseEther("0.8"));

      // Verify application record
      const app = await vault.getApplication(appId);
      expect(app.totalPaidAmount).to.equal(ethers.parseEther("0.8"));
      expect(app.currentMilestoneIndex).to.equal(1);
      expect(app.isCompleted).to.be.false;
    });
  });

  describe("2. Duplicate Payout Prevention & Replay Defense", function () {
    beforeEach(async function () {
      const grantAmount = ethers.parseEther("2");
      await vault.connect(agent).registerApplication(
        appId,
        poolId,
        decisionHash,
        beneficiary.address,
        grantAmount,
        [40, 30, 30]
      );
      await vault.connect(agent).releaseGrant(appId, 0, evidenceHash1);
    });

    it("Should prevent releasing the same milestone twice", async function () {
      await expect(
        vault.connect(agent).releaseGrant(appId, 0, evidenceHash1)
      ).to.be.revertedWith("GrantVault: invalid milestone sequence");
    });

    it("Should prevent re-registering the same decision payload hash (replay protection)", async function () {
      const secondAppId = ethers.keccak256(ethers.toUtf8Bytes("app_grant_replay_test"));
      await expect(
        vault.connect(agent).registerApplication(
          secondAppId,
          poolId,
          decisionHash, // Reused decision payload hash!
          beneficiary.address,
          ethers.parseEther("1"),
          [50, 50]
        )
      ).to.be.revertedWith("GrantVault: decision payload already executed");
    });
  });

  describe("3. Insufficient Pool Balance", function () {
    it("Should reject an application that exceeds the pool's remaining budget", async function () {
      const excessiveAppId = ethers.keccak256(ethers.toUtf8Bytes("app_excessive_pool"));
      const excessiveDecision = ethers.keccak256(ethers.toUtf8Bytes("excessive_decision"));

      // Create small pool of 1 QOR
      const smallPoolId = ethers.keccak256(ethers.toUtf8Bytes("small_pool"));
      await vault.createPool(
        smallPoolId,
        "Small Pool",
        "PUBLIC_GOODS",
        ethers.parseEther("1"),
        ethers.parseEther("1"),
        ethers.parseEther("1"),
        ethers.ZeroAddress,
        { value: ethers.parseEther("1") }
      );

      await expect(
        vault.connect(agent).registerApplication(
          excessiveAppId,
          smallPoolId,
          excessiveDecision,
          beneficiary.address,
          ethers.parseEther("1.5"), // Exceeds 1 QOR
          [100]
        )
      ).to.be.revertedWith("GrantVault: exceeds pool max grant");
    });
  });

  describe("4. Amount Exceeding Maximum Grant Limit", function () {
    it("Should reject application if requested amount exceeds pool maxGrantPerApplicant", async function () {
      const largeAppId = ethers.keccak256(ethers.toUtf8Bytes("app_large_grant"));
      const largeDecision = ethers.keccak256(ethers.toUtf8Bytes("large_decision"));

      // maxGrant is 5 QOR. Request 6 QOR
      await expect(
        vault.connect(agent).registerApplication(
          largeAppId,
          poolId,
          largeDecision,
          beneficiary.address,
          ethers.parseEther("6"),
          [50, 50]
        )
      ).to.be.revertedWith("GrantVault: exceeds pool max grant");
    });
  });

  describe("5. Unauthorized Agent Access", function () {
    it("Should prevent unauthorized callers from registering applications", async function () {
      await expect(
        vault.connect(unauthorizedAgent).registerApplication(
          appId,
          poolId,
          decisionHash,
          beneficiary.address,
          ethers.parseEther("1"),
          [100]
        )
      ).to.be.revertedWith("GrantVault: caller is not an authorized agent");
    });

    it("Should prevent unauthorized callers from releasing grants", async function () {
      await vault.connect(agent).registerApplication(
        appId,
        poolId,
        decisionHash,
        beneficiary.address,
        ethers.parseEther("1"),
        [100]
      );

      await expect(
        vault.connect(unauthorizedAgent).releaseGrant(appId, 0, evidenceHash1)
      ).to.be.revertedWith("GrantVault: caller is not an authorized agent");
    });
  });

  describe("6. Revoked Agent Enforcement", function () {
    it("Should immediately block a revoked agent from executing grants", async function () {
      await vault.connect(agent).registerApplication(
        appId,
        poolId,
        decisionHash,
        beneficiary.address,
        ethers.parseEther("1"),
        [100]
      );

      // Admin revokes agent
      await expect(vault.revokeAgent(agent.address))
        .to.emit(vault, "AgentRevoked")
        .withArgs(agent.address);

      // Verify agent permissions report not authorized
      const perms = await vault.getAgentPermissions(agent.address);
      expect(perms.isAuthorized).to.be.false;

      // Revoked agent attempt must revert
      await expect(
        vault.connect(agent).releaseGrant(appId, 0, evidenceHash1)
      ).to.be.revertedWith("GrantVault: caller is not an authorized agent");
    });
  });

  describe("7. Invalid or Cancelled Application", function () {
    it("Should fail when attempting to release a non-existent application", async function () {
      const nonExistentApp = ethers.keccak256(ethers.toUtf8Bytes("phantom_app"));
      await expect(
        vault.connect(agent).releaseGrant(nonExistentApp, 0, evidenceHash1)
      ).to.be.revertedWith("GrantVault: application not found");
    });

    it("Should fail when attempting to release a cancelled application", async function () {
      await vault.connect(agent).registerApplication(
        appId,
        poolId,
        decisionHash,
        beneficiary.address,
        ethers.parseEther("1"),
        [100]
      );

      // Admin cancels application
      await vault.cancelApplication(appId);

      await expect(
        vault.connect(agent).releaseGrant(appId, 0, evidenceHash1)
      ).to.be.revertedWith("GrantVault: application cancelled");
    });
  });

  describe("8. Milestone Sequencing and Order Restrictions", function () {
    it("Should reject releasing milestones out of order", async function () {
      const grantAmount = ethers.parseEther("2");
      await vault.connect(agent).registerApplication(
        appId,
        poolId,
        decisionHash,
        beneficiary.address,
        grantAmount,
        [40, 30, 30] // 0: 0.8 QOR, 1: 0.6 QOR, 2: 0.6 QOR
      );

      // Attempt to release milestone 1 before milestone 0
      await expect(
        vault.connect(agent).releaseGrant(appId, 1, evidenceHash2)
      ).to.be.revertedWith("GrantVault: invalid milestone sequence");

      // Release milestone 0 first
      await vault.connect(agent).releaseGrant(appId, 0, evidenceHash1);

      // Now milestone 1 succeeds
      await expect(
        vault.connect(agent).releaseGrant(appId, 1, evidenceHash2)
      ).to.emit(vault, "MilestoneReleased").withArgs(appId, 1, ethers.parseEther("0.6"));
    });
  });

  describe("9. Paused Contract Enforcement", function () {
    it("Should prevent all critical operations while paused and resume on unpause", async function () {
      await vault.pause();

      const newPoolId = ethers.keccak256(ethers.toUtf8Bytes("paused_pool"));
      await expect(
        vault.createPool(
          newPoolId,
          "Paused Pool",
          "AI_SAFETY_ORACLES",
          ethers.parseEther("1"),
          ethers.parseEther("1"),
          ethers.parseEther("1"),
          ethers.ZeroAddress,
          { value: ethers.parseEther("1") }
        )
      ).to.be.revertedWith("Pausable: paused");

      // Unpause and verify operation succeeds
      await vault.unpause();
      await expect(
        vault.createPool(
          newPoolId,
          "Paused Pool",
          "AI_SAFETY_ORACLES",
          ethers.parseEther("1"),
          ethers.parseEther("1"),
          ethers.parseEther("1"),
          ethers.ZeroAddress,
          { value: ethers.parseEther("1") }
        )
      ).to.emit(vault, "PoolCreated");
    });
  });
});
