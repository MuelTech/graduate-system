import fsp from "fs/promises";
import { constants } from "fs";
import path from "path";
import { examPackageFingerprint } from "./exam-package-fingerprint";
import { fileTypeFromBuffer } from "file-type";
import { validateExamQuestion } from "./exam-content.rules";
import { getUploadPolicy } from "../storage/upload-policy";
import { ExamContentImportError } from "../interfaces/exam-content-import.interfaces";
import type { ExamPackageCounts, PreparedExamPackage, PreparedExamQuestion } from "../interfaces/exam-content-import.interfaces";

const PLACEHOLDER_MEDIA_ID = "00000000-0000-4000-8000-000000000001";
export const EXAM_PACKAGE_LIMITS = { manifestBytes: 2 * 1024 * 1024, questions: 500, totalAssetBytes: 128 * 1024 * 1024, files: 13501, depth: 8 } as const;
const QUESTION_TYPES = ["TEXT_MULTIPLE_CHOICE", "STRUCTURED_STIMULUS_TEXT_CHOICES", "VISUAL_STIMULUS_VISUAL_CHOICES"];

function invalid(message: string): never { throw new ExamContentImportError("INVALID_PACKAGE", message); }
function object(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(`${name} must be an object.`);
  return value as Record<string, unknown>;
}
function keys(data: Record<string, unknown>, allowed: readonly string[], name: string) {
  if (Object.keys(data).some(key => !allowed.includes(key))) invalid(`${name} has unsupported fields or schema version.`);
}
function nonempty(value: unknown, name: string, max = 191): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) invalid(`${name} is required and bounded.`);
  return value;
}
function integer(value: unknown, name: string, min = 0): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > 2147483647) invalid(`${name} must be a valid integer.`);
  return value;
}
function inside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

/** Canonical POSIX assets paths only; no URL/drive/encoding/hidden/traversal aliases. */
export function validateExamAssetReference(value: unknown): string {
  const reference = nonempty(value, "Image asset reference", 255);
  if (!/^assets\/(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(?:png|jpg|jpeg)$/.test(reference)) invalid("Unsupported or unsafe image asset reference.");
  return reference;
}

async function inventory(root: string): Promise<Set<string>> {
  const files = new Set<string>();
  async function walk(dir: string, prefix: string, depth: number): Promise<void> {
    if (depth > EXAM_PACKAGE_LIMITS.depth) invalid("Source package nesting exceeds the supported limit.");
    for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
      const relative = `${prefix}${entry.name}`;
      if (entry.isSymbolicLink()) invalid("Source package symlinks are not supported.");
      if (entry.isDirectory()) {
        if ((prefix === "" && entry.name !== "assets") || !/^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(entry.name)) invalid("Unexpected source directory.");
        await walk(path.join(dir, entry.name), `${relative}/`, depth + 1);
      } else if (entry.isFile()) {
        files.add(relative);
        if (files.size > EXAM_PACKAGE_LIMITS.files) invalid("Source package file count exceeds the supported limit.");
      } else invalid("Source package contains a non-regular file.");
    }
  }
  await walk(root, "", 0);
  return files;
}

/** Read bounded bytes from the validated root; no source writes or DB imports. */
async function readContained(root: string, reference: string, limit: number): Promise<Buffer> {
  const target = path.resolve(root, reference);
  if (!inside(root, target)) invalid("Source asset escapes the package root.");
  try {
    const real = await fsp.realpath(target);
    if (!inside(root, real) || path.relative(target, real) !== "") invalid("Unsafe source file or symlink.");
    const expected = await fsp.lstat(real);
    if (!expected.isFile() || expected.size === 0 || expected.size > limit) invalid("Source file is empty or exceeds its size limit.");
    const handle = await fsp.open(real, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const opened = await handle.stat();
      if (!opened.isFile() || opened.dev !== expected.dev || opened.ino !== expected.ino) invalid("Source file changed during preflight.");
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of handle.createReadStream({ autoClose: false })) {
        size += chunk.length;
        if (size > limit) invalid("Source file exceeds its size limit.");
        chunks.push(chunk);
      }
      if (size !== expected.size) invalid("Source file changed during preflight.");
      return Buffer.concat(chunks);
    } finally { await handle.close(); }
  } catch (error) {
    if (error instanceof ExamContentImportError) throw error;
    return invalid("A referenced source file is missing, unreadable or unsafe.");
  }
}

function prepareQuestion(value: unknown): PreparedExamQuestion {
  const q = object(value, "Question");
  keys(q, ["questionNumber", "sourcePage", "sourceFile", "questionType", "questionText", "stimulus", "options", "correctAnswer", "answerKeyCandidate", "extractionStatus", "verificationStatus", "issues"], "Question");
  const number = integer(q.questionNumber, "questionNumber", 1);
  if (q.verificationStatus !== "VERIFIED") invalid(`Question ${number} is not explicitly VERIFIED.`);
  if (!QUESTION_TYPES.includes(q.questionType as string)) invalid(`Question ${number} has an unsupported question type.`);
  const correctAnswer = nonempty(q.correctAnswer, `Question ${number} correctAnswer`, 8);
  if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 26) invalid(`Question ${number} has an invalid option collection.`);
  const hasOrder = q.options.some(value => Object.prototype.hasOwnProperty.call(object(value, "Option"), "order"));
  const choices = q.options.map((value, index) => {
    const opt = object(value, "Option");
    keys(opt, ["label", "text", "image", "order"], "Option");
    const label = nonempty(opt.label, "Option label", 8);
    const image = opt.image == null ? null : validateExamAssetReference(opt.image);
    const text = opt.text == null ? null : opt.text;
    const order = hasOrder ? integer(opt.order, "Option order") : index;
    if (q.questionType === "VISUAL_STIMULUS_VISUAL_CHOICES" ? !image || text !== null : image !== null || text === null) invalid(`Question ${number} option content does not match its source question type.`);
    return { label, text, image, order };
  }).sort((a, b) => a.order - b.order);
  if (choices.filter(opt => opt.label === correctAnswer).length !== 1) invalid(`Question ${number} correctAnswer must match exactly one option label.`);
  let stimulusAsset: string | null = null;
  let structured: unknown = null;
  if (q.questionType === "TEXT_MULTIPLE_CHOICE") {
    if (q.stimulus !== null) invalid(`Question ${number} text type requires a null stimulus.`);
  } else {
    const stimulus = object(q.stimulus, "Stimulus");
    if (q.questionType === "VISUAL_STIMULUS_VISUAL_CHOICES") {
      keys(stimulus, ["type", "image"], "Image stimulus");
      if (stimulus.type !== "IMAGE") invalid(`Question ${number} requires an IMAGE stimulus.`);
      stimulusAsset = validateExamAssetReference(stimulus.image);
    } else {
      if (stimulus.type === "IMAGE" || stimulus.type === "NONE") invalid(`Question ${number} requires a supported structured stimulus.`);
      structured = stimulus;
    }
  }
  try {
    const input = validateExamQuestion({
      questionText: q.questionText, type: "MULTIPLE_CHOICE", order: number,
      stimulusType: stimulusAsset ? "IMAGE" : structured ? "STRUCTURED" : "NONE",
      stimulusMediaId: stimulusAsset ? PLACEHOLDER_MEDIA_ID : null,
      structuredStimulus: structured,
      options: choices.map(opt => ({ label: opt.label, optionText: opt.text, mediaId: opt.image ? PLACEHOLDER_MEDIA_ID : null, order: opt.order, isCorrect: opt.label === correctAnswer })),
    });
    return { sourceQuestionNumber: number, input, stimulusAsset, optionAssets: choices.map(opt => opt.image) };
  } catch (error) {
    return invalid(`Question ${number}: ${error instanceof Error ? error.message : "invalid content"}`);
  }
}

export async function preflightExamPackage(packageRoot: string): Promise<PreparedExamPackage> {
  const root = path.resolve(packageRoot);
  try {
    const info = await fsp.lstat(root);
    if (!info.isDirectory() || info.isSymbolicLink() || path.relative(root, await fsp.realpath(root)) !== "") invalid("Source package root must be a real contained directory.");
  } catch (error) {
    if (error instanceof ExamContentImportError) throw error;
    return invalid("Source package root is unavailable.");
  }
  const files = await inventory(root);
  if (!files.has("manifest.json")) invalid("Source package requires manifest.json with exact casing.");
  const manifestBytes = await readContained(root, "manifest.json", EXAM_PACKAGE_LIMITS.manifestBytes);
  let raw: unknown;
  try { raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes)); }
  catch { return invalid("Malformed manifest JSON."); }
  const manifest = object(raw, "Manifest");
  // The verified extractor contract is versionless. Explicit versions are unsupported.
  keys(manifest, ["packageName", "scope", "rules", "questions"], "Manifest");
  nonempty(manifest.packageName, "packageName");
  object(manifest.scope, "Manifest scope");
  object(manifest.rules, "Manifest rules");
  if (!Array.isArray(manifest.questions) || manifest.questions.length === 0 || manifest.questions.length > EXAM_PACKAGE_LIMITS.questions) invalid("Manifest question count is invalid.");
  const questions = manifest.questions.map(prepareQuestion).sort((a, b) => a.sourceQuestionNumber - b.sourceQuestionNumber);
  if (new Set(questions.map(q => q.sourceQuestionNumber)).size !== questions.length) invalid("Duplicate source question number.");
  const range = object(manifest.scope, "Manifest scope").actualQuestionRange;
  if (!Array.isArray(range) || range.length !== 2) invalid("Manifest scope requires actualQuestionRange.");
  const start = integer(range[0], "Question range start", 1);
  const end = integer(range[1], "Question range end", start);
  if (end - start + 1 !== questions.length || questions.some((q, index) => q.sourceQuestionNumber !== start + index)) invalid("Manifest question numbers do not match the declared complete range.");

  const references = new Set(questions.flatMap(q => [q.stimulusAsset, ...q.optionAssets].filter((ref): ref is string => ref !== null)));
  for (const ref of references) if (!files.has(ref)) invalid("A referenced asset is missing or has mismatched path casing.");
  if (files.size !== references.size + 1 || [...files].some(ref => ref !== "manifest.json" && !references.has(ref))) invalid("Source package contains unreferenced or unexpected files.");
  const assets = new Map<string, Buffer>();
  const policy = getUploadPolicy("exam-media");
  let totalBytes = 0;
  for (const reference of [...references].sort()) {
    const bytes = await readContained(root, reference, policy.maxBytes);
    totalBytes += bytes.length;
    if (totalBytes > EXAM_PACKAGE_LIMITS.totalAssetBytes) invalid("Source image package exceeds its total size limit.");
    let detected;
    try { detected = await fileTypeFromBuffer(bytes); } catch { invalid("Source image content could not be validated."); }
    const expected = reference.endsWith(".png") ? "image/png" : "image/jpeg";
    if (!detected || !policy.allowedMimeTypes?.includes(detected.mime) || detected.mime !== expected) invalid("Source image content does not match its supported image extension/type.");
    assets.set(reference, bytes);
  }
  const counts: ExamPackageCounts = {
    questionsValidated: questions.length, textOnlyQuestions: 0, structuredStimulusQuestions: 0,
    imageStimulusQuestions: 0, visualOptions: 0, sourceFiles: files.size, assets: assets.size,
    questionTypes: {}, stimulusTypes: { NONE: 0, IMAGE: 0, STRUCTURED: 0 }, structuredSubtypes: {},
  };
  for (const q of questions) {
    const type = q.input.stimulusType;
    counts.stimulusTypes[type]++;
    const sourceType = type === "NONE" ? QUESTION_TYPES[0] : type === "STRUCTURED" ? QUESTION_TYPES[1] : QUESTION_TYPES[2];
    counts.questionTypes[sourceType] = (counts.questionTypes[sourceType] ?? 0) + 1;
    if (type === "NONE") counts.textOnlyQuestions++;
    else if (type === "IMAGE") counts.imageStimulusQuestions++;
    else {
      counts.structuredStimulusQuestions++;
      const subtype = q.input.structuredStimulus!.type;
      counts.structuredSubtypes[subtype] = (counts.structuredSubtypes[subtype] ?? 0) + 1;
    }
    counts.visualOptions += q.optionAssets.filter(Boolean).length;
  }
  return { packageKey: "olsat", fingerprint: examPackageFingerprint(manifestBytes, assets), questions, assets, counts };
}
