import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import {
  SubmitApplicationSchema,
  IntakeAgentOutput,
} from "@qoresentinel/shared";

export class ApplicationIntakeAgent {
  public static readonly role = "INTAKE_AGENT";
  public static readonly name = "Application Intake Agent";

  /**
   * Validates incoming microgrant application submissions.
   */
  public static async process(rawApplication: any): Promise<IntakeAgentOutput> {
    const parseResult = SubmitApplicationSchema.safeParse(rawApplication);

    if (!parseResult.success) {
      const errorMessages = parseResult.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`
      );
      return {
        valid: false,
        applicationId: "",
        sanitizedApplicant: String(rawApplication?.applicantName || "Unknown"),
        sanitizedBeneficiary: String(rawApplication?.beneficiaryWalletAddress || ""),
        sanitizedAmount: "0",
        errors: errorMessages,
      };
    }

    const app = parseResult.data;

    // Preserve the persisted application ID. Synthetic/demo and database IDs must
    // remain stable across retries so fraud checks can exclude the current record.
    const suppliedId = typeof rawApplication?.id === "string" ? rawApplication.id.trim() : "";
    const seed = `${app.applicantEmail}:${app.projectTitle}:${app.beneficiaryWalletAddress}:${Date.now()}`;
    const digest = bytesToHex(sha256(new TextEncoder().encode(seed)));
    const applicationId = suppliedId || `app_${digest.slice(0, 16)}`;

    // Additional address sanity check
    if (!app.beneficiaryWalletAddress.startsWith("0x") || app.beneficiaryWalletAddress.length !== 42) {
      return {
        valid: false,
        applicationId,
        sanitizedApplicant: app.applicantName,
        sanitizedBeneficiary: app.beneficiaryWalletAddress,
        sanitizedAmount: app.requestedAmountQOR.toString(),
        errors: ["Invalid beneficiary wallet address format (must be 42-character 0x hex)"],
      };
    }

    return {
      valid: true,
      applicationId,
      sanitizedApplicant: app.applicantName.trim(),
      sanitizedBeneficiary: app.beneficiaryWalletAddress.toLowerCase(),
      sanitizedAmount: app.requestedAmountQOR.toString(),
      errors: [],
    };
  }
}
