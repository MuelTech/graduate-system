import { ThesisRepository } from '../repositories/thesis.repository';
import { DefenseEligibilityRepository } from '../repositories/defense-eligibility.repository';
import {
  DefenseEligibilityService,
  type ApplyTitleEligibilityInput,
} from './defense-eligibility.service';
import { ApplyTitleDefenseInput } from '../interfaces/thesis.interfaces';
import type {
  DefenseTypeName,
  MissingRequirement,
} from '../interfaces/defense-eligibility.interfaces';
import { AppError } from '../utils/AppError';

export class ThesisService {
  private thesisRepo = new ThesisRepository();
  private eligibilityRepo = new DefenseEligibilityRepository();
  private eligibility = new DefenseEligibilityService();

  async getPendingDefenses() {
    return this.thesisRepo.getPendingDefenses();
  }

  async getApprovedDefenses() {
    return this.thesisRepo.getApprovedDefenses();
  }

  async getAllDefenses() {
    return this.thesisRepo.getAllDefenses();
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

  async applyProposalDefense(userId: string, filePath: string, corPath: string) {
    const student = await this.thesisRepo.getStudentByUserId(userId);
    if (!student) throw new AppError('Student profile not found.', 404);

    const snap = await this.eligibilityRepo.loadForStudent(student.id);
    const result = this.eligibility.evaluateApplyProposal(snap);

    if (!filePath) {
      result.missing.push({
        code: 'PROPOSAL_CHAPTERS',
        message: 'Chapters 1–3 document is required.',
        stage: 'PROPOSAL',
      });
      result.eligible = false;
    }
    if (!corPath) {
      result.missing.push({
        code: 'COR',
        message: 'Certificate of Registration (COR) is required.',
        stage: 'PROPOSAL',
      });
      result.eligible = false;
    }
    this.eligibility.assertEligible(result);

    const thesis = await this.thesisRepo.getActiveThesis(student.id);
    if (!thesis) {
      throw new AppError(
        'No active Thesis Record found. Please apply for Title Defense first.',
        400,
      );
    }

    return this.thesisRepo.updateThesisToProposal(thesis.id, filePath, corPath);
  }

  async applyFinalDefense(userId: string, filePath: string, corPath: string) {
    const student = await this.thesisRepo.getStudentByUserId(userId);
    if (!student) throw new AppError('Student profile not found.', 404);

    const snap = await this.eligibilityRepo.loadForStudent(student.id);
    const result = this.eligibility.evaluateApplyFinal({
      ...snap,
      finalManuscript: !!filePath,
    });

    if (!filePath) {
      result.missing.push({
        code: 'FINAL_MANUSCRIPT',
        message: 'Final manuscript is required.',
        stage: 'FINAL',
      });
      result.eligible = false;
    }
    if (!corPath) {
      result.missing.push({
        code: 'COR',
        message: 'Certificate of Registration (COR) is required.',
        stage: 'FINAL',
      });
      result.eligible = false;
    }
    this.eligibility.assertEligible(result);

    const thesis = await this.thesisRepo.getActiveThesis(student.id);
    if (!thesis) throw new AppError('No active Thesis Record found.', 400);

    return this.thesisRepo.updateThesisToFinal(thesis.id, filePath, corPath);
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

  async updateDefenseStatus(thesisId: string, data: any) {
    return this.thesisRepo.updateThesisStatus(
      thesisId,
      data.status,
      data.approvedTitleId,
    );
  }

  async scheduleDefense(thesisId: string, adminId: string, data: any) {
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

    return this.thesisRepo.scheduleDefense(thesisId, adminId, data);
  }

  async getPanelistAssignments(userId: string) {
    return this.thesisRepo.getPanelistAssignments(userId);
  }

  async submitOralExamScore(panelId: string, scheduleId: string, data: any) {
    return this.thesisRepo.submitOralExamScore(panelId, scheduleId, data);
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

  async concludeDefense(scheduleId: string, adminId: string) {
    return this.thesisRepo.concludeDefense(scheduleId, adminId);
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
