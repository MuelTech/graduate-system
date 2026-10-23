import { beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";

const prismaMock = vi.hoisted(() => ({
  defenseSchedule: { findUnique: vi.fn() },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { AppError } from "../../../src/utils/AppError";
import {
  OfficialDefenseRecordService,
  type OfficialCriteriaDto,
  type OfficialEvaluationBundleSource,
} from "../../../src/services/official-defense-record.service";
import { OfficialDefenseDocumentService } from "../../../src/services/official-defense-document.service";
import { DefenseCommitteePolicy } from "../../../src/services/defense-committee.policy";

const ADMIN = { userId: "admin-1", role: "ADMIN" };
const PNG_SIGNATURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

interface Seat {
  panelAssignmentId: string;
  role: string;
  createdAt: string;
}

function bundleSource(
  panelistCount: number,
  defenseType = "PROPOSAL_DEFENSE",
  programType = "MASTERS",
): OfficialEvaluationBundleSource {
  const assignments: Seat[] = [
    { panelAssignmentId: "chair", role: "CHAIRMAN", createdAt: "2026-09-01T09:00:00.000Z" },
  ];
  for (let i = 1; i <= panelistCount; i += 1) {
    assignments.push({
      panelAssignmentId: `panel-${i}`,
      role: "PANELIST",
      createdAt: `2026-09-01T09:0${i}:00.000Z`,
    });
  }
  return {
    scheduleId: "sched-1",
    defenseType,
    programType,
    studentName: "Juan Dela Cruz",
    evaluatorAssignments: assignments,
  };
}

function v2Record(
  panelAssignmentId: string,
  evaluatorName: string,
  overrides: Partial<OfficialCriteriaDto> = {},
): OfficialCriteriaDto {
  const snapshot = {
    schemaVersion: 1 as const,
    scheduleId: "sched-1",
    panelAssignmentId,
    defenseType: "PROPOSAL_DEFENSE",
    studentName: "Juan Dela Cruz",
    studentNumber: "2026-001",
    program: "Master of Information Technology",
    defenseDate: "2026-09-28T00:00:00.000Z",
    evaluatorName,
    evaluatorUserId: `user-${panelAssignmentId}`,
    functionalRole: panelAssignmentId === "chair" ? "CHAIRMAN" : "PANELIST",
    criteria: {
      timelinessRelevance: 1,
      organization: 1.25,
      depthComprehensiveness: 1.5,
      relevanceConclusions: 1.75,
      evidenceOriginalThinking: 2,
      presentation: 1.25,
      masterySubject: 1.5,
      communicationSkill: 1.75,
      attitude: 2.5,
    },
    groupIValue: 1.5,
    groupIIValue: 1.75,
    overallValue: 1.625,
    rating: null,
    recommendations: `Recommendation for ${evaluatorName}`,
    signedAt: "2026-09-28T10:00:00.000Z",
    finalizedAt: "2026-09-28T10:05:00.000Z",
    scoringVersion: "INSTITUTIONAL_MATRIX_V2" as const,
    snapshotAt: "2026-09-28T10:05:00.000Z",
  };
  return {
    available: true,
    status: "FINALIZED",
    scheduleId: "sched-1",
    panelAssignmentId,
    defenseType: "PROPOSAL_DEFENSE",
    studentName: "Juan Dela Cruz",
    studentNumber: "2026-001",
    program: "Master of Information Technology",
    defenseDate: "2026-09-28T00:00:00.000Z",
    defenseTime: null,
    venueOrLink: null,
    evaluatorName,
    evaluatorUserId: `user-${panelAssignmentId}`,
    functionalRole: snapshot.functionalRole,
    criteria: snapshot.criteria,
    groupIValue: 1.5,
    groupIIValue: 1.75,
    overallValue: 1.625,
    rating: null,
    recommendations: snapshot.recommendations,
    signatureData: PNG_SIGNATURE,
    signedAt: snapshot.signedAt,
    finalizedAt: snapshot.finalizedAt,
    officialSnapshot: snapshot,
    ...overrides,
  };
}

async function pageTexts(bytes: Uint8Array): Promise<string[]> {
  const specifier = "pdfjs-dist/legacy/build/pdf.mjs";
  const { getDocument } = await import(specifier);
  const task = getDocument({
    data: bytes.slice(),
    verbosity: 0,
    disableFontFace: true,
    useSystemFonts: true,
  });
  try {
    const pdf = await task.promise;
    const texts: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const content = await (await pdf.getPage(pageNumber)).getTextContent();
      texts.push(
        content.items
          .filter((item: unknown) => typeof (item as { str?: string }).str === "string")
          .map((item: unknown) => (item as { str: string }).str)
          .join(" "),
      );
    }
    return texts;
  } finally {
    await task.destroy();
  }
}

function serviceFor(source: OfficialEvaluationBundleSource, records: OfficialCriteriaDto[]) {
  const byId = new Map(records.map((record) => [record.panelAssignmentId, record]));
  const getOfficialCriteria = vi.fn(async (_scheduleId: string, panelAssignmentId: string) => {
    const record = byId.get(panelAssignmentId);
    if (!record) throw new AppError("missing record", 404);
    return record;
  });
  const getOfficialEvaluationBundleSource = vi.fn().mockResolvedValue(source);
  return {
    getOfficialCriteria,
    getOfficialEvaluationBundleSource,
    service: new OfficialDefenseDocumentService({
      bundleRecords: { getOfficialCriteria, getOfficialEvaluationBundleSource },
      // The default production logo loader and TEMPLATE-1 renderer are used.
    }),
  };
}

describe("OfficialDefenseRecordService.getOfficialEvaluationBundleSource", () => {
  const records = new OfficialDefenseRecordService();
  const policy = new DefenseCommitteePolicy();

  const seat = (
    role: string,
    name: string,
    createdAt: string,
    id: string,
  ) => {
    const [firstName, ...rest] = name.split(" ");
    return {
      id,
      userId: `user-${id}`,
      role,
      createdAt: new Date(createdAt),
      user: { id: `user-${id}`, firstName, lastName: rest.join(" ") },
    };
  };

  function scheduleRow(
    programType: "MASTERS" | "DOCTORAL",
    defenseType: "TITLE_DEFENSE" | "PROPOSAL_DEFENSE" | "FINAL_DEFENSE",
    options: { panelists?: number; chairman?: number; duplicateUser?: boolean } = {},
  ) {
    const expected = policy.getPolicy(defenseType, programType).panelistCount;
    const panelists = options.panelists ?? expected;
    const chairmanCount = options.chairman ?? 1;
    const panelAssignments = [
      seat("FACILITATOR", "Fac One", "2026-09-01T08:00:00.000Z", "fac"),
      seat("RAPPORTEUR", "Rap One", "2026-09-01T08:01:00.000Z", "rap"),
    ];
    for (let i = 1; i <= panelists; i += 1) {
      panelAssignments.push(
        seat(
          "PANELIST",
          `Panelist ${i}`,
          `2026-09-01T09:0${i}:00.000Z`,
          `panel-${i}`,
        ),
      );
    }
    for (let i = 1; i <= chairmanCount; i += 1) {
      panelAssignments.push(
        seat(
          "CHAIRMAN",
          `Chair ${i}`,
          "2026-09-01T09:59:00.000Z",
          i === 1 ? "chair" : `chair-${i}`,
        ),
      );
    }
    if (defenseType !== "TITLE_DEFENSE") {
      panelAssignments.push(
        seat("ADVISER", "Adviser One", "2026-09-01T08:30:00.000Z", "adv"),
      );
    }
    if (options.duplicateUser) {
      const panelistIndex = panelAssignments.findIndex(
        (assignment) => assignment.role === "PANELIST",
      );
      panelAssignments[panelistIndex] = {
        ...panelAssignments[panelistIndex],
        userId: "user-chair",
      };
    }
    return {
      id: "sched-1",
      defenseType,
      thesis: {
        student: {
          user: { firstName: "Juan", lastName: "Dela Cruz" },
          program: { programType },
        },
      },
      panelAssignments,
    };
  }

  beforeEach(() => vi.clearAllMocks());

  it("rejects non-Admin actors before reading the schedule", async () => {
    try {
      await records.getOfficialEvaluationBundleSource("sched-1", {
        userId: "u1",
        role: "PANELIST",
      });
      throw new Error("expected rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).statusCode).toBe(403);
    }
    expect(prismaMock.defenseSchedule.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a missing exact schedule with 404", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(null);
    await expect(
      records.getOfficialEvaluationBundleSource("sched-404", ADMIN),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(prismaMock.defenseSchedule.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "sched-404" } }),
    );
  });

  it.each([
    ["MASTERS", "TITLE_DEFENSE"],
    ["MASTERS", "PROPOSAL_DEFENSE"],
    ["DOCTORAL", "TITLE_DEFENSE"],
    ["DOCTORAL", "FINAL_DEFENSE"],
  ] as const)(
    "uses DefenseCommitteePolicy for %s %s and excludes non-evaluators",
    async (programType, defenseType) => {
      prismaMock.defenseSchedule.findUnique.mockResolvedValue(
        scheduleRow(programType, defenseType),
      );

      const result = await records.getOfficialEvaluationBundleSource(
        "sched-1",
        ADMIN,
      );

      const expectedPanelists = policy.getPolicy(
        defenseType,
        programType,
      ).panelistCount;
      expect(result.programType).toBe(programType);
      expect(result.defenseType).toBe(defenseType);
      expect(result.evaluatorAssignments).toHaveLength(expectedPanelists + 1);
      expect(result.evaluatorAssignments[0].role).toBe("CHAIRMAN");
      expect(
        result.evaluatorAssignments.filter((a) => a.role === "PANELIST"),
      ).toHaveLength(expectedPanelists);
      expect(
        result.evaluatorAssignments.some((a) =>
          ["ADVISER", "FACILITATOR", "RAPPORTEUR"].includes(a.role),
        ),
      ).toBe(false);
    },
  );

  it("orders Chairman first and Panelists by createdAt then id despite raw DB order", async () => {
    const row = scheduleRow("DOCTORAL", "PROPOSAL_DEFENSE");
    row.panelAssignments = [...row.panelAssignments].reverse();
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(row);

    const result = await records.getOfficialEvaluationBundleSource(
      "sched-1",
      ADMIN,
    );

    expect(result.evaluatorAssignments.map((a) => a.role)).toEqual([
      "CHAIRMAN",
      "PANELIST",
      "PANELIST",
      "PANELIST",
      "PANELIST",
    ]);
    expect(result.evaluatorAssignments.slice(1).map((a) => a.panelAssignmentId)).toEqual([
      "panel-1",
      "panel-2",
      "panel-3",
      "panel-4",
    ]);
  });

  it("breaks equal createdAt values by assignment id ascending", async () => {
    const row = scheduleRow("MASTERS", "PROPOSAL_DEFENSE");
    row.panelAssignments = row.panelAssignments.map((assignment) =>
      assignment.role === "PANELIST"
        ? { ...assignment, createdAt: new Date("2026-09-01T09:10:00.000Z") }
        : assignment,
    );
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(row);

    const result = await records.getOfficialEvaluationBundleSource(
      "sched-1",
      ADMIN,
    );
    expect(result.evaluatorAssignments.slice(1).map((a) => a.panelAssignmentId)).toEqual([
      "panel-1",
      "panel-2",
      "panel-3",
    ]);
  });

  it("rejects unsupported program and defense types", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow("MASTERS", "PROPOSAL_DEFENSE"),
    );
    prismaMock.defenseSchedule.findUnique.mockResolvedValueOnce({
      id: "sched-1",
      defenseType: "PROPOSAL_DEFENSE",
      thesis: {
        student: {
          user: { firstName: "Juan", lastName: "Dela Cruz" },
          program: { programType: "UNKNOWN" },
        },
      },
      panelAssignments: [],
    });
    await expect(
      records.getOfficialEvaluationBundleSource("sched-1", ADMIN),
    ).rejects.toMatchObject({ statusCode: 422 });

    prismaMock.defenseSchedule.findUnique.mockResolvedValueOnce({
      id: "sched-1",
      defenseType: "COMPREHENSIVE_EXAM",
      thesis: {
        student: {
          user: { firstName: "Juan", lastName: "Dela Cruz" },
          program: { programType: "MASTERS" },
        },
      },
      panelAssignments: [],
    });
    await expect(
      records.getOfficialEvaluationBundleSource("sched-1", ADMIN),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it("requires exactly one Chairman", async () => {
    for (const chairman of [0, 2]) {
      prismaMock.defenseSchedule.findUnique.mockResolvedValue(
        scheduleRow("MASTERS", "PROPOSAL_DEFENSE", { chairman }),
      );
      await expect(
        records.getOfficialEvaluationBundleSource("sched-1", ADMIN),
      ).rejects.toThrow(/Chairman/i);
    }
  });

  it("requires the exact policy Panelist count (no truncation or padding)", async () => {
    const expected = policy.getPolicy(
      "PROPOSAL_DEFENSE",
      "DOCTORAL",
    ).panelistCount;
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow("DOCTORAL", "PROPOSAL_DEFENSE", {
        panelists: expected - 1,
      }),
    );
    await expect(
      records.getOfficialEvaluationBundleSource("sched-1", ADMIN),
    ).rejects.toThrow(/Panelist/i);
  });

  it("rejects a duplicate evaluator assignment", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow("MASTERS", "PROPOSAL_DEFENSE", { duplicateUser: true }),
    );
    await expect(
      records.getOfficialEvaluationBundleSource("sched-1", ADMIN),
    ).rejects.toThrow(/same evaluator|duplicate/i);
  });
});

describe("OfficialDefenseDocumentService.generateEvaluationBundlePdf", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["MASTERS", "TITLE_DEFENSE", 4],
    ["MASTERS", "PROPOSAL_DEFENSE", 3],
    ["MASTERS", "FINAL_DEFENSE", 3],
    ["DOCTORAL", "TITLE_DEFENSE", 5],
    ["DOCTORAL", "PROPOSAL_DEFENSE", 4],
    ["DOCTORAL", "FINAL_DEFENSE", 4],
  ] as const)(
    "%s %s bundle has Chairman + %i Panelists, one form per page",
    async (programType, defenseType, panelistCount) => {
      const expectedPanelists = new DefenseCommitteePolicy().getPolicy(
        defenseType,
        programType,
      ).panelistCount;
      expect(expectedPanelists).toBe(panelistCount);

      const source = bundleSource(panelistCount, defenseType, programType);
      const records = source.evaluatorAssignments.map((assignment) =>
        v2Record(
          assignment.panelAssignmentId,
          assignment.panelAssignmentId === "chair"
            ? "Chair One"
            : `Panelist ${assignment.panelAssignmentId.split("-")[1]}`,
        ),
      );
      const { service } = serviceFor(source, records);

      const pdf = await service.generateEvaluationBundlePdf("sched-1", ADMIN);
      expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");

      const doc = await PDFDocument.load(pdf);
      expect(doc.getPageCount()).toBe(panelistCount + 1);

      const texts = await pageTexts(pdf);
      expect(texts).toHaveLength(panelistCount + 1);
      expect(texts[0]).toContain("Chair One");
      for (let i = 1; i <= panelistCount; i += 1) {
        expect(texts[i]).toContain(`Panelist ${i}`);
      }
    },
  );

  it("loads logos once and renders every evaluator through the accepted renderer", async () => {
    const source = bundleSource(3);
    const records = source.evaluatorAssignments.map((assignment) =>
      v2Record(assignment.panelAssignmentId, `Evaluator ${assignment.panelAssignmentId}`),
    );
    const byId = new Map(records.map((record) => [record.panelAssignmentId, record]));
    const render = vi.fn(async () => {
      const doc = await PDFDocument.create();
      doc.addPage();
      return doc.save();
    });
    const loadLogos = vi.fn(async () => ({
      earist: { bytes: new Uint8Array([1]), mimeType: "image/jpeg" as const },
      graduateSchool: { bytes: new Uint8Array([2]), mimeType: "image/jpeg" as const },
    }));
    const service = new OfficialDefenseDocumentService({
      bundleRecords: {
        getOfficialEvaluationBundleSource: vi.fn().mockResolvedValue(source),
        getOfficialCriteria: vi.fn(async (_scheduleId: string, panelAssignmentId: string) =>
          byId.get(panelAssignmentId),
        ) as never,
      },
      loadLogos,
      render,
    });

    const pdf = await service.generateEvaluationBundlePdf("sched-1", ADMIN);
    expect(loadLogos).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledTimes(4);
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(4);
  });

  it("fails closed when any evaluator record is a DRAFT", async () => {
    const source = bundleSource(3);
    const records = source.evaluatorAssignments.map((assignment) =>
      v2Record(assignment.panelAssignmentId, `Evaluator ${assignment.panelAssignmentId}`),
    );
    records[2] = { ...records[2], available: false, status: "DRAFT", officialSnapshot: null };
    const { service } = serviceFor(source, records);

    await expect(
      service.generateEvaluationBundlePdf("sched-1", ADMIN),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("fails closed when any evaluator record is unsigned", async () => {
    const source = bundleSource(3);
    const records = source.evaluatorAssignments.map((assignment) =>
      v2Record(assignment.panelAssignmentId, `Evaluator ${assignment.panelAssignmentId}`),
    );
    records[1] = { ...records[1], signatureData: null };
    const { service } = serviceFor(source, records);

    await expect(
      service.generateEvaluationBundlePdf("sched-1", ADMIN),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("fails closed for a legacy evaluator record", async () => {
    const source = bundleSource(3);
    const records = source.evaluatorAssignments.map((assignment) =>
      v2Record(assignment.panelAssignmentId, `Evaluator ${assignment.panelAssignmentId}`),
    );
    const snapshot = {
      ...records[3].officialSnapshot!,
      scoringVersion: "LEGACY_POINTS_V1" as const,
    };
    records[3] = { ...records[3], officialSnapshot: snapshot };
    const { service } = serviceFor(source, records);

    await expect(
      service.generateEvaluationBundlePdf("sched-1", ADMIN),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it("fails closed for malformed signature evidence", async () => {
    const source = bundleSource(3);
    const records = source.evaluatorAssignments.map((assignment) =>
      v2Record(assignment.panelAssignmentId, `Evaluator ${assignment.panelAssignmentId}`),
    );
    records[2] = { ...records[2], signatureData: "not-a-data-url" };
    const { service } = serviceFor(source, records);

    await expect(
      service.generateEvaluationBundlePdf("sched-1", ADMIN),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it("rejects a cross-schedule evaluator record", async () => {
    const source = bundleSource(3);
    const records = source.evaluatorAssignments.map((assignment) =>
      v2Record(assignment.panelAssignmentId, `Evaluator ${assignment.panelAssignmentId}`),
    );
    records[1] = { ...records[1], scheduleId: "sched-other" };
    const { service } = serviceFor(source, records);

    await expect(
      service.generateEvaluationBundlePdf("sched-1", ADMIN),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects a renderer that produces more than one page per evaluator", async () => {
    const source = bundleSource(1);
    const records = source.evaluatorAssignments.map((assignment) =>
      v2Record(assignment.panelAssignmentId, `Evaluator ${assignment.panelAssignmentId}`),
    );
    const byId = new Map(records.map((record) => [record.panelAssignmentId, record]));
    const service = new OfficialDefenseDocumentService({
      bundleRecords: {
        getOfficialEvaluationBundleSource: vi.fn().mockResolvedValue(source),
        getOfficialCriteria: vi.fn(async (_scheduleId: string, panelAssignmentId: string) =>
          byId.get(panelAssignmentId),
        ) as never,
      },
      render: async () => {
        const doc = await PDFDocument.create();
        doc.addPage();
        doc.addPage();
        return doc.save();
      },
    });

    await expect(
      service.generateEvaluationBundlePdf("sched-1", ADMIN),
    ).rejects.toThrow(/one page|page/i);
  });

  it("rejects non-Admin actors before reading the bundle source", async () => {
    const source = bundleSource(3);
    const { service, getOfficialEvaluationBundleSource } = serviceFor(source, []);

    for (const actor of [
      { userId: "u1", role: "PANELIST" },
      { userId: "s1", role: "STUDENT" },
    ]) {
      await expect(
        service.generateEvaluationBundlePdf("sched-1", actor),
      ).rejects.toMatchObject({ statusCode: 403 });
    }
    expect(getOfficialEvaluationBundleSource).not.toHaveBeenCalled();
  });
});
