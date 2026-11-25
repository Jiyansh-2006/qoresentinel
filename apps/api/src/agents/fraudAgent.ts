import { FraudAssessmentOutput } from "@qoresentinel/shared";

export interface PastApplicationRecord {
  id: string;
  applicantEmail: string;
  projectTitle: string;
  beneficiaryWallet: string;
  documentHashes: string[];
}

export class FraudDetectionAgent {
  public static readonly role = "FRAUD_AGENT";
  public static readonly name = "Fraud & Duplicate Detection Agent";

  /**
   * Deterministically identifies fraudulent submissions, duplicate proposals,
   * reused document digests, and suspicious wallet patterns.
   */
  public static async process(
    currentApplication: {
      id: string;
      applicantEmail: string;
      projectTitle: string;
      beneficiaryWallet: string;
      requestedAmountQOR: number;
      budgetBreakdown: Array<{ item: string; percentage: number; amountQOR: number }>;
      documentHashes: string[];
    },
    historicalApplications: PastApplicationRecord[]
  ): Promise<FraudAssessmentOutput> {
    const violations: string[] = [];
    let riskScore = 0;
    let duplicateApplication = false;
    let duplicateDocument = false;
    let suspiciousWalletReuse = false;
    let inconsistentBudget = false;

    const normalizedCurrentTitle = currentApplication.projectTitle.toLowerCase().trim();
    const normalizedCurrentWallet = currentApplication.beneficiaryWallet.toLowerCase().trim();
    const currentDocHashSet = new Set(currentApplication.documentHashes.map((h) => h.toLowerCase()));

    // 1. Historical comparison
    for (const past of historicalApplications) {
      if (past.id === currentApplication.id) continue;

      // Duplicate proposal title + email check
      if (
        past.applicantEmail.toLowerCase() === currentApplication.applicantEmail.toLowerCase() &&
        past.projectTitle.toLowerCase().trim() === normalizedCurrentTitle
      ) {
        duplicateApplication = true;
        violations.push(`Duplicate submission detected: identical title and email matching application ID ${past.id}`);
        riskScore += 60;
      }

      // Reused document hash check
      for (const pastDocHash of past.documentHashes) {
        if (currentDocHashSet.has(pastDocHash.toLowerCase())) {
          duplicateDocument = true;
          violations.push(
            `Cryptographic document collision: evidence hash ${pastDocHash.slice(0, 16)}... was already filed under proposal ${past.id}`
          );
          riskScore += 50;
        }
      }

      // Suspicious wallet reuse across conflicting identities
      if (
        past.beneficiaryWallet.toLowerCase() === normalizedCurrentWallet &&
        past.applicantEmail.toLowerCase() !== currentApplication.applicantEmail.toLowerCase()
      ) {
        suspiciousWalletReuse = true;
        violations.push(
          `Sybil warning: Beneficiary wallet ${currentApplication.beneficiaryWallet.slice(0, 10)}... belongs to multiple distinct applicant identities`
        );
        riskScore += 40;
      }
    }

    // 2. Budget consistency check
    const totalBreakdownQOR = currentApplication.budgetBreakdown.reduce((acc, item) => acc + item.amountQOR, 0);
    const difference = Math.abs(totalBreakdownQOR - currentApplication.requestedAmountQOR);

    // If budget items do not match requested amount within 0.001 tolerance
    if (difference > 0.001) {
      inconsistentBudget = true;
      violations.push(
        `Budget mismatch: sum of line items (${totalBreakdownQOR} QOR) does not equal requested funding (${currentApplication.requestedAmountQOR} QOR)`
      );
      riskScore += 35;
    }

    // Check percentage sum
    const totalPercentage = currentApplication.budgetBreakdown.reduce((acc, item) => acc + item.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      inconsistentBudget = true;
      violations.push(`Budget breakdown item percentages sum to ${totalPercentage}%, expected 100%`);
      riskScore += 25;
    }

    // Cap risk score between 0 and 100
    riskScore = Math.min(100, Math.max(0, riskScore));
    const passed = riskScore < 40 && violations.length === 0;

    const details = passed
      ? "Zero duplicate documents or sybil patterns detected across testnet database. Proposal integrity verified."
      : `High fraud risk detected (${riskScore}/100). Violations: ${violations.join("; ")}`;

    return {
      passed,
      riskScore,
      duplicateApplicationDetected: duplicateApplication,
      duplicateDocumentHashDetected: duplicateDocument,
      suspiciousWalletReuse,
      inconsistentBudgetDetected: inconsistentBudget,
      deterministicViolations: violations,
      details,
    };
  }
}
