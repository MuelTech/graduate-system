import type { ExamImportPersistence, ExamImportMedia, ExamImportSummary, ExamImportCleanup } from "../interfaces/exam-content-import.interfaces";
import { ExamContentImportError } from "../interfaces/exam-content-import.interfaces";
import { preflightExamPackage } from "./exam-content-package.service";
import { validateExamQuestion, examMediaId } from "./exam-content.rules";

export class ExamContentImporter {
  constructor(
    private readonly repo: ExamImportPersistence,
    private readonly media: ExamImportMedia,
    private readonly preflight = preflightExamPackage,
  ) {}

  async importPackage(packageRoot: string): Promise<ExamImportSummary> {
    // Always finish the entire source snapshot before any persistence or promotion.
    const prepared = await this.preflight(packageRoot);
    const existing = await this.repo.find(prepared.packageKey);
    if (existing) {
      if (existing.fingerprint !== prepared.fingerprint ||
          existing.questionCount !== prepared.questions.length ||
          existing.actualQuestionCount !== prepared.questions.length) {
        throw new ExamContentImportError("SOURCE_CONFLICT", "Source identity already exists with different or incomplete content; no changes made.");
      }
      return { ...prepared.counts, status: "ALREADY_IMPORTED", questionsImported: 0, mediaObjectsCreated: 0 };
    }

    const createdIds: string[] = [];
    const mediaByAsset = new Map<string, string>();
    try {
      for (const [reference, bytes] of prepared.assets) {
        const result = await this.media.createImage(bytes);
        createdIds.push(result.id);
        if (!examMediaId(result.id)) throw new Error("Invalid created media identity.");
        mediaByAsset.set(reference, result.id);
      }
      const mediaIdFor = (reference: string | null): string | null => {
        if (reference === null) return null;
        const id = mediaByAsset.get(reference);
        if (!id) throw new Error("Required media was not created.");
        return id;
      };
      const questions = prepared.questions.map(q => ({
        sourceQuestionNumber: q.sourceQuestionNumber,
        input: validateExamQuestion({
          ...q.input,
          stimulusMediaId: mediaIdFor(q.stimulusAsset),
          options: q.input.options.map((opt, index) => ({ ...opt, mediaId: mediaIdFor(q.optionAssets[index]) })),
        }),
      }));
      await this.repo.commit(prepared.packageKey, prepared.fingerprint, questions);
      return { ...prepared.counts, status: "IMPORTED", questionsImported: questions.length, mediaObjectsCreated: createdIds.length };
    } catch {
      const cleanup: ExamImportCleanup = { removed: 0, retained: 0, failed: 0 };
      for (const id of [...createdIds].reverse()) {
        try {
          if (await this.media.discardUnreferencedImage(id)) cleanup.removed++;
          else cleanup.retained++;
        } catch { cleanup.failed++; }
      }
      // Never serialize the database/provider exception, keys, or asset paths.
      throw new ExamContentImportError("IMPORT_FAILED", "Import did not report success. Newly created media cleanup was attempted; inspect cleanup counts before retrying.", cleanup);
    }
  }
}
