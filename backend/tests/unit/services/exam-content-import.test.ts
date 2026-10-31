import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSyntheticExamPackage, removeSyntheticExamPackage, syntheticExamManifest, writeSyntheticManifest } from "../../fixtures/exam-package";
import { EXAM_PNG } from "../../fixtures/exam-images";
import { ExamContentImporter } from "../../../src/services/exam-content-import.service";
import type { ExamImportIdentity, PersistedExamImportQuestion } from "../../../src/interfaces/exam-content-import.interfaces";

let root: string;
let identity: ExamImportIdentity | null;
let stored: PersistedExamImportQuestion[];
let sequence: number;
const repo = { find: vi.fn(), commit: vi.fn() };
const media = { createImage: vi.fn(), discardUnreferencedImage: vi.fn() };
beforeEach(async () => {
  vi.resetAllMocks();
  root = await createSyntheticExamPackage();
  identity = null;
  stored = [];
  sequence = 0;
  repo.find.mockImplementation(async () => identity);
  repo.commit.mockImplementation(async (_key: string, fingerprint: string, questions: PersistedExamImportQuestion[]) => {
    stored = questions;
    identity = { fingerprint, questionCount: questions.length, actualQuestionCount: questions.length };
  });
  media.createImage.mockImplementation(async () => ({ id: `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}` }));
  media.discardUnreferencedImage.mockResolvedValue(true);
});
afterEach(async () => { await removeSyntheticExamPackage(root); });
const importer = () => new ExamContentImporter(repo, media);

describe("verified bank import orchestration with isolated persistence", () => {
  it("preserves source content and maps exact image bytes through the accepted media service", async () => {
    const result = await importer().importPackage(root);
    expect(result).toMatchObject({ status: "IMPORTED", questionsImported: 3, mediaObjectsCreated: 6, questionsValidated: 3, assets: 6, visualOptions: 5 });
    expect(media.createImage).toHaveBeenCalledTimes(6);
    for (const [bytes] of media.createImage.mock.calls) expect(bytes).toEqual(EXAM_PNG);
    expect(stored.map(q => q.sourceQuestionNumber)).toEqual([1, 2, 3]);
    expect(stored.map(q => q.input.order)).toEqual([1, 2, 3]);
    expect(stored[0].input.options.map(opt => [opt.label, opt.optionText, opt.isCorrect])).toEqual([["F", "First", false], ["K", "Second", true]]);
    expect(stored[1].input.structuredStimulus).toEqual({ type: "MATRIX", rows: [[1, "1/2"], [2, "?"]] });
    expect(stored[2].input.options.map(opt => [opt.label, opt.order, opt.isCorrect])).toEqual([["F", 0, false], ["G", 1, false], ["H", 2, false], ["J", 3, true], ["K", 4, false]]);
    for (const opt of stored[2].input.options) {
      expect(opt.optionText).toBeNull();
      expect(opt.mediaId).toMatch(/^[0-9a-f-]{36}$/);
    }
    expect(stored[2].input.stimulusMediaId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(stored)).not.toContain("assets/");
    expect(JSON.stringify(stored)).not.toContain("correctAnswer");
    expect(JSON.stringify(result)).not.toMatch(/storageKey|provider|assets\/|isCorrect|correctAnswer/);
    expect(media.discardUnreferencedImage).not.toHaveBeenCalled();
  });

  it("does not create duplicate content or media on a second identical import", async () => {
    await importer().importPackage(root);
    const result = await importer().importPackage(root);
    expect(result).toMatchObject({ status: "ALREADY_IMPORTED", questionsImported: 0, mediaObjectsCreated: 0 });
    expect(repo.commit).toHaveBeenCalledTimes(1);
    expect(media.createImage).toHaveBeenCalledTimes(6);
  });

  it("fails conflicting source identity without replacing existing user content/media", async () => {
    await importer().importPackage(root);
    const original = stored;
    const changed = syntheticExamManifest();
    changed.questions[0].questionText = "Changed synthetic source.";
    await writeSyntheticManifest(root, changed);
    await expect(importer().importPackage(root)).rejects.toMatchObject({ code: "SOURCE_CONFLICT" });
    expect(stored).toBe(original);
    expect(repo.commit).toHaveBeenCalledTimes(1);
    expect(media.createImage).toHaveBeenCalledTimes(6);
    expect(media.discardUnreferencedImage).not.toHaveBeenCalled();
  });

  it("refuses a previously imported but now incomplete bank without repairing or duplicating it", async () => {
    await importer().importPackage(root);
    identity!.actualQuestionCount = 2;
    await expect(importer().importPackage(root)).rejects.toMatchObject({ code: "SOURCE_CONFLICT" });
    expect(repo.commit).toHaveBeenCalledTimes(1);
    expect(media.discardUnreferencedImage).not.toHaveBeenCalled();
  });

  it("finishes all preflight validation before any DB lookup, persistence or private media creation", async () => {
    const manifest = syntheticExamManifest();
    manifest.questions[2].verificationStatus = "UNVERIFIED";
    await writeSyntheticManifest(root, manifest);
    await expect(importer().importPackage(root)).rejects.toMatchObject({ code: "INVALID_PACKAGE" });
    expect(repo.find).not.toHaveBeenCalled();
    expect(repo.commit).not.toHaveBeenCalled();
    expect(media.createImage).not.toHaveBeenCalled();
  });

  it("compensates earlier media when later media creation fails, with zero question persistence", async () => {
    media.createImage.mockResolvedValueOnce({ id: "00000000-0000-4000-8000-000000000001" }).mockRejectedValueOnce(new Error("private/key failure"));
    await expect(importer().importPackage(root)).rejects.toMatchObject({ code: "IMPORT_FAILED", cleanup: { removed: 1, retained: 0, failed: 0 } });
    expect(repo.commit).not.toHaveBeenCalled();
    expect(media.discardUnreferencedImage).toHaveBeenCalledExactlyOnceWith("00000000-0000-4000-8000-000000000001");
    expect(stored).toEqual([]);
  });

  it("compensates only newly created media after transaction failure", async () => {
    repo.commit.mockRejectedValue(new Error("database detail C:/private/path"));
    await expect(importer().importPackage(root)).rejects.toMatchObject({ code: "IMPORT_FAILED", cleanup: { removed: 6, retained: 0, failed: 0 } });
    const created = media.createImage.mock.results;
    const createdIds = await Promise.all(created.map(async result => (await result.value).id));
    expect(media.discardUnreferencedImage.mock.calls.map(([id]) => id)).toEqual(createdIds.reverse());
    expect(media.discardUnreferencedImage).not.toHaveBeenCalledWith("unrelated-existing-media");
    expect(stored).toEqual([]);
    expect(identity).toBeNull();
  });

  it("reports guarded retention and cleanup failures without raw paths/keys", async () => {
    repo.commit.mockRejectedValue(new Error("sensitive DB message"));
    media.discardUnreferencedImage.mockRejectedValueOnce(new Error("private/storage/key")).mockResolvedValueOnce(false);
    try {
      await importer().importPackage(root);
      throw new Error("Expected import failure");
    } catch (error) {
      expect(error).toMatchObject({ code: "IMPORT_FAILED", cleanup: { removed: 4, retained: 1, failed: 1 } });
      expect(JSON.stringify(error)).not.toMatch(/sensitive|private\/storage|C:/);
    }
    expect(media.discardUnreferencedImage).toHaveBeenCalledTimes(6);
  });

  it("reports a concurrent package-key collision and compensates only this run", async () => {
    repo.commit.mockRejectedValue(Object.assign(new Error("Duplicate package"), { code: "P2002" }));
    await expect(importer().importPackage(root)).rejects.toMatchObject({ code: "IMPORT_FAILED", cleanup: { removed: 6, retained: 0, failed: 0 } });
    expect(repo.commit).toHaveBeenCalledTimes(1);
    expect(media.discardUnreferencedImage).not.toHaveBeenCalledWith("winning-import-media");
  });
});
