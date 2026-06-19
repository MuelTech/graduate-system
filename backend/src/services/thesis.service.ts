import { ThesisRepository } from '../repositories/thesis.repository';
import { ApplyTitleDefenseInput } from '../interfaces/thesis.interfaces';

export class ThesisService {
  private thesisRepo = new ThesisRepository();

  async applyTitleDefense(userId: string, data: ApplyTitleDefenseInput, filePath: string) {
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
    return this.thesisRepo.createTitleDefense(student.id, adviserAssignment.id, titles, filePath);
  }

  async applyProposalDefense(userId: string, filePath: string) {
    const student = await this.thesisRepo.getStudentByUserId(userId);
    if (!student) throw new Error("Student profile not found.");

    const thesis = await this.thesisRepo.getActiveThesis(student.id);
    if (!thesis) throw new Error("No active Thesis Record found. Please apply for Title Defense first.");
    
    // STRICT VALIDATION: Can only move to Proposal if Title was PASSED
    if (thesis.stage === 'TITLE' && thesis.status !== 'PASSED') {
      throw new Error("Your Title Defense must be PASSED before applying for Proposal Defense.");
    }

    return this.thesisRepo.updateThesisToProposal(thesis.id, filePath);
  }

  async applyFinalDefense(userId: string, filePath: string) {
    const student = await this.thesisRepo.getStudentByUserId(userId);
    if (!student) throw new Error("Student profile not found.");

    const thesis = await this.thesisRepo.getActiveThesis(student.id);
    if (!thesis) throw new Error("No active Thesis Record found.");
    
    // STRICT VALIDATION: Can only move to Final if Proposal was PASSED
    if (thesis.stage === 'PROPOSAL' && thesis.status !== 'PASSED') {
      throw new Error("Your Proposal Defense must be PASSED before applying for Final Defense.");
    }

    return this.thesisRepo.updateThesisToFinal(thesis.id, filePath);
  }
}
