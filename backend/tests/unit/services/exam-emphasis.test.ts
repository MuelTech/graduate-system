import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  parseEmphasisSidecar,
  reconcileEmphasis,
  textSha256,
  type EmphasisTransaction,
} from "../../../src/services/exam-emphasis.service";
import type { PreparedExamPackage } from "../../../src/interfaces/exam-content-import.interfaces";

const hash = "a".repeat(64);
const source = {
  packageKey: "olsat",
  fingerprint: "synthetic-fingerprint",
  questions: [
    {
      sourceQuestionNumber: 1,
      input: {
        questionText: "Synthetic NOT instruction",
        options: [
          { label: "F", order: 0, optionText: "First" },
          { label: "K", order: 1, optionText: "Other" },
          { label: "J", order: 2, optionText: null },
        ],
      },
    },
  ],
} as PreparedExamPackage;
const document = () => ({
  schemaVersion: 1,
  packageKey: "olsat",
  manifestSha256: hash,
  indexConvention: "UTF16_CODE_UNITS",
  verification: {
    status: "VERIFIED",
    verifiedBy: "Synthetic reviewer",
    verifiedAt: "2026-10-30T00:00:00Z",
  },
  annotations: [
    {
      sourceQuestionNumber: 1,
      target: { field: "questionText" },
      textSha256: textSha256(source.questions[0].input.questionText),
      spans: [{ start: 10, end: 13, style: "BOLD" }],
    },
    {
      sourceQuestionNumber: 1,
      target: { field: "optionText", label: "F", order: 0 },
      textSha256: textSha256("First"),
      spans: [{ start: 0, end: 5, style: "UNDERLINE" }],
    },
  ],
});
let rows: any[];
let tx: EmphasisTransaction;
beforeEach(() => {
  rows = [
    {
      id: "unchanged-question-id",
      sourceQuestionNumber: 1,
      questionText: source.questions[0].input.questionText,
      questionTextEmphasis: null,
      options: [
        {
          id: "unchanged-option-id",
          label: "F",
          order: 0,
          optionText: "First",
          optionTextEmphasis: null,
        },
        {
          id: "other-option",
          label: "K",
          order: 1,
          optionText: "Other",
          optionTextEmphasis: null,
        },
      ],
    },
  ];
  tx = {
    examContentImport: {
      findUnique: vi
        .fn()
        .mockResolvedValue({
          fingerprint: source.fingerprint,
          questionCount: 1,
        }),
    },
    examQuestion: {
      findMany: vi.fn().mockImplementation(async () => rows),
      update: vi.fn().mockImplementation(async ({ where, data }) =>
        Object.assign(
          rows.find((r) => r.id === where.id),
          data,
        ),
      ),
    },
    examOption: {
      update: vi.fn().mockImplementation(async ({ where, data }) =>
        Object.assign(
          rows[0].options.find((o: any) => o.id === where.id),
          data,
        ),
      ),
    },
  };
});
describe("verified annotation parser", () => {
  it("binds exact manifest/text and question/label/order identity", () =>
    expect(
      parseEmphasisSidecar(document(), source, hash).annotations,
    ).toHaveLength(2));
  it.each([
    (d: any) => {
      d.manifestSha256 = "b".repeat(64);
    },
    (d: any) => {
      d.packageKey = "other";
    },
    (d: any) => {
      d.schemaVersion = 2;
    },
    (d: any) => {
      d.indexConvention = "CODE_POINTS";
    },
    (d: any) => {
      d.verification.status = "CANDIDATE";
    },
    (d: any) => {
      d.verification.verifiedBy = "";
    },
    (d: any) => {
      d.annotations[0].sourceQuestionNumber = 2;
    },
    (d: any) => {
      d.annotations[0].textSha256 = textSha256("Changed");
    },
    (d: any) => {
      d.annotations[1].target.label = "A";
    },
    (d: any) => {
      d.annotations[1].target.order = 9;
    },
    (d: any) => {
      d.annotations[1].target = { field: "optionText", label: "J", order: 2 };
    },
    (d: any) => {
      d.annotations.push(d.annotations[0]);
    },
    (d: any) => {
      d.annotations[0].spans[0].end = 999;
    },
    (d: any) => {
      d.annotations[0].target.answerKey = "F";
    },
    (d: any) => {
      delete d.annotations[0].spans;
    },
  ])(
    "fails closed on wrong authority, identity, text or marks %#",
    (mutate) => {
      const d = document();
      mutate(d);
      expect(() => parseEmphasisSidecar(d, source, hash)).toThrow();
    },
  );
});
describe("existing bank metadata-only reconciliation", () => {
  it("rejects ambiguous duplicate option identities before any write", async () => {
    rows[0].options.push({ ...rows[0].options[0], id: "duplicate-option-id" });
    await expect(reconcileEmphasis(tx, parseEmphasisSidecar(document(), source, hash), source, true)).rejects.toThrow();
    expect(tx.examQuestion.update).not.toHaveBeenCalled();
    expect(tx.examOption.update).not.toHaveBeenCalled();
  });
  it("preflights without writes", async () => {
    expect(
      await reconcileEmphasis(
        tx,
        parseEmphasisSidecar(document(), source, hash),
        source,
        false,
      ),
    ).toMatchObject({
      status: "PREFLIGHT_OK",
      fieldsChanged: 0,
      fieldsWouldChange: 2,
    });
    expect(tx.examQuestion.update).not.toHaveBeenCalled();
    expect(tx.examOption.update).not.toHaveBeenCalled();
  });
  it("applies exact metadata, preserves IDs/text, then makes zero writes on identical repeat", async () => {
    const sidecar = parseEmphasisSidecar(document(), source, hash);
    const ids = [rows[0].id, rows[0].options[0].id];
    expect(await reconcileEmphasis(tx, sidecar, source, true)).toMatchObject({
      status: "APPLIED",
      fieldsChanged: 2,
    });
    expect(tx.examQuestion.update).toHaveBeenCalledWith({
      where: { id: ids[0] },
      data: { questionTextEmphasis: sidecar.annotations[0].spans },
    });
    expect(tx.examOption.update).toHaveBeenCalledWith({
      where: { id: ids[1] },
      data: { optionTextEmphasis: sidecar.annotations[1].spans },
    });
    vi.mocked(tx.examQuestion.update).mockClear();
    vi.mocked(tx.examOption.update).mockClear();
    expect(await reconcileEmphasis(tx, sidecar, source, true)).toMatchObject({
      status: "ALREADY_APPLIED",
      fieldsChanged: 0,
    });
    expect(tx.examQuestion.update).not.toHaveBeenCalled();
    expect(tx.examOption.update).not.toHaveBeenCalled();
    expect([rows[0].id, rows[0].options[0].id]).toEqual(ids);
    expect(rows[0].questionText).toBe(source.questions[0].input.questionText);
  });
  it.each([
    "question-text",
    "option-text",
    "label",
    "order",
    "source-number",
    "missing-row",
    "marker",
  ])("rejects persisted %s mismatch before any write", async (mismatch) => {
    if (mismatch === "question-text") rows[0].questionText = "Different";
    if (mismatch === "option-text") rows[0].options[0].optionText = "Different";
    if (mismatch === "label") rows[0].options[0].label = "A";
    if (mismatch === "order") rows[0].options[0].order = 9;
    if (mismatch === "source-number") rows[0].sourceQuestionNumber = 2;
    if (mismatch === "missing-row") rows = [];
    if (mismatch === "marker")
      vi.mocked(tx.examContentImport.findUnique).mockResolvedValue({
        fingerprint: "wrong",
        questionCount: 1,
      });
    await expect(
      reconcileEmphasis(
        tx,
        parseEmphasisSidecar(document(), source, hash),
        source,
        true,
      ),
    ).rejects.toThrow();
    expect(tx.examQuestion.update).not.toHaveBeenCalled();
    expect(tx.examOption.update).not.toHaveBeenCalled();
  });
  it("supports explicit verified clearing and leaves untargeted options unchanged", async () => {
    const d = document();
    d.annotations[0].spans = [];
    rows[0].questionTextEmphasis = [{ start: 0, end: 3, style: "BOLD" }];
    await reconcileEmphasis(
      tx,
      parseEmphasisSidecar(d, source, hash),
      source,
      true,
    );
    expect(rows[0].questionTextEmphasis).toBeNull();
    expect(rows[0].options[1].optionTextEmphasis).toBeNull();
  });
});
