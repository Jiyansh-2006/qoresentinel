import { ethers } from "hardhat";

async function main() {
  console.log("==================================================================");
  console.log("Deploying GrantVault to QoreChain Diana Testnet (Chain ID 9800)...");
  console.log("==================================================================");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer account balance:", ethers.formatEther(balance), "QOR");

  const GrantVault = await ethers.getContractFactory("GrantVault");
  const vault = await GrantVault.deploy();
  await vault.waitForDeployment();

  const vaultAddress = await vault.getAddress();
  console.log("✅ GrantVault successfully deployed at:", vaultAddress);
  console.log("Explorer verification URL: https://explore.qore.network/address/" + vaultAddress);

  // Authorize initial autonomous agent if specified
  const agentAddress = process.env.AGENT_AUTHENTICATOR_ADDRESS;
  if (agentAddress && ethers.isAddress(agentAddress)) {
    console.log("Configuring initial Agent Authenticator:", agentAddress);
    const maxSpend = ethers.parseEther("5000"); // 5,000 QOR per tx
    const dailyCap = ethers.parseEther("15000"); // 15,000 QOR daily
    const duration = 30 * 24 * 3600; // 30 days
    const dummyFingerprint = ethers.keccak256(ethers.toUtf8Bytes("qor-pqc:dsa87:agent1"));

    const tx = await vault.authorizeAgent(agentAddress, maxSpend, dailyCap, duration, dummyFingerprint);
    await tx.wait();
    console.log("✅ Agent Authenticator successfully authorized on-chain");
  }
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
