import { EligibilityAgentOutput, ProjectCategory } from "@qoresentinel/shared";

export interface PoolEligibilityCriteria {
  poolCategory: ProjectCategory;
  maxGrantQOR: number;
  permittedCategories: ProjectCategory[];
  eligibilityCriteria: string[];
}

export class EligibilityAgent {
  public static readonly role = "ELIGIBILITY_AGENT";
  public static readonly name = "Eligibility Agent";

  /**
   * Evaluates application details against the funding pool's explicit criteria.
   */
  public static async process(
    application: {
      category: ProjectCategory;
      requestedAmountQOR: number;
      projectTitle: string;
      projectDescription: string;
      milestones: Array<{ title: string; percentage: number }>;
    },
    poolCriteria: PoolEligibilityCriteria
  ): Promise<EligibilityAgentOutput> {
    const reasons: string[] = [];
    const missingRequirements: string[] = [];
    const evidenceReferences: string[] = [];
    let eligible = true;

    // 1. Category alignment check
    const categoryMatches =
      application.category === poolCriteria.poolCategory ||
      poolCriteria.permittedCategories.includes(application.category);

    if (categoryMatches) {
      reasons.push(`Category '${application.category}' matches pool specialization`);
    } else {
      eligible = false;
      missingRequirements.push(
        `Project category '${application.category}' does not match pool category '${poolCriteria.poolCategory}'`
      );
    }

    // 2. Budget ceiling eligibility
    if (application.requestedAmountQOR <= poolCriteria.maxGrantQOR) {
      reasons.push(
        `Requested grant amount (${application.requestedAmountQOR} QOR) is within pool maximum grant cap (${poolCriteria.maxGrantQOR} QOR)`
      );
    } else {
      eligible = false;
      missingRequirements.push(
        `Requested amount (${application.requestedAmountQOR} QOR) exceeds pool maximum allowance (${poolCriteria.maxGrantQOR} QOR)`
      );
    }

    // 3. Milestone criteria check (must have 3 phased deliverables)
    if (application.milestones && application.milestones.length === 3) {
      const sum = application.milestones.reduce((acc, m) => acc + m.percentage, 0);
      if (sum === 100) {
        reasons.push("Applicant provided complete 3-phase milestone execution plan summing to 100%");
        evidenceReferences.push("Milestone roadmap specification");
      } else {
        eligible = false;
        missingRequirements.push(`Milestone percentages sum to ${sum}%, expected exactly 100%`);
      }
    } else {
      eligible = false;
      missingRequirements.push("Project must define exactly 3 execution milestones (Initial, Progress, Completion)");
    }

    // 4. Description depth check
    if (application.projectDescription && application.projectDescription.length >= 30) {
      reasons.push("Project technical scope has sufficient descriptive depth for evaluation");
      evidenceReferences.push("Technical architecture abstract");
    } else {
      eligible = false;
      missingRequirements.push("Project description lacks sufficient technical specification");
    }

    return {
      eligible,
      reasons,
      missingRequirements,
      confidence: eligible ? 0.96 : 0.98,
      evidenceReferences,
      categoryMatches,
    };
  }
}
