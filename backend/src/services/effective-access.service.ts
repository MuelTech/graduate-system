import { CurrentAccount, currentAccountResponse } from "./current-account";
import { isAcademicAccountRole } from "../utils/academic-account";
import { AdviserWorkspaceRepository } from "../repositories/adviser-workspace.repository";
import { AdviserRequestService } from "./adviser-request.service";
import { AdviserCertificationRecordService } from "./adviser-certification-record.service";
import { PanelistDashboardRepository } from "../repositories/panelist-dashboard.repository";
import { AppError } from "../utils/AppError";

export interface FacultyWorkSummary {
  essayEvaluations: { relevant: boolean };
  myAdvisees: {
    relevant: boolean;
    activeAdviseeCount: number;
    addressedRequestCount: number;
    issuedCertificationCount: number;
  };
  myDefenses: { relevant: boolean; assignmentCount: number };
}

/** Navigation/card hints only. No relevant flag or count authorizes a resource.
 * Exact Essay/Adviser/Defense/Admin APIs must independently reauthorize.
 * Input is exclusively the fresh current account established by authentication.
 * No cross-request cache, cross-account lookup, queue scan or activation switch.
 */
export class EffectiveAccessService {
  constructor(
    private readonly advisees = new AdviserWorkspaceRepository(),
    private readonly requests = new AdviserRequestService(),
    private readonly certifications = new AdviserCertificationRecordService(),
    private readonly defenses = new PanelistDashboardRepository(),
  ) {}

  async currentAccount(account: CurrentAccount) {
    const response = currentAccountResponse(account);
    let facultyWork: FacultyWorkSummary | null = null;
    // Invalid/unavailable access is explicit in configuredAccess.status; null is
    // unavailable/not-applicable, distinct from a valid all-zero work summary.
    if (isAcademicAccountRole(account.role) && response.configuredAccess.status === "RESOLVED") {
      try {
        const [activeAdviseeCount, addressedRequestCount, issuedCertificationCount, assignmentCount] = await Promise.all([
          this.advisees.countSoleActiveAdvisees(account.id),
          this.requests.countMyAdviserRequests(account.id),
          this.certifications.countOwnIssuedSources(account.id),
          this.defenses.countReadableAssignments(account.id),
        ]);
        // A broken read model must never masquerade as legitimate zero work.
        if ([activeAdviseeCount, addressedRequestCount, issuedCertificationCount, assignmentCount]
          .some(count => !Number.isSafeInteger(count) || count < 0)) {
          throw new AppError("Faculty work could not be established.", 503);
        }
        facultyWork = {
          essayEvaluations: { relevant: response.configuredAccess.capabilities.includes("essay.evaluate") },
          myAdvisees: {
            relevant: activeAdviseeCount > 0 || addressedRequestCount > 0 || issuedCertificationCount > 0,
            activeAdviseeCount, addressedRequestCount, issuedCertificationCount,
          },
          myDefenses: { relevant: assignmentCount > 0, assignmentCount },
        };
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError("Faculty work could not be established.", 503);
      }
    }
    return { ...response, facultyWork };
  }
}
