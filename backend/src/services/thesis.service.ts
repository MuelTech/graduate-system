import { ThesisRepository } from '../repositories/thesis.repository';
import { ApplyTitleDefenseInput } from '../interfaces/thesis.interfaces';

export class ThesisService {
  private thesisRepo = new ThesisRepository();

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

  async applyTitleDefense(userId: string, data: ApplyTitleDefenseInput, conceptPaperPath: string, corPath: string, receiptPath: string) {
    const student = await this.thesisRepo.getStudentByUserId(userId);
    if (!student) throw new Error("Student profile not found.");

    // STRICT VALIDATION: Must have an adviser first!
    const adviserAssignment = await this.thesisRepo.getActiveAdviserAssignment(student.id);
    if (!adviserAssignment) {
      throw new Error("You must have an approved Thesis Adviser before applying for a Title Defense.");
    }

    // Ensure they don't already have an active thesis
    const existingThesis = await this.thesisRepo.getActiveThesis(student.id);
    if (existingThesis && existingThesis.status !== 'FAILED') {
      throw new Error("You already have an active Thesis Record in progress.");
    }

    const titles = [data.title1, data.title2, data.title3];
    return this.thesisRepo.createTitleDefense(student.id, adviserAssignment.id, titles, conceptPaperPath, corPath, receiptPath);
  }

  async applyProposalDefense(userId: string, filePath: string, corPath: string) {
    const student = await this.thesisRepo.getStudentByUserId(userId);
    if (!student) throw new Error("Student profile not found.");

    const thesis = await this.thesisRepo.getActiveThesis(student.id);
    if (!thesis) throw new Error("No active Thesis Record found. Please apply for Title Defense first.");
    
    // STRICT VALIDATION: Can only move to Proposal if Title was PASSED
    if (thesis.stage === 'TITLE' && thesis.status !== 'PASSED') {
      throw new Error("Your Title Defense must be PASSED before applying for Proposal Defense.");
    }

    return this.thesisRepo.updateThesisToProposal(thesis.id, filePath, corPath);
  }

  async applyFinalDefense(userId: string, filePath: string, corPath: string) {
    const student = await this.thesisRepo.getStudentByUserId(userId);
    if (!student) throw new Error("Student profile not found.");

    const thesis = await this.thesisRepo.getActiveThesis(student.id);
    if (!thesis) throw new Error("No active Thesis Record found.");
    
    // STRICT VALIDATION: Can only move to Final if Proposal was PASSED
    if (thesis.stage === 'PROPOSAL' && thesis.status !== 'PASSED') {
      throw new Error("Your Proposal Defense must be PASSED before applying for Final Defense.");
    }

    return this.thesisRepo.updateThesisToFinal(thesis.id, filePath, corPath);
  }

  async requestAdviser(userId: string, data: any) {
    const student = await this.thesisRepo.getStudentByUserId(userId);
    if (!student) throw new Error("Student profile not found.");
    return this.thesisRepo.createAdviserRequest(student.id, data.requestedAdviserId, data.reason);
  }

  async assignAdviser(adminId: string, data: any) {
    return this.thesisRepo.approveAdviserRequest(data.requestId, data.adviserId, adminId);
  }

  async updateDefenseStatus(thesisId: string, data: any) {
    return this.thesisRepo.updateThesisStatus(thesisId, data.status, data.approvedTitleId);
  }

  async scheduleDefense(thesisId: string, adminId: string, data: any) {
    const schedule = await this.thesisRepo.scheduleDefense(thesisId, adminId, data);
    
    // MOCK EMAIL NOTIFICATION SYSTEM
    console.log(`\n=========================================`);
    console.log(`[EMAIL SYSTEM] Generating Panel Invitations`);
    console.log(`=========================================`);
    
    const panelistIds = [data.chairmanId, data.leadPanelistId, data.externalPanelistId].filter(Boolean);
    
    console.log(`To: Panelist IDs ${panelistIds.join(', ')}`);
    console.log(`Subject: New Defense Schedule Assignment`);
    console.log(`Message: You have been assigned to a ${data.defenseType} as a Panelist.`);
    console.log(`Date: ${new Date(data.defenseDate).toDateString()}`);
    console.log(`Time: ${data.defenseTime}`);
    console.log(`Location/Link: ${data.venueOrLink}`);
    console.log(`=========================================\n`);

    return schedule;
  }
}
