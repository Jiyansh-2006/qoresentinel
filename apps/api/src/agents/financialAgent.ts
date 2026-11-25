import {
  FinancialPolicyOutput,
  qorToBaseUnits,
} from "@qoresentinel/shared";

export class FinancialPolicyAgent {
  public static readonly role = "FINANCIAL_AGENT";
  public static readonly name = "Financial Policy Agent";

  /**
   * Deterministically evaluates financial eligibility in exact integer base units.
   * Completely independent of LLM hallucinations.
   */
  public static async process(
    application: {
      requestedAmountQOR: number;
      milestones: Array<{ percentage: number }>;
    },
    pool: {
      id: string;
      remainingBudgetBaseUnits: string;
      maxGrantLimitBaseUnits: string;
      dailyCapBaseUnits: string;
      dailySpentBaseUnits: string;
    }
  ): Promise<FinancialPolicyOutput> {
    const requestedBaseUnits = qorToBaseUnits(application.requestedAmountQOR, true);

    const remainingBudgetBigInt = BigInt(pool.remainingBudgetBaseUnits);
    const maxGrantBigInt = BigInt(pool.maxGrantLimitBaseUnits);
    const requestedBigInt = BigInt(requestedBaseUnits);

    const exceedsPoolBalance = requestedBigInt > remainingBudgetBigInt;
    const exceedsMaxGrantLimit = requestedBigInt > maxGrantBigInt;

    // Validate milestone allocations
    let milestoneAllocationValid = true;
    let milestoneSumPct = 0;
    const milestoneDistribution: FinancialPolicyOutput["milestoneDistribution"] = [];

    for (let i = 0; i < application.milestones.length; i++) {
      const m = application.milestones[i];
      milestoneSumPct += m.percentage;
      const mAmountBigInt = (requestedBigInt * BigInt(m.percentage)) / BigInt(100);

      milestoneDistribution.push({
        milestoneIndex: i,
        percentage: m.percentage,
        amountBaseUnits: mAmountBigInt.toString(),
      });
    }

    if (milestoneSumPct !== 100 || application.milestones.length !== 3) {
      milestoneAllocationValid = false;
    }

    const deterministicChecksPassed =
      !exceedsPoolBalance && !exceedsMaxGrantLimit && milestoneAllocationValid && requestedBigInt > 0n;

    let failureReason: string | undefined;
    if (exceedsPoolBalance) {
      failureReason = `Requested amount (${application.requestedAmountQOR} QOR) exceeds current remaining pool treasury balance`;
    } else if (exceedsMaxGrantLimit) {
      failureReason = `Requested amount (${application.requestedAmountQOR} QOR) exceeds pool single-grant ceiling`;
    } else if (!milestoneAllocationValid) {
      failureReason = `Milestone percentages sum to ${milestoneSumPct}%, must be exactly 100% across 3 phases`;
    }

    return {
      approved: deterministicChecksPassed,
      poolId: pool.id,
      requestedAmountBaseUnits: requestedBaseUnits,
      poolBalanceBaseUnits: pool.remainingBudgetBaseUnits,
      maxGrantLimitBaseUnits: pool.maxGrantLimitBaseUnits,
      exceedsPoolBalance,
      exceedsMaxGrantLimit,
      milestoneAllocationValid,
      milestoneDistribution,
      deterministicChecksPassed,
      failureReason,
    };
  }
}
