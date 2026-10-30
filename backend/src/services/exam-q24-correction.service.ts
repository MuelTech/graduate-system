import { createHash } from "crypto";
import { isDeepStrictEqual } from "util";
import type { ExamContentImport, Prisma } from "@prisma/client";
import type { PreparedExamPackage } from "../interfaces/exam-content-import.interfaces";
import { examPackageFingerprint } from "./exam-package-fingerprint";

export const Q24_CORRECTION = {
  oldText: "Paul is younger than Dick",
  newText: "Paul is younger than Dick and John",
  oldManifestSha256:
    "0327342827f9afafeadb65b88f18e9bb4f21b2c513fe6edfdb9104ab16abd3d9",
  newManifestSha256:
    "6fd4a1e7a0e9efe1d68b25d93198168f363a02f71c67ba7e1bc271ae4ffb1ed6",
  oldFingerprint:
    "a0126af9597439db7b8536ec2cae6a753cfeece68d3b038f9c1eb6c7dd83f263",
  newFingerprint:
    "8fa052874c6276e8fefca396d3e9387febf90978cabc8fc43bcb627186af5738",
} as const;
const sha256 = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
function requireState(condition: unknown): asserts condition {
  if (!condition)
    throw new Error(
      "Q24 correction source/import state mismatch; no reconciliation authorized.",
    );
}

/** Verify the sole authorized byte edit and the original asset-bound package identity. */
export function verifyQ24Source(
  manifest: Buffer,
  source: PreparedExamPackage,
): void {
  requireState(sha256(manifest) === Q24_CORRECTION.newManifestSha256);
  requireState(
    source.packageKey === "olsat" &&
      source.questions.length === 72 &&
      source.assets.size === 108 &&
      source.counts.sourceFiles === 109,
  );
  requireState(
    examPackageFingerprint(manifest, source.assets) ===
      Q24_CORRECTION.newFingerprint &&
      source.fingerprint === Q24_CORRECTION.newFingerprint,
  );
  const text = new TextDecoder("utf-8", { fatal: true }).decode(manifest);
  const token = JSON.stringify(Q24_CORRECTION.newText);
  requireState(text.split(token).length === 2);
  const original = Buffer.from(
    text.replace(token, JSON.stringify(Q24_CORRECTION.oldText)),
    "utf8",
  );
  requireState(sha256(original) === Q24_CORRECTION.oldManifestSha256);
  requireState(
    examPackageFingerprint(original, source.assets) ===
      Q24_CORRECTION.oldFingerprint,
  );
  const q24 = source.questions.find((q) => q.sourceQuestionNumber === 24);
  requireState(
    q24 && q24.input.options.map((o) => o.label).join("/") === "F/G/H/J/K",
  );
  requireState(
    q24.input.options.find((o) => o.label === "J" && o.order === 3)
      ?.optionText === Q24_CORRECTION.newText,
  );
}

export type Q24BankQuestion = Prisma.ExamQuestionGetPayload<{
  include: { options: true };
}>;
/** All 72 questions / 360 options resolve before any write; allow no unrelated canonical drift. */
export function planQ24Correction(
  source: PreparedExamPackage,
  rows: Q24BankQuestion[],
  marker: ExamContentImport | null,
  mediaIds: ReadonlySet<string>,
) {
  requireState(source.fingerprint === Q24_CORRECTION.newFingerprint);
  requireState(marker?.id === "olsat" && marker.questionCount === 72);
  const corrected = marker.fingerprint === Q24_CORRECTION.newFingerprint;
  requireState(
    corrected || marker.fingerprint === Q24_CORRECTION.oldFingerprint,
  );
  requireState(
    rows.length === 72 &&
      rows.reduce((n, q) => n + q.options.length, 0) === 360,
  );
  requireState(
    new Set(rows.map((q) => q.id)).size === 72 &&
      new Set(rows.map((q) => q.sourceQuestionNumber)).size === 72,
  );
  const optionIds = new Set<string>();
  const mediaByAsset = new Map<string, string>();
  function checkMedia(asset: string | null, mediaId: string | null) {
    if (asset === null) {
      requireState(mediaId === null);
      return;
    }
    requireState(mediaId && mediaIds.has(mediaId));
    requireState(
      !mediaByAsset.has(asset) || mediaByAsset.get(asset) === mediaId,
    );
    mediaByAsset.set(asset, mediaId);
  }
  for (const expected of source.questions) {
    const row = rows.find(
      (q) => q.sourceQuestionNumber === expected.sourceQuestionNumber,
    );
    requireState(row && row.sourceImportId === "olsat");
    const input = expected.input;
    requireState(
      row.questionText === input.questionText &&
        row.order === input.order &&
        row.type === input.type &&
        row.stimulusType === input.stimulusType &&
        isDeepStrictEqual(row.structuredStimulus, input.structuredStimulus),
    );
    checkMedia(expected.stimulusAsset, row.stimulusMediaId);
    const options = [...row.options].sort((a, b) => a.order - b.order);
    requireState(
      options.length === input.options.length &&
        options.filter((o) => o.isCorrect).length === 1,
    );
    for (let index = 0; index < options.length; index++) {
      const option = options[index];
      const original = input.options[index];
      requireState(option.questionId === row.id && !optionIds.has(option.id));
      optionIds.add(option.id);
      requireState(
        option.label === original.label &&
          option.order === original.order &&
          option.isCorrect === original.isCorrect,
      );
      const target =
        row.sourceQuestionNumber === 24 &&
        option.label === "J" &&
        option.order === 3;
      requireState(
        option.optionText ===
          (target && !corrected ? Q24_CORRECTION.oldText : original.optionText),
      );
      // Never carry stale emphasis offsets through this narrowly authorized text change.
      if (target) requireState(option.optionTextEmphasis === null);
      checkMedia(expected.optionAssets[index], option.mediaId);
    }
  }
  requireState(
    mediaByAsset.size === 108 && new Set(mediaByAsset.values()).size === 108,
  );
  const question = rows.find((q) => q.sourceQuestionNumber === 24)!;
  const option = question.options.find(
    (o) => o.label === "J" && o.order === 3,
  )!;
  return {
    corrected,
    questionId: question.id,
    optionId: option.id,
    isCorrect: option.isCorrect,
  };
}
