import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "fs/promises";
import { createHash } from "crypto";
import { preflightExamPackage } from "../../../src/services/exam-content-package.service";
import { examPackageFingerprint } from "../../../src/services/exam-package-fingerprint";
import {
  planQ24Correction,
  Q24_CORRECTION,
  verifyQ24Source,
  type Q24BankQuestion,
} from "../../../src/services/exam-q24-correction.service";
import { ExamContentImporter } from "../../../src/services/exam-content-import.service";
import type { PreparedExamPackage } from "../../../src/interfaces/exam-content-import.interfaces";
import type { ExamContentImport } from "@prisma/client";

const db = vi.hoisted(() => ({
  examContentImport: { findUnique: vi.fn(), updateMany: vi.fn() },
  examQuestion: { findMany: vi.fn() },
  examMedia: { findMany: vi.fn() },
  examOption: { updateMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("../../../src/config/database", () => ({ default: db }));
import { ExamQ24CorrectionRepository } from "../../../src/repositories/exam-q24-correction.repository";

let source: PreparedExamPackage;
let manifest: Buffer;
let rows: Q24BankQuestion[];
let marker: ExamContentImport;
let mediaIds: Set<string>;
beforeAll(async () => {
  source = await preflightExamPackage("exam-content/olsat");
  manifest = await readFile("exam-content/olsat/manifest.json");
});
beforeEach(() => {
  vi.resetAllMocks();
  const mediaMap = new Map(
    [...source.assets.keys()].map((asset, index) => [
      asset,
      `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    ]),
  );
  mediaIds = new Set(mediaMap.values());
  rows = source.questions.map((q) => ({
    id: `synthetic-q${q.sourceQuestionNumber}`,
    sourceImportId: "olsat",
    sourceQuestionNumber: q.sourceQuestionNumber,
    questionText: q.input.questionText,
    questionTextEmphasis: null,
    type: q.input.type,
    order: q.input.order,
    stimulusType: q.input.stimulusType,
    stimulusMediaId: q.stimulusAsset ? mediaMap.get(q.stimulusAsset)! : null,
    structuredStimulus: q.input.structuredStimulus,
    options: q.input.options.map((o, index) => ({
      id: `synthetic-q${q.sourceQuestionNumber}-o${o.order}`,
      questionId: `synthetic-q${q.sourceQuestionNumber}`,
      label: o.label,
      order: o.order,
      isCorrect: o.isCorrect,
      optionTextEmphasis: null,
      optionText:
        q.sourceQuestionNumber === 24 && o.label === "J"
          ? Q24_CORRECTION.oldText
          : o.optionText,
      mediaId: q.optionAssets[index]
        ? mediaMap.get(q.optionAssets[index]!)!
        : null,
    })),
  })) as Q24BankQuestion[];
  marker = {
    id: "olsat",
    fingerprint: Q24_CORRECTION.oldFingerprint,
    questionCount: 72,
    createdAt: new Date("2026-10-29T00:00:00Z"),
  };
  db.examContentImport.findUnique.mockImplementation(async () =>
    structuredClone(marker),
  );
  db.examQuestion.findMany.mockImplementation(async () =>
    structuredClone(rows),
  );
  db.examMedia.findMany.mockImplementation(async () =>
    [...mediaIds].map((id) => ({ id })),
  );
  db.examOption.updateMany.mockImplementation(async ({ where, data }) => {
    const option = rows
      .flatMap((q) => q.options)
      .find(
        (o) =>
          o.id === where.id &&
          o.questionId === where.questionId &&
          o.optionText === where.optionText &&
          o.label === where.label &&
          o.order === where.order,
      );
    if (!option) return { count: 0 };
    Object.assign(option, data);
    return { count: 1 };
  });
  db.examContentImport.updateMany.mockImplementation(
    async ({ where, data }) => {
      if (marker.fingerprint !== where.fingerprint) return { count: 0 };
      Object.assign(marker, data);
      return { count: 1 };
    },
  );
  db.$transaction.mockImplementation(async (callback) => {
    const before = structuredClone({ rows, marker });
    try {
      return await callback(db);
    } catch (error) {
      rows = before.rows;
      marker = before.marker;
      throw error;
    }
  });
});

describe("exact owner-authorized Q24 canonical correction", () => {
  it("changes only the authorized nine bytes and retains old source/asset identity as historical proof", () => {
    verifyQ24Source(manifest, source);
    expect(createHash("sha256").update(manifest).digest("hex")).toBe(
      Q24_CORRECTION.newManifestSha256,
    );
    const original = Buffer.from(
      manifest
        .toString("utf8")
        .replace(
          JSON.stringify(Q24_CORRECTION.newText),
          JSON.stringify(Q24_CORRECTION.oldText),
        ),
    );
    expect(createHash("sha256").update(original).digest("hex")).toBe(
      Q24_CORRECTION.oldManifestSha256,
    );
    expect(examPackageFingerprint(original, source.assets)).toBe(
      Q24_CORRECTION.oldFingerprint,
    );
    expect(source.fingerprint).toBe(Q24_CORRECTION.newFingerprint);
    const old = JSON.parse(original.toString("utf8")),
      current = JSON.parse(manifest.toString("utf8"));
    const q24 = current.questions.find(
      (q: { questionNumber: number }) => q.questionNumber === 24,
    );
    const previous = old.questions.find(
      (q: { questionNumber: number }) => q.questionNumber === 24,
    );
    expect(q24.options.map((o: { label: string }) => o.label)).toEqual([
      "F",
      "G",
      "H",
      "J",
      "K",
    ]);
    expect(q24.options[3]).toMatchObject({
      label: "J",
      text: Q24_CORRECTION.newText,
    });
    expect(q24.correctAnswer).toBe(previous.correctAnswer);
    q24.options[3].text = Q24_CORRECTION.oldText;
    expect(current).toEqual(old);
    expect(current.questions).toHaveLength(72);
    expect(source.assets.size).toBe(108);
    expect(source.counts.sourceFiles).toBe(109);
  });
  it("rejects any unrelated canonical byte or asset change", () => {
    expect(() =>
      verifyQ24Source(Buffer.concat([manifest, Buffer.from(" ")]), source),
    ).toThrow();
    const assets = new Map(source.assets);
    assets.set(assets.keys().next().value!, Buffer.from("changed"));
    expect(() => verifyQ24Source(manifest, { ...source, assets })).toThrow();
  });
});

describe("bounded transactional existing-bank reconciliation", () => {
  it("preflights all identities without writes", async () => {
    expect(
      await new ExamQ24CorrectionRepository().reconcile(source, false),
    ).toMatchObject({
      status: "PREFLIGHT_OK",
      optionRowsChanged: 0,
      importMarkersChanged: 0,
      wouldChange: true,
    });
    expect(db.examOption.updateMany).not.toHaveBeenCalled();
    expect(db.examContentImport.updateMany).not.toHaveBeenCalled();
  });
  it("changes exactly option text and marker fingerprint, preserving every other field", async () => {
    const before = structuredClone({ rows, marker });
    const target = before.rows
      .find((q) => q.sourceQuestionNumber === 24)!
      .options.find((o) => o.label === "J")!;
    expect(
      await new ExamQ24CorrectionRepository().reconcile(source, true),
    ).toMatchObject({
      status: "RECONCILED",
      optionRowsChanged: 1,
      importMarkersChanged: 1,
    });
    target.optionText = Q24_CORRECTION.newText;
    before.marker.fingerprint = Q24_CORRECTION.newFingerprint;
    expect({ rows, marker }).toEqual(before);
    expect(db.examOption.updateMany.mock.calls[0][0].data).toEqual({
      optionText: Q24_CORRECTION.newText,
    });
    expect(db.examContentImport.updateMany.mock.calls[0][0].data).toEqual({
      fingerprint: Q24_CORRECTION.newFingerprint,
    });
    expect(db.$transaction.mock.calls[0][1]).toEqual({
      isolationLevel: "Serializable",
      maxWait: 10000,
      timeout: 60000,
    });
  });
  it("makes no writes on an identical second run", async () => {
    const repo = new ExamQ24CorrectionRepository();
    await repo.reconcile(source, true);
    db.examOption.updateMany.mockClear();
    db.examContentImport.updateMany.mockClear();
    expect(await repo.reconcile(source, true)).toMatchObject({
      status: "ALREADY_RECONCILED",
      optionRowsChanged: 0,
      importMarkersChanged: 0,
    });
    expect(db.examOption.updateMany).not.toHaveBeenCalled();
    expect(db.examContentImport.updateMany).not.toHaveBeenCalled();
  });
  it.each([
    "text",
    "label",
    "order",
    "question-link",
    "duplicate-id",
    "correctness",
    "question-text",
    "source-number",
    "media",
    "fingerprint",
    "missing-question",
    "stale-emphasis",
    "partial-option",
    "partial-marker",
  ])("refuses unexpected %s before all mutation", async (mismatch) => {
    const q = rows.find((q) => q.sourceQuestionNumber === 24)!;
    const target = q.options.find((o) => o.label === "J")!;
    if (mismatch === "text") target.optionText = "Unexpected";
    if (mismatch === "label") target.label = "A";
    if (mismatch === "order") target.order = 8;
    if (mismatch === "question-link") target.questionId = "wrong-question";
    if (mismatch === "duplicate-id") target.id = q.options[0].id;
    if (mismatch === "correctness") target.isCorrect = !target.isCorrect;
    if (mismatch === "question-text")
      rows[0].questionText = "Unrelated changed text";
    if (mismatch === "source-number") q.sourceQuestionNumber = 99;
    if (mismatch === "media") mediaIds.clear();
    if (mismatch === "fingerprint") marker.fingerprint = "unexpected";
    if (mismatch === "missing-question") rows.pop();
    if (mismatch === "stale-emphasis")
      target.optionTextEmphasis = [{ start: 0, end: 4, style: "BOLD" }];
    if (mismatch === "partial-option")
      target.optionText = Q24_CORRECTION.newText;
    if (mismatch === "partial-marker")
      marker.fingerprint = Q24_CORRECTION.newFingerprint;
    await expect(
      new ExamQ24CorrectionRepository().reconcile(source, true),
    ).rejects.toThrow();
    expect(db.examOption.updateMany).not.toHaveBeenCalled();
    expect(db.examContentImport.updateMany).not.toHaveBeenCalled();
  });
  it.each(["throw", "zero-rows"])(
    "rolls back the option write when the marker update reports %s",
    async (failure) => {
      const before = structuredClone({ rows, marker });
      if (failure === "throw")
        db.examContentImport.updateMany.mockRejectedValue(
          new Error("Synthetic write failure"),
        );
      else db.examContentImport.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        new ExamQ24CorrectionRepository().reconcile(source, true),
      ).rejects.toThrow();
      expect({ rows, marker }).toEqual(before);
    },
  );
  it("requires a complete corrected bank even for idempotent recognition", () => {
    marker.fingerprint = Q24_CORRECTION.newFingerprint;
    rows
      .find((q) => q.sourceQuestionNumber === 24)!
      .options.find((o) => o.label === "J")!.optionText =
      Q24_CORRECTION.newText;
    expect(planQ24Correction(source, rows, marker, mediaIds).corrected).toBe(
      true,
    );
    rows[0].options[0].optionText = "Unexpected";
    expect(() => planQ24Correction(source, rows, marker, mediaIds)).toThrow();
  });
});

describe("normal importer compatibility", () => {
  it("fresh corrected package imports normally and an identical corrected package is skipped before media creation", async () => {
    let identity: null | {
      fingerprint: string;
      questionCount: number;
      actualQuestionCount: number;
    } = null;
    const repo = {
      find: vi.fn(async () => identity),
      commit: vi.fn(
        async (_key: string, fingerprint: string, questions: unknown[]) => {
          identity = {
            fingerprint,
            questionCount: questions.length,
            actualQuestionCount: questions.length,
          };
        },
      ),
    };
    let seq = 0;
    const media = {
      createImage: vi.fn(async () => ({
        id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`,
      })),
      discardUnreferencedImage: vi.fn(),
    };
    const importer = new ExamContentImporter(repo, media, async () => source);
    expect(await importer.importPackage("unused")).toMatchObject({
      status: "IMPORTED",
      questionsImported: 72,
      mediaObjectsCreated: 108,
    });
    const persisted = repo.commit.mock.calls[0][2] as {
      sourceQuestionNumber: number;
      input: { options: { label: string; optionText: string }[] };
    }[];
    expect(
      persisted
        .find((q) => q.sourceQuestionNumber === 24)!
        .input.options.find((o) => o.label === "J")!.optionText,
    ).toBe(Q24_CORRECTION.newText);
    media.createImage.mockClear();
    expect(await importer.importPackage("unused")).toMatchObject({
      status: "ALREADY_IMPORTED",
      questionsImported: 0,
      mediaObjectsCreated: 0,
    });
    expect(media.createImage).not.toHaveBeenCalled();
  });
  it("normal import still refuses the old fingerprint instead of silently repairing it", async () => {
    const media = { createImage: vi.fn(), discardUnreferencedImage: vi.fn() };
    const repo = {
      find: vi.fn(async () => ({
        fingerprint: Q24_CORRECTION.oldFingerprint,
        questionCount: 72,
        actualQuestionCount: 72,
      })),
      commit: vi.fn(),
    };
    await expect(
      new ExamContentImporter(repo, media, async () => source).importPackage(
        "unused",
      ),
    ).rejects.toMatchObject({ code: "SOURCE_CONFLICT" });
    expect(media.createImage).not.toHaveBeenCalled();
    expect(repo.commit).not.toHaveBeenCalled();
  });
});
