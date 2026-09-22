import { ThesisRepository } from '../repositories/thesis.repository';
import { DefenseEligibilityRepository } from '../repositories/defense-eligibility.repository';
import {
  DefenseEligibilityService,
  type ApplyTitleEligibilityInput,
} from './defense-eligibility.service';
import { DefenseCommitteePolicy } from './defense-committee.policy';
import { DefenseConclusionService } from './defense-conclusion.service';
import { mapProgramType } from '../interfaces/defense-committee.interfaces';
import { ApplyTitleDefenseInput } from '../interfaces/thesis.interfaces';
import type {
  DefenseTypeName,
  MissingRequirement,
} from '../interfaces/defense-eligibility.interfaces';
import type {
  CommitteeAssignmentInput,
} from '../interfaces/defense-committee.interfaces';
import { AppError } from '../utils/AppError';

export interface ScheduleDefenseInput {
  defenseDate: string;
  defenseTime: string;
  venueOrLink: string;
  defenseType: DefenseTypeName | string;
  assignments: CommitteeAssignmentInput[];
}

export class ThesisService {
  private thesisRepo = new ThesisRepository();
  private eligibilityRepo = new DefenseEligibilityRepository();
  private eligibility = new DefenseEligibilityService();
  private committeePolicy = new DefenseCommitteePolicy();
  private conclusion = new DefenseConclusionService();

  async getPendingDefenses() {
    return this.thesisRepo.getPendingDefenses();
  }

  async getApprovedDefenses() {
    return this.thesisRepo.getApprovedDefenses();
  }

  async getApprovedApplicationsPaginated(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    defenseType?: string;
    programId?: string;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(params.pageSize) || 10));
    return this.thesisRepo.getApprovedApplicationsPaginated({
      page,
      pageSize,
      search: params.search,
      defenseType: params.defenseType,
      programId: params.programId,
    });
  }

  async searchActivePanelists(params: {
    page?: number;
    pageSize?: number;
    search?: string;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(params.pageSize) || 20));
    return this.thesisRepo.searchActivePanelists({
      page,
      pageSize,
      search: params.search,
    });
  }

  /** Read model for student/admin UI — same rules the apply/schedule gates use (§17.6). */
  async getMyEligibility(userId: string, defenseType: string) {
    const type = String(defenseType || "").toUpperCase() as DefenseTypeName;
    if (!["TITLE_DEFENSE", "PROPOSAL_DEFENSE", "FINAL_DEFENSE"].includes(type)) {
      throw new AppError("Invalid defense type.", 400);
    }
    const student = await this.thesisRepo.getStudentByUserId(userId);
    if (!student) throw new AppError("Student profile not found.", 404);

    const snap = await this.eligibilityRepo.loadForStudent(student.id);
    let result;
    if (type === "TITLE_DEFENSE") {
      result = this.eligibility.evaluateApplyTitle({
        studentExists: true,
        compExamPassed: snap.compExamPassed,
        compExamDismissed: snap.compExamDismissed,
        hasActiveThesisBlocking: false,
        titleCountFromRequest: snap.titleCount >= 3 ? 3 : snap.titleCount,
        hasConceptPaper: snap.evidence.titlePackage,
        hasCor: snap.evidence.corTitle,
        hasReceipt: snap.evidence.receiptTitle,
      });
    } else if (type === "PROPOSAL_DEFENSE") {
      result = this.eligibility.evaluateApplyProposal(snap);
    } else {
      result = this.eligibility.evaluateApplyFinal(snap);
    }

    return {
      defenseType: type,
      eligible: result.eligible,
      missing: result.missing,
      researchVariables: snap.researchVariables,
      evidence: snap.evidence,
      adviserCerts: snap.adviserCerts,
      thesisOutcome: snap.thesisOutcome,
      thesisStage: snap.thesisStage,
      thesisStatus: snap.thesisStatus,
      hasSelectedTitle: snap.hasSelectedTitle,
      titleRapSigned: snap.titleRapSigned,
      proposalRapSigned: snap.proposalRapSigned,
    };
  }

  /** Expose committee policy so the UI does not duplicate role rules. */
  getCommitteePolicy(defenseType: string, programType?: string) {
    if (
      !["TITLE_DEFENSE", "PROPOSAL_DEFENSE", "FINAL_DEFENSE"].includes(defenseType)
    ) {
      throw new AppError("Invalid defense type.", 400);
    }
    const mapped = mapProgramType(programType);
    return this.committeePolicy.getPolicy(
      defenseType as DefenseTypeName,
      mapped,
    );
  }

  async getAllDefenses() {
    return this.thesisRepo.getAllDefenses();
  }

  async getDefenseApplicationsPaginated(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    stage?: string;
    status?: string;
    programId?: string;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(params.pageSize) || 10));
    return this.thesisRepo.getDefenseApplicationsPaginated({
      page,
      pageSize,
      search: params.search,
      stage: params.stage,
      status: params.status,
      programId: params.programId,
    });
  }

  async getAllAdviserRequests() {
    return this.thesisRepo.getAllAdviserRequests();
  }

  async getAllActiveAssignments() {
    return this.thesisRepo.getAllActiveAssignments();
  }

  async getAvailableAdvisers() {
    return this.thesisRepo.getAvailableAdvisers();
  }

  /** Defense committee candidates: active PANELIST users (not adviser-availability filtered). */
  async getActivePanelistCandidates() {
    return this.thesisRepo.getActivePanelistCandidates();
  }

  async rejectApplication(thesisId: string, reason: string) {
    if (!reason || !reason.trim()) {
      throw new AppError('Rejection reason is required.', 400);
    }
    return this.thesisRepo.updateThesisStatus(thesisId, 'REJECTED', {
      rejectionReason: reason.trim(),
    });
  }

  async resubmitApplication(userId: string, thesisId: string) {
    const student = await this.thesisRepo.getStudentByUserId(userId);
    if (!student) throw new AppError('Student profile not found.', 404);
    const thesis = await this.thesisRepo.getThesisById(thesisId);
    if (!thesis || thesis.studentId !== student.id) {
      throw new AppError('Application not found.', 404);
    }
    if (thesis.status !== 'REJECTED') {
      throw new AppError('Only rejected applications can be resubmitted.', 400);
    }
    return this.thesisRepo.resubmitApplication(thesisId);
  }

  async applyTitleDefense(
    userId: string,
    data: ApplyTitleDefenseInput,
    conceptPaperPath: string,
    corPath: string,
    receiptPath: string,
  ) {
    const student = await this.thesisRepo.getStudentByUserId(userId);
    const snap = student
      ? await this.eligibilityRepo.loadForStudent(student.id)
      : null;

    const titles = [data.title1, data.title2, data.title3];
    const existingThesis = student
      ? await this.thesisRepo.getActiveThesis(student.id)
      : null;

    const input: ApplyTitleEligibilityInput = {
      studentExists: !!student,
      compExamPassed: snap?.compExamPassed ?? false,
      compExamDismissed: snap?.compExamDismissed ?? false,
      hasActiveThesisBlocking:
        !!existingThesis && existingThesis.status !== 'FAILED',
      titleCountFromRequest: titles.filter((t) => t && t.trim()).length,
      hasConceptPaper: !!conceptPaperPath,
      hasCor: !!corPath,
      hasReceipt: !!receiptPath,
    };

    this.eligibility.assertEligible(this.eligibility.evaluateApplyTitle(input));

    if (!student) throw new AppError('Student profile not found.', 404);

    // Client: Title Defense has no adviser requirement.
    // Link an active adviser when one already exists; otherwise leave null.
    const adviserAssignment = await this.thesisRepo.getActiveAdviserAssignment(
      student.id,
    );

    return this.thesisRepo.createTitleDefense(
      student.id,
      adviserAssignment?.id ?? null,
      titles,
      conceptPaperPath,
      corPath,
      receiptPath,
    );
  }

  async applyProposalDefense(
    userId: string,
    filePath: string,
    corPath: string,
    receiptPath: string,
  ) {
    const student = await this.thesisRepo.getStudentByUserId(userId);
    if (!student) throw new AppError('Student profile not found.', 404);

    const snap = await this.eligibilityRepo.loadForStudent(student.id);
    const result = this.eligibility.evaluateApplyProposal(snap, {
      manuscript: !!filePath,
      cor: !!corPath,
      receipt: !!receiptPath,
    });
    this.eligibility.assertEligible(result);

    const thesis = await this.thesisRepo.getActiveThesis(student.id);
    if (!thesis) {
      throw new AppError(
        'No active Thesis Record found. Please apply for Title Defense first.',
        400,
      );
    }

    return this.thesisRepo.updateThesisToProposal(
      thesis.id,
      filePath,
      corPath,
      receiptPath,
    );
  }

  async applyFinalDefense(
    userId: string,
    filePath: string,
    corPath: string,
    receiptPath: string,
  ) {
    const student = await this.thesisRepo.getStudentByUserId(userId);
    if (!student) throw new AppError('Student profile not found.', 404);

    const snap = await this.eligibilityRepo.loadForStudent(student.id);
    const result = this.eligibility.evaluateApplyFinal(snap, {
      manuscript: !!filePath,
      cor: !!corPath,
      receipt: !!receiptPath,
    });
    this.eligibility.assertEligible(result);

    const thesis = await this.thesisRepo.getActiveThesis(student.id);
    if (!thesis) throw new AppError('No active Thesis Record found.', 400);

    return this.thesisRepo.updateThesisToFinal(
      thesis.id,
      filePath,
      corPath,
      receiptPath,
    );
  }


  async requestAdviser(userId: string, data: any) {
    const student = await this.thesisRepo.getStudentByUserId(userId);
    if (!student) throw new Error('Student profile not found.');
    return this.thesisRepo.createAdviserRequest(
      student.id,
      data.requestedAdviserId,
      data.reason,
    );
  }

  async assignAdviser(adminId: string, data: any) {
    return this.thesisRepo.approveAdviserRequest(
      data.requestId,
      data.adviserId,
      adminId,
    );
  }

  async updateDefenseStatus(thesisId: string, data: { status: string }) {
    const status = String(data.status || '').toUpperCase();
    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      throw new AppError(
        'Application review may only set PENDING, APPROVED, or REJECTED. Defense outcomes are recorded at conclusion.',
        400,
      );
    }
    return this.thesisRepo.updateThesisStatus(
      thesisId,
      status as 'PENDING' | 'APPROVED' | 'REJECTED',
    );
  }

  async scheduleDefense(thesisId: string, adminId: string, data: ScheduleDefenseInput) {
    const snap = await this.eligibilityRepo.loadForThesis(thesisId);
    const defenseType = String(data.defenseType || '').toUpperCase() as DefenseTypeName;

    if (
      !['TITLE_DEFENSE', 'PROPOSAL_DEFENSE', 'FINAL_DEFENSE'].includes(defenseType)
    ) {
      throw new AppError('Invalid defense type.', 400);
    }

    this.eligibility.assertEligible(
      this.eligibility.evaluateSchedule(snap, defenseType),
    );

    const assignments = Array.isArray(data.assignments) ? data.assignments : [];
    const student = snap.studentId
      ? await this.thesisRepo.getStudentById(snap.studentId)
      : null;
    const programType = mapProgramType(student?.program?.programType);
    const activeAdviser = snap.studentId
      ? await this.thesisRepo.getActiveAdviserAssignment(snap.studentId)
      : null;
    const adviserUserId = activeAdviser?.adviserId ?? null;

    // Adviser relationship is required for Proposal/Final eligibility, but does NOT
    // auto-create a committee seat (source of truth §12.6). Seat is optional/explicit.
    if (
      (defenseType === 'PROPOSAL_DEFENSE' || defenseType === 'FINAL_DEFENSE') &&
      !adviserUserId
    ) {
      throw new AppError(
        'Proposal/Final Defense cannot be scheduled without an active thesis adviser relationship.',
        400,
      );
    }

    const validation = this.committeePolicy.validateAssignments(
      defenseType,
      programType,
      assignments,
      { adviserUserId },
    );
    if (!validation.valid) {
      throw new AppError(validation.errors.join(' '), 400);
    }

    return this.thesisRepo.scheduleDefense(thesisId, adminId, {
      ...data,
      defenseType,
      assignments,
    });
  }

  async getPanelistAssignments(userId: string) {
    return this.thesisRepo.getPanelistAssignments(userId);
  }

  async submitOralExamScore(panelId: string, scheduleId: string, data: any) {
    const schedule = await this.thesisRepo.getDefenseScheduleForScoring(scheduleId);
    if (!schedule) throw new AppError('Defense schedule not found.', 404);
    const evaluatorRoles = this.committeePolicy.getEvaluatorRoles(
      schedule.defenseType as DefenseTypeName,
    );
    return this.thesisRepo.submitOralExamScore(
      panelId,
      scheduleId,
      data,
      evaluatorRoles,
    );
  }

  async getPendingRapReports(userId: string) {
    return this.thesisRepo.getPendingRapReports(userId);
  }

  async signRapReport(sigId: string, userId: string, signatureData: string) {
    return this.thesisRepo.signRapReport(sigId, userId, signatureData);
  }

  async getLobbyStatus(scheduleId: string) {
    return this.thesisRepo.getLobbyStatus(scheduleId);
  }

  async updateRapporteurNotes(scheduleId: string, notes: string) {
    return this.thesisRepo.updateRapporteurNotes(scheduleId, notes);
  }

  async concludeDefense(
    scheduleId: string,
    adminId: string,
    actorRole: string,
    options?: {
      outcome?: 'PASSED' | 'REVISION' | 'REVISION_REQUIRED' | 'FAILED';
      selectedTitleId?: string | null;
    },
  ) {
    // Formal conclusion is the sole writer of academic outcome (Phase E).
    // REVISION / REVISION_REQUIRED is stored but never unlocks the next stage.
    const schedule = await this.thesisRepo.getDefenseScheduleForConclude(scheduleId);
    if (!schedule) throw new AppError('Defense schedule not found.', 404);

    const outcome = this.conclusion.assertCanConclude(
      {
        alreadyConcluded: schedule.alreadyConcluded,
        actorRole,
        evaluatorAssignments: schedule.evaluatorAssignments,
        submittedEvaluatorScores: schedule.submittedEvaluatorScores,
        defenseType: schedule.defenseType,
        selectedTitleId: options?.selectedTitleId ?? null,
        thesisTitleIds: schedule.thesisTitleIds,
      },
      options?.outcome ?? 'PASSED',
    );

    return this.thesisRepo.concludeDefense(scheduleId, adminId, {
      outcome,
      selectedTitleId: options?.selectedTitleId ?? null,
    });
  }

  async getAllRapReports() {
    return this.thesisRepo.getAllRapReports();
  }

  async distributeRapReport(rapId: string) {
    return this.thesisRepo.distributeRapReport(rapId);
  }

  async getMissingSignaturesForRap(rapId: string) {
    return this.thesisRepo.getMissingSignaturesForRap(rapId);
  }
}

export type { MissingRequirement };
