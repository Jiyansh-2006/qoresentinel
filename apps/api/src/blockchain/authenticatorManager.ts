import { AgentAuthenticatorConfig, QORECHAIN_DIANA_CONFIG } from "@qoresentinel/shared";

export class AgentAuthenticatorManager {
  private static activeConfig: AgentAuthenticatorConfig = {
    agentAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    mldsaPublicKeyFingerprint: "qor-pqc:dsa87:4f9b2d881e77aa12c04efd9961234abc",
    smartAccountAddress: "0x91F56B77a284F49c1220a2B0Fe29B6f98EAfDE58",
    maxSpendPerTransaction: (5000n * 10n ** 18n).toString(), // 5,000 QOR
    dailySpendingLimit: (15000n * 10n ** 18n).toString(), // 15,000 QOR
    currentDailySpent: "0",
    validUntilTimestamp: Math.floor(Date.now() / 1000) + 3600 * 24, // 24 hours
    permittedContractTargets: [
      "0x91F56B77a284F49c1220a2B0Fe29B6f98EAfDE58".toLowerCase(),
    ],
    isRevoked: false,
    scopedEvmAuthWindow: {
      isOpen: true,
      authorizedAt: Math.floor(Date.now() / 1000),
      expiresAt: Math.floor(Date.now() / 1000) + 7200, // 2 hours
      remainingSeconds: 7200,
    },
  };

  public static getAuthenticatorConfig(): AgentAuthenticatorConfig {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = this.activeConfig.scopedEvmAuthWindow.expiresAt;
    const remainingSeconds = Math.max(0, expiresAt - now);
    const isOpen = remainingSeconds > 0 && !this.activeConfig.isRevoked;

    return {
      ...this.activeConfig,
      scopedEvmAuthWindow: {
        ...this.activeConfig.scopedEvmAuthWindow,
        isOpen,
        remainingSeconds,
      },
    };
  }

  public static openScopedAuthWindow(durationSeconds: number = 7200): AgentAuthenticatorConfig {
    const now = Math.floor(Date.now() / 1000);
    this.activeConfig.isRevoked = false;
    this.activeConfig.scopedEvmAuthWindow = {
      isOpen: true,
      authorizedAt: now,
      expiresAt: now + durationSeconds,
      remainingSeconds: durationSeconds,
    };
    return this.getAuthenticatorConfig();
  }

  public static revokeAuthenticator(): AgentAuthenticatorConfig {
    this.activeConfig.isRevoked = true;
    this.activeConfig.scopedEvmAuthWindow.isOpen = false;
    this.activeConfig.scopedEvmAuthWindow.remainingSeconds = 0;
    return this.getAuthenticatorConfig();
  }

  public static updateSpendingLimits(maxPerTx: string, dailyCap: string): AgentAuthenticatorConfig {
    this.activeConfig.maxSpendPerTransaction = maxPerTx;
    this.activeConfig.dailySpendingLimit = dailyCap;
    return this.getAuthenticatorConfig();
  }

  public static recordSpend(amountBaseUnits: string): void {
    const current = BigInt(this.activeConfig.currentDailySpent);
    const added = BigInt(amountBaseUnits);
    this.activeConfig.currentDailySpent = (current + added).toString();
  }
}
