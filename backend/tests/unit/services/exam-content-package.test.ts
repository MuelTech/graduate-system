import { writeFile, unlink, symlink, mkdtemp } from "fs/promises";
import path from "path";
import { tmpdir } from "os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSyntheticExamPackage, removeSyntheticExamPackage, syntheticExamManifest, writeSyntheticManifest } from "../../fixtures/exam-package";
import { EXAM_JPEG } from "../../fixtures/exam-images";
import { preflightExamPackage, validateExamAssetReference } from "../../../src/services/exam-content-package.service";
import { getUploadPolicy } from "../../../src/storage/upload-policy";

let root: string;
beforeEach(async () => { root = await createSyntheticExamPackage(); });
afterEach(async () => { await removeSyntheticExamPackage(root); });

describe("verified source-package preflight", () => {
  it("validates the full synthetic package with deterministic safe counts", async () => {
    const result = await preflightExamPackage(root);
    expect(result.counts).toEqual({
      questionsValidated: 3, textOnlyQuestions: 1, structuredStimulusQuestions: 1, imageStimulusQuestions: 1,
      visualOptions: 5, assets: 6, sourceFiles: 7,
      questionTypes: { TEXT_MULTIPLE_CHOICE: 1, STRUCTURED_STIMULUS_TEXT_CHOICES: 1, VISUAL_STIMULUS_VISUAL_CHOICES: 1 },
      stimulusTypes: { NONE: 1, IMAGE: 1, STRUCTURED: 1 }, structuredSubtypes: { MATRIX: 1 },
    });
    expect(result.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect((await preflightExamPackage(root)).fingerprint).toBe(result.fingerprint);
  });

  it("preserves source numbering, exact text/labels, explicit option order and answer-label mapping", async () => {
    const manifest = syntheticExamManifest();
    manifest.questions.reverse();
    const question = manifest.questions.find(q => q.questionNumber === 1)!;
    question.questionText = "  Exact canonical wording.  ";
    Object.assign(question.options[0], { order: 9 });
    Object.assign(question.options[1], { order: 2 });
    await writeSyntheticManifest(root, manifest);
    const result = await preflightExamPackage(root);
    expect(result.questions.map(q => [q.sourceQuestionNumber, q.input.order])).toEqual([[1, 1], [2, 2], [3, 3]]);
    expect(result.questions[0].input.questionText).toBe("  Exact canonical wording.  ");
    expect(result.questions[0].input.options.map(opt => [opt.label, opt.order, opt.isCorrect])).toEqual([["K", 2, true], ["F", 9, false]]);
    expect(result.questions[2].input.options.map(opt => opt.label)).toEqual(["F", "G", "H", "J", "K"]);
  });

  it.each([
    ["unverified", (m: ReturnType<typeof syntheticExamManifest>) => { m.questions[0].verificationStatus = "PENDING"; }],
    ["duplicate number", m => { m.questions[1].questionNumber = 1; }],
    ["missing number", m => { delete (m.questions[0] as Partial<typeof m.questions[0]>).questionNumber; }],
    ["missing text", m => { m.questions[0].questionText = ""; }],
    ["unsupported response", m => { m.questions[0].questionType = "ESSAY"; }],
    ["missing correct answer", m => { m.questions[0].correctAnswer = ""; }],
    ["unknown answer label", m => { m.questions[0].correctAnswer = "Z"; }],
    ["duplicate labels", m => { m.questions[0].options[1].label = "F"; }],
    ["duplicate order", m => { m.questions[0].options.forEach(opt => Object.assign(opt, { order: 1 })); }],
    ["partial order", m => { Object.assign(m.questions[0].options[0], { order: 2 }); }],
    ["missing option content", m => { m.questions[0].options[0].text = null; }],
    ["image choice with fake text", m => { m.questions[2].options[0].text = "fake"; }],
    ["unsupported option type", m => { Object.assign(m.questions[0].options[0], { type: "VIDEO" }); }],
    ["unsupported manifest version", m => { Object.assign(m, { version: 7 }); }],
    ["range mismatch", m => { m.scope.actualQuestionRange = [1, 72]; }],
    ["unknown stimulus", m => { m.questions[2].stimulus = { type: "VIDEO", image: "assets/q003/stimulus.png" }; }],
    ["missing image reference", m => { m.questions[2].options[0].image = "assets/q003/missing.png"; }],
    ["missing visual stimulus", m => { m.questions[2].stimulus = null; }],
  ] as [string, (manifest: ReturnType<typeof syntheticExamManifest>) => void][])("rejects %s", async (_name, mutate) => {
    const manifest = syntheticExamManifest();
    mutate(manifest);
    await writeSyntheticManifest(root, manifest);
    await expect(preflightExamPackage(root)).rejects.toMatchObject({ code: "INVALID_PACKAGE" });
  });

  it.each([
    { type: "MATRIX", rows: [[2, "1/3"], [3, "?"]] },
    { type: "WORD_BANK", items: ["we", "walk"] },
    { type: "NUMBER_SEQUENCE", items: ["1/3", 2, "?"] },
    { type: "ALPHANUMERIC_SEQUENCE", items: ["2A", "4B", "?"] },
    { type: "WORD_SERIES", items: ["up", "down", "?"] },
    { type: "GROUPED_NUMBER_ROWS", groups: [[1, 2, 3], [4, "?", 6]] },
    { type: "LETTER_SEQUENCE", items: ["A", "B", "?"] },
    { type: "LOGICAL_PREMISES", items: ["All Xs are Ys."] },
  ])("preserves accepted structured subtype $type", async stimulus => {
    const manifest = syntheticExamManifest();
    Object.assign(manifest.questions[1], { stimulus });
    await writeSyntheticManifest(root, manifest);
    expect((await preflightExamPackage(root)).questions[1].input.structuredStimulus).toEqual(stimulus);
  });

  it.each([{ type: "UNKNOWN", items: [1] }, { type: "MATRIX", rows: [[1], [2, 3]] }])("rejects unsupported/malformed structured stimulus %#", async stimulus => {
    const manifest = syntheticExamManifest();
    Object.assign(manifest.questions[1], { stimulus });
    await writeSyntheticManifest(root, manifest);
    await expect(preflightExamPackage(root)).rejects.toMatchObject({ code: "INVALID_PACKAGE" });
  });

  it.each(["../secret.png", "/tmp/image.png", "C:/private/image.png", "assets\\..\\image.png", "https://example.com/image.png", "assets/../image.png", "assets/%2e%2e/image.png", "assets//image.png", "assets/image.svg", "assets/.hidden.png"])("rejects unsafe/unexpected asset reference %s", reference => {
    expect(() => validateExamAssetReference(reference)).toThrow();
  });

  it("rejects malformed JSON and missing/mis-cased assets", async () => {
    await writeFile(path.join(root, "manifest.json"), "{broken");
    await expect(preflightExamPackage(root)).rejects.toMatchObject({ code: "INVALID_PACKAGE" });
    await writeSyntheticManifest(root, syntheticExamManifest());
    await unlink(path.join(root, "assets/q003/stimulus.png"));
    await expect(preflightExamPackage(root)).rejects.toMatchObject({ code: "INVALID_PACKAGE" });
  });

  it("rejects accidental unreferenced files instead of committing source scans or caches", async () => {
    await writeFile(path.join(root, "scan.jpg"), EXAM_JPEG);
    await expect(preflightExamPackage(root)).rejects.toMatchObject({ code: "INVALID_PACKAGE" });
  });

  it.each([Buffer.from("spoofed image plain text"), Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n"), EXAM_JPEG])("rejects unsupported/spoofed/extension-mismatched image bytes %#", async bytes => {
    await writeFile(path.join(root, "assets/q003/stimulus.png"), bytes);
    await expect(preflightExamPackage(root)).rejects.toMatchObject({ code: "INVALID_PACKAGE" });
  });

  it("rejects oversized source images", async () => {
    await writeFile(path.join(root, "assets/q003/stimulus.png"), Buffer.alloc(getUploadPolicy("exam-media").maxBytes + 1));
    await expect(preflightExamPackage(root)).rejects.toMatchObject({ code: "INVALID_PACKAGE" });
  });

  it("rejects symlinks/junctions before following files outside the package", async ctx => {
    const outside = await mkdtemp(path.join(tmpdir(), "exam-importer-outside-"));
    try {
      await writeFile(path.join(outside, "secret.png"), EXAM_JPEG);
      try { await symlink(outside, path.join(root, "assets", "escape"), process.platform === "win32" ? "junction" : "dir"); }
      catch { ctx.skip(); return; }
      await expect(preflightExamPackage(root)).rejects.toMatchObject({ code: "INVALID_PACKAGE" });
    } finally { await removeSyntheticExamPackage(outside); }
  });
});
