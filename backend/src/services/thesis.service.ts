import { ThesisRepository } from '../repositories/thesis.repository';
import { DefenseApplicationsRepository } from '../repositories/defense-applications.repository';
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
import {
  canCreateDefenseSchedule,
  hasActiveCurrentStageSchedule,
  hasCurrentStageConclusion,
} from './defense-application-workflow';
import { canApplyReviewTransition } from './defense-workflow.rules';
import { AdviserRequestService } from './adviser-request.service';
import { OralEvaluationService } from './oral-evaluation.service';
import { OfficialDefenseRecordService } from './official-defense-record.service';
import { RapporteurFinalizationService } from './rapporteur-finalization.service';
import { RapReportService } from './rap-report.service';

export interface ScheduleDefenseInput {
  defenseDate: string;
  defenseTime: string;
  venueOrLink: string;
  defenseType: DefenseTypeName | string;
  assignments: CommitteeAssignmentInput[];
}

export class ThesisService {
  private thesisRepo = new ThesisRepository();
  private oralEvaluation = new OralEvaluationService();
  private defenseAppsRepo = new DefenseApplicationsRepository();
  private eligibilityRepo = new DefenseEligibilityRepository();
  private eligibility = new DefenseEligibilityService();
  private committeePolicy = new DefenseCommitteePolicy();
  private adviserRequestService = new AdviserRequestService();
  private conclusion = new DefenseConclusionService();
  private officialRecords = new OfficialDefenseRecordService();
  private rapporteurFinalization = new RapporteurFinalizationService();
  private rapReports = new RapReportService();

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
    // Scheduling candidates share Defense Applications READY semantics.
    const defenseTypeToStage: Record<string, string> = {
      TITLE_DEFENSE: 'TITLE',
      PROPOSAL_DEFENSE: 'PROPOSAL',
      FINAL_DEFENSE: 'FINAL',
    };
    const stage =
      params.defenseType && params.defenseType !== 'ALL'
        ? defenseTypeToStage[params.defenseType] || params.defenseType
        : undefined;
    return this.defenseAppsRepo.getDefenseApplicationsPaginated({
      page,
      pageSize,
      bucket: 'READY',
      search: params.search,
      stage,
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
    bucket?: string;
    programId?: string;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(params.pageSize) || 10));
    return this.defenseAppsRepo.getDefenseApplicationsPaginated({
      page,
      pageSize,
      search: params.search,
      stage: params.stage,
      status: params.status,
      bucket: params.bucket,
      programId: params.programId,
    });
  }

  async getDefenseWorkflowSummary(params: {
    search?: string;
    stage?: string;
    programId?: string;
    status?: string;
  }) {
    return this.defenseAppsRepo.getDefenseWorkflowSummary(params);
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
    corPath: string,
    receiptPath: string,
  ) {
    const student = await this.thesisRepo.getStudentByUserId(userId);
    if (!student) throw new AppError('Student profile not found.', 404);

    const snap = await this.eligibilityRepo.loadForStudent(student.id);
    // Certified Proposal manuscript is system-owned (reviewedDocumentId).
    // Student only supplies COR + fee proof at final application time.
    const result = this.eligibility.evaluateApplyProposal(snap, {
      manuscript: snap.evidence.proposalChapters,
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

    return this.thesisRepo.updateThesisToProposal(thesis.id, corPath, receiptPath);
  }

  async applyFinalDefense(
    userId: string,
    corPath: string,
    receiptPath: string,
  ) {
    const student = await this.thesisRepo.getStudentByUserId(userId);
    if (!student) throw new AppError('Student profile not found.', 404);

    const snap = await this.eligibilityRepo.loadForStudent(student.id);
    // CP4: certified Final manuscript is system-owned (reviewedDocumentId).
    const result = this.eligibility.evaluateApplyFinal(snap, {
      manuscript: snap.evidence.finalManuscript,
      cor: !!corPath,
      receipt: !!receiptPath,
    });
    this.eligibility.assertEligible(result);

    const thesis = await this.thesisRepo.getActiveThesis(student.id);
    if (!thesis) throw new AppError('No active Thesis Record found.', 400);

    return this.thesisRepo.updateThesisToFinal(thesis.id, corPath, receiptPath);
  }


  async requestAdviser(userId: string, data: any) {
    return this.adviserRequestService.createRequest(userId, {
      requestedAdviserId: data.requestedAdviserId,
      reason: data.reason,
    });
  }

  async listAdviserCandidates(userId: string) {
    return this.adviserRequestService.listOdpCandidates(userId);
  }

  /** WP3: requested-Adviser inbox (scoped to authenticated user). */
  async listMyAdviserRequests(userId: string) {
    return this.adviserRequestService.listMyAdviserRequests(userId);
  }

  /** WP3: CONFORME / Decline only. */
  async respondAdviserRequest(
    userId: string,
    requestId: string,
    input: { decision: string; remarks?: string },
  ) {
    return this.adviserRequestService.respondAsAdviser(userId, requestId, {
      decision: input.decision as "CONFORMED" | "DECLINED",
      remarks: input.remarks,
    });
  }

  /** WP4: Dean review queue (CONFORMED + Dean PENDING). */
  async listDeanReviewRequests() {
    return this.adviserRequestService.listDeanReviewRequests();
  }

  /** WP4: Dean APPROVE / REJECT — only path that creates AdviserAssignment. */
  async deanDecideAdviserRequest(
    deanUserId: string,
    requestId: string,
    input: { decision: string; remarks?: string },
  ) {
    return this.adviserRequestService.deanDecideAdviserRequest(
      deanUserId,
      requestId,
      {
        decision: input.decision as "APPROVED" | "REJECTED",
        remarks: input.remarks,
      },
    );
  }

  /**
   * Legacy /adviser/assign — hardened compatibility wrapper.
   * Does NOT accept arbitrary adviser replacement. Delegates to the same
   * GS-020 Dean approval invariant (CONFORME required; assigned adviser is
   * always request.requestedAdviserId).
   * @deprecated Use deanDecideAdviserRequest instead.
   */
  async assignAdviser(adminId: string, data: any) {
    const requestId = String(data?.requestId || data?.id || "").trim();
    if (!requestId) {
      throw new AppError("requestId is required.", 400);
    }
    // Legacy body may include adviserId — ignored on purpose. Assignment always
    // uses request.requestedAdviserId inside the Dean approval transaction.
    return this.adviserRequestService.deanDecideAdviserRequest(
      adminId,
      requestId,
      { decision: "APPROVED", remarks: data?.remarks },
    );
  }

  async updateDefenseStatus(thesisId: string, data: { status: string }) {
    const status = String(data.status || '').toUpperCase();
    const thesis = await this.thesisRepo.getThesisById(thesisId);
    if (!thesis) {
      throw new AppError('Defense application not found.', 404);
    }

    const schedules = await this.thesisRepo.findNonCancelledSchedules(thesisId);
    const hasActiveCurrentSession = hasActiveCurrentStageSchedule(
      thesis.stage,
      schedules,
    );
    // Only the CURRENT stage's conclusion locks application review.
    // Prior-stage Title/Proposal conclusions must not block the next stage.
    const hasCurrentConclusion = hasCurrentStageConclusion(
      thesis.stage,
      schedules,
    );

    const gate = canApplyReviewTransition({
      currentStatus: thesis.status,
      nextStatus: status,
      hasActiveCurrentSession,
      hasConclusion: hasCurrentConclusion,
      // ThesisRecord.outcome can mirror an earlier stage; do not use it alone.
      outcome: hasCurrentConclusion ? thesis.outcome : null,
    });
    if (!gate.allowed) {
      throw new AppError(gate.reason || 'Invalid application review transition.', 400);
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

    // Reject a second non-cancelled schedule for this defense type.
    const existingSchedules = await this.thesisRepo.findNonCancelledSchedules(
      thesisId,
    );
    const gate = canCreateDefenseSchedule({
      defenseType,
      schedules: existingSchedules,
    });
    if (!gate.allowed) {
      throw new AppError(gate.reason || 'Defense already scheduled.', 400);
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

  /**
   * CP5 legacy compatibility: /score saves the caller's own DRAFT only.
   * Never FINALIZED; never trusts client panelId as ownership.
   */
  async submitOralExamScore(
    userId: string,
    panelId: string,
    scheduleId: string,
    data: any,
  ) {
    // CP5-FIX2: sparse criteria — only keys actually present on the client payload.
    const CRITERIA = [
      "timelinessRelevance",
      "organization",
      "depthComprehensiveness",
      "relevanceConclusions",
      "evidenceOriginalThinking",
      "presentation",
      "masterySubject",
      "communicationSkill",
      "attitude",
    ] as const;
    const criteria: Record<string, unknown> = {};
    const src = data ?? {};
    for (const key of CRITERIA) {
      if (Object.prototype.hasOwnProperty.call(src, key)) {
        criteria[key] = src[key];
      }
    }
    const optional: Record<string, unknown> = {};
    if (Object.prototype.hasOwnProperty.call(src, "rating")) {
      optional.rating = src.rating;
    }
    if (Object.prototype.hasOwnProperty.call(src, "recommendations")) {
      optional.recommendations = src.recommendations;
    }
    return this.oralEvaluation.saveDraft(scheduleId, userId, {
      criteria: criteria as never,
      ...optional,
      clientPanelId: panelId ?? null,
    } as Parameters<typeof this.oralEvaluation.saveDraft>[2]);
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
    // CP7: locked after Rapporteur finalization.
    await this.rapporteurFinalization.assertNotesEditable(scheduleId);
    return this.thesisRepo.updateRapporteurNotes(scheduleId, notes);
  }

  /**
   * CP7 formal conclusion — session CHAIRMAN assignment only.
   * Explicit outcome required (no PASSED default). Independent of numeric scores.
   */
  async concludeDefense(
    scheduleId: string,
    userId: string,
    options?: {
      outcome?: string | null;
      selectedTitleId?: string | null;
      finalRemarks?: string | null;
    },
  ) {
    const schedule = await this.thesisRepo.getDefenseScheduleForConclude(scheduleId);
    if (!schedule) throw new AppError("Defense schedule not found.", 404);

    // Session assignment authority first (never account role alone).
    const assignments = await this.resolveSessionAssignments(scheduleId, userId);
    const sessionRole = assignments.find((a) => a.userId === userId)?.role ?? null;
    const isSessionChairman = sessionRole === "CHAIRMAN";

    // Chairman authorization must be established before any Summary recovery side-effect.
    if (!isSessionChairman) {
      throw new AppError(
        "Only the assigned session Chairman may record the formal academic result.",
        403,
      );
    }
    if (schedule.alreadyConcluded) {
      throw new AppError(
        "Defense has already been concluded. A second conclusion is not allowed.",
        409,
      );
    }

    // CP7-FIX1 Issue 5: recover missing Summary after Chairman auth (transient failure).
    if (schedule.defenseType !== "TITLE_DEFENSE") {
      try {
        await this.officialRecords.ensureOralExamSummary(scheduleId);
      } catch {
        // Genuine incomplete evaluator state still rejects below / in transaction.
      }
      // Re-fetch authoritative readiness after recovery attempt.
      const refreshed = await this.thesisRepo.getDefenseScheduleForConclude(scheduleId);
      if (refreshed) {
        schedule.oralSummaryExists = refreshed.oralSummaryExists;
        schedule.evaluatorAssignments = refreshed.evaluatorAssignments;
        schedule.finalizedEvaluatorScores = refreshed.finalizedEvaluatorScores;
        schedule.sessionStatus = refreshed.sessionStatus;
        schedule.rapporteurNotesFinalized = refreshed.rapporteurNotesFinalized;
        schedule.alreadyConcluded = refreshed.alreadyConcluded;
      }
    }

    const outcome = this.conclusion.assertCanConclude(
      {
        alreadyConcluded: schedule.alreadyConcluded,
        sessionRole,
        isSessionChairman,
        evaluatorAssignments: schedule.evaluatorAssignments,
        finalizedEvaluatorScores: schedule.finalizedEvaluatorScores,
        defenseType: schedule.defenseType,
        sessionStatus: schedule.sessionStatus,
        rapporteurNotesFinalized: schedule.rapporteurNotesFinalized,
        oralSummaryExists: schedule.oralSummaryExists,
        selectedTitleId: options?.selectedTitleId ?? null,
        thesisTitleIds: schedule.thesisTitleIds,
        outcomeProvided:
          options?.outcome != null && String(options.outcome).trim() !== "",
      },
      options?.outcome,
    );

    try {
      return await this.thesisRepo.concludeDefense(scheduleId, userId, {
        outcome,
        selectedTitleId: options?.selectedTitleId ?? null,
        finalRemarks: options?.finalRemarks ?? null,
      });
    } catch (error: unknown) {
      // CP7-FIX1 Issue 11: unique race → 409, never expose raw Prisma errors.
      const code = (error as { code?: string })?.code;
      if (code === "P2002") {
        throw new AppError(
          "Defense has already been concluded or official records were created by another request.",
          409,
        );
      }
      throw error;
    }
  }

  /** Alias for the canonical CP7 conclusion endpoint. */
  async recordFormalConclusion(
    scheduleId: string,
    userId: string,
    options?: {
      outcome?: string | null;
      selectedTitleId?: string | null;
      finalRemarks?: string | null;
    },
  ) {
    return this.concludeDefense(scheduleId, userId, options);
  }

  async finalizeDefenseNotes(scheduleId: string, userId: string) {
    return this.rapporteurFinalization.finalizeDefenseNotes(scheduleId, userId);
  }

  async getOfficialCriteria(
    scheduleId: string,
    panelAssignmentId: string,
    actor: { userId: string; role: string },
  ) {
    // CP7-FIX1 Issue 8: authorization happens inside the service BEFORE any backfill.
    return this.officialRecords.getOfficialCriteria(
      scheduleId,
      panelAssignmentId,
      actor,
    );
  }

  async getOralExamSummaryRecord(
    scheduleId: string,
    actor: { userId: string; role: string },
  ) {
    return this.officialRecords.getSummaryReadModel(scheduleId, actor);
  }

  async getStudentDefenseRap(scheduleId: string, userId: string) {
    return this.rapReports.getStudentRapAccess(scheduleId, userId);
  }

  async getAdminDefenseRecords(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
  }) {
    return this.officialRecords.listAdminDefenseRecords(params);
  }

  async getAdminDefenseRecordDetail(scheduleId: string) {
    return this.officialRecords.getAdminDefenseRecordDetail(scheduleId);
  }

  private async resolveSessionAssignments(scheduleId: string, userId: string) {
    return this.thesisRepo.getSessionPanelAssignments(scheduleId, userId);
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
