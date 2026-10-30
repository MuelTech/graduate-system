import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  OLSAT_MANIFEST_SHA256,
  textSha256,
} from "../../../src/services/exam-emphasis.service";
const mock = vi.hoisted(() => ({
  readFile: vi.fn(),
  lstat: vi.fn(),
  realpath: vi.fn(),
  preflight: vi.fn(),
  transaction: vi.fn(),
  disconnect: vi.fn(),
  qUpdate: vi.fn(),
  oUpdate: vi.fn(),
}));
vi.mock("fs/promises", () => ({
  default: {
    readFile: mock.readFile,
    lstat: mock.lstat,
    realpath: mock.realpath,
  },
}));
vi.mock("../../../src/config/database", () => ({
  default: { $transaction: mock.transaction, $disconnect: mock.disconnect },
}));
vi.mock("../../../src/services/exam-content-package.service", () => ({
  preflightExamPackage: mock.preflight,
}));
import { runExamEmphasisCli } from "../../../src/cli/exam-emphasis";
const source = {
  fingerprint: "synthetic-source",
  questions: [
    {
      sourceQuestionNumber: 1,
      input: {
        questionText: "Synthetic text",
        options: [{ label: "F", order: 0, optionText: "First" }],
      },
    },
  ],
};
let rows: any[];
beforeEach(() => {
  vi.resetAllMocks();
  rows = [
    {
      id: "q",
      sourceQuestionNumber: 1,
      questionText: "Synthetic text",
      questionTextEmphasis: null,
      options: [
        {
          id: "o",
          label: "F",
          order: 0,
          optionText: "First",
          optionTextEmphasis: null,
        },
      ],
    },
  ];
  const document = {
    schemaVersion: 2,
    packageKey: "olsat",
    manifestSha256: OLSAT_MANIFEST_SHA256,
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
        textSha256: textSha256("Synthetic text"),
        spans: [{ start: 0, end: 3, style: "BOLD" }],
      },
      {
        sourceQuestionNumber: 1,
        target: { field: "optionText", label: "F", order: 0 },
        textSha256: textSha256("First"),
        spans: [{ start: 0, end: 2, style: "UNDERLINE" }],
      },
    ],
  };
  const bytes = Buffer.from(JSON.stringify(document));
  const manifest = fs.readFileSync(
    path.resolve("exam-content/olsat/manifest.json"),
  );
  mock.lstat.mockResolvedValue({
    size: bytes.length,
    isFile: () => true,
    isSymbolicLink: () => false,
  });
  mock.realpath.mockImplementation(async (p) => p);
  mock.readFile.mockImplementation(async (p) =>
    String(p).endsWith("olsat-emphasis.json") ? bytes : manifest,
  );
  mock.preflight.mockResolvedValue(source);
  mock.qUpdate.mockImplementation(async ({ data }) =>
    Object.assign(rows[0], data),
  );
  mock.oUpdate.mockImplementation(async ({ data }) =>
    Object.assign(rows[0].options[0], data),
  );
  mock.transaction.mockImplementation(async (callback) => {
    const before = structuredClone(rows);
    try {
      return await callback({
        examContentImport: {
          findUnique: async () => ({
            fingerprint: source.fingerprint,
            questionCount: 1,
          }),
        },
        examQuestion: { findMany: async () => rows, update: mock.qUpdate },
        examOption: { update: mock.oUpdate },
      });
    } catch (e) {
      rows = before;
      throw e;
    }
  });
});
describe("fixed-path semantic emphasis operator CLI", () => {
  it("adapts grouped structured writes and SQL null clears without clobbering question marks", async () => {
    const structuredStimulus = {
      type: "WORD_SERIES",
      items: ["alpha", "bravo"],
    };
    const prepared = structuredClone(source);
    Object.assign(prepared.questions[0].input, {
      stimulusType: "STRUCTURED",
      structuredStimulus,
    });
    mock.preflight.mockResolvedValue(prepared);
    Object.assign(rows[0], {
      stimulusType: "STRUCTURED",
      structuredStimulus,
      structuredStimulusEmphasis: null,
    });
    const originalRead = mock.readFile.getMockImplementation()!;
    const document = JSON.parse(
      String(await originalRead("olsat-emphasis.json")),
    );
    document.annotations = [0, 1].map((index) => ({
      sourceQuestionNumber: 1,
      target: { field: "structuredItem", index },
      textSha256: textSha256(structuredStimulus.items[index]),
      spans: [{ start: 0, end: 3, style: "ITALIC" }],
    }));
    mock.lstat.mockImplementation(async () => ({
      size: Buffer.byteLength(JSON.stringify(document)),
      isFile: () => true,
      isSymbolicLink: () => false,
    }));
    mock.readFile.mockImplementation(async (p) =>
      String(p).endsWith("olsat-emphasis.json")
        ? Buffer.from(JSON.stringify(document))
        : originalRead(p),
    );
    expect(await runExamEmphasisCli(["--apply"])).toMatchObject({
      status: "APPLIED",
      fieldsChanged: 1,
      annotationsValidated: 2,
    });
    expect(mock.qUpdate).toHaveBeenCalledTimes(1);
    expect(mock.qUpdate.mock.calls[0][0].data).toEqual({
      structuredStimulusEmphasis: [0, 1].map((index) => ({
        index,
        spans: [{ start: 0, end: 3, style: "ITALIC" }],
      })),
    });
    mock.qUpdate.mockClear();
    expect(await runExamEmphasisCli(["--apply"])).toMatchObject({
      status: "ALREADY_APPLIED",
      fieldsChanged: 0,
    });
    expect(mock.qUpdate).not.toHaveBeenCalled();
    document.annotations.forEach((annotation: any) => {
      annotation.spans = [];
    });
    await runExamEmphasisCli(["--apply"]);
    const { Prisma } = await import("@prisma/client");
    expect(mock.qUpdate.mock.calls[0][0].data).toEqual({
      structuredStimulusEmphasis: Prisma.DbNull,
    });
    expect(rows[0].questionTextEmphasis).toBeNull();
    expect(mock.oUpdate).not.toHaveBeenCalled();
  });
  it("defaults to read-only preflight within the expected transaction boundary", async () => {
    expect(await runExamEmphasisCli([])).toMatchObject({
      status: "PREFLIGHT_OK",
      fieldsChanged: 0,
      fieldsWouldChange: 2,
    });
    expect(mock.qUpdate).not.toHaveBeenCalled();
    expect(mock.oUpdate).not.toHaveBeenCalled();
    expect(mock.transaction.mock.calls[0][1]).toEqual({
      isolationLevel: "Serializable",
      maxWait: 10000,
      timeout: 60000,
    });
    expect(mock.disconnect).toHaveBeenCalled();
  });
  it("applies synthetic metadata then returns ALREADY_APPLIED without any second writes", async () => {
    expect(await runExamEmphasisCli(["--apply"])).toMatchObject({
      status: "APPLIED",
      fieldsChanged: 2,
    });
    mock.qUpdate.mockClear();
    mock.oUpdate.mockClear();
    expect(await runExamEmphasisCli(["--apply"])).toMatchObject({
      status: "ALREADY_APPLIED",
      fieldsChanged: 0,
    });
    expect(mock.qUpdate).not.toHaveBeenCalled();
    expect(mock.oUpdate).not.toHaveBeenCalled();
    expect(rows[0].id).toBe("q");
    expect(rows[0].options[0].id).toBe("o");
  });
  it("propagates write failure through transaction rollback and still disconnects", async () => {
    mock.oUpdate.mockRejectedValue(new Error("Synthetic transaction failure"));
    await expect(runExamEmphasisCli(["--apply"])).rejects.toThrow();
    expect(rows[0].questionTextEmphasis).toBeNull();
    expect(mock.disconnect).toHaveBeenCalled();
  });
  it.each([["--root"], ["--apply", "--dry-run"], ["--apply", "--apply"]])(
    "rejects unsafe/ambiguous arguments %s",
    async (args) => {
      await expect(runExamEmphasisCli(args)).rejects.toThrow();
      expect(mock.transaction).not.toHaveBeenCalled();
    },
  );
  it("fails absent sidecar before loading any DB operation", async () => {
    mock.lstat.mockRejectedValue(new Error("ENOENT"));
    await expect(runExamEmphasisCli([])).rejects.toThrow();
    expect(mock.transaction).not.toHaveBeenCalled();
  });
  it("fails tampered manifest before DB operations", async () => {
    mock.readFile.mockResolvedValueOnce(Buffer.from(JSON.stringify({})));
    await expect(runExamEmphasisCli([])).rejects.toThrow();
    expect(mock.transaction).not.toHaveBeenCalled();
  });
});
