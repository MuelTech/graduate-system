import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  defenseSchedule: { findUnique: vi.fn() },
  panelAssignment: { findUnique: vi.fn() },
  oralExamScore: { findUnique: vi.fn(), updateMany: vi.fn() },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { AppError } from "../../../src/utils/AppError";
import { OfficialDefenseRecordService } from "../../../src/services/official-defense-record.service";
import {
  MAX_SIGNATURE_BYTES,
  OfficialDefenseDocumentService,
  decodeEvaluatorSignature,
  mapOfficialCriteriaToRenderInput,
} from "../../../src/services/official-defense-document.service";
import { loadOfficialFormLogos } from "../../../src/services/official-form-assets";
import type { OfficialCriteriaDto, OralExamScoreOfficialSnapshot } from "../../../src/services/official-defense-record.service";

/** Valid 1x1 PNG (transparent). Used only as signature evidence in tests. */
const PNG_SIGNATURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const ADMIN = { userId: "admin-1", role: "ADMIN" };
const LOGOS = {
  earist: { bytes: new Uint8Array([1, 2, 3]), mimeType: "image/jpeg" as const },
  graduateSchool: { bytes: new Uint8Array([4, 5, 6]), mimeType: "image/jpeg" as const },
};

function v2Snapshot(): OralExamScoreOfficialSnapshot {
  return {
    schemaVersion: 1,
    scheduleId: "sched-1",
    panelAssignmentId: "p1",
    defenseType: "PROPOSAL_DEFENSE",
    studentName: "Juan Dela Cruz",
    studentNumber: "2026-001",
    program: "Master of Information Technology",
    defenseDate: "2026-09-28T00:00:00.000Z",
    evaluatorName: "Ana Reyes",
    evaluatorUserId: "u1",
    functionalRole: "PANELIST",
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
    recommendations: "Improve the methodology chapter.",
    signedAt: "2026-09-28T10:00:00.000Z",
    finalizedAt: "2026-09-28T10:05:00.000Z",
    scoringVersion: "INSTITUTIONAL_MATRIX_V2",
    snapshotAt: "2026-09-28T10:05:00.000Z",
  };
}

function v2Record(overrides: Partial<OfficialCriteriaDto> = {}): OfficialCriteriaDto {
  const snapshot = v2Snapshot();
  return {
    available: true,
    status: "FINALIZED",
    scheduleId: "sched-1",
    panelAssignmentId: "p1",
    defenseType: "PROPOSAL_DEFENSE",
    studentName: "Juan Dela Cruz",
    studentNumber: "2026-001",
    program: "Master of Information Technology",
    defenseDate: "2026-09-28T00:00:00.000Z",
    defenseTime: null,
    venueOrLink: null,
    evaluatorName: "Ana Reyes",
    evaluatorUserId: "u1",
    functionalRole: "PANELIST",
    criteria: snapshot.criteria,
    groupIValue: snapshot.groupIValue,
    groupIIValue: snapshot.groupIIValue,
    overallValue: snapshot.overallValue,
    rating: snapshot.rating,
    recommendations: snapshot.recommendations,
    signatureData: PNG_SIGNATURE,
    signedAt: snapshot.signedAt,
    finalizedAt: snapshot.finalizedAt,
    officialSnapshot: snapshot,
    ...overrides,
  };
}

function expectAppError(error: unknown, statusCode: number, message: RegExp): void {
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).statusCode).toBe(statusCode);
  expect((error as AppError).message).toMatch(message);
}

const scheduleBase = {
  id: "sched-1",
  defenseType: "PROPOSAL_DEFENSE",
  sessionStatus: "AWAITING_CONCLUSION",
  defenseDate: new Date("2026-09-28T00:00:00Z"),
  defenseTime: new Date("1970-01-01T10:00:00Z"),
  venueOrLink: "Room 101",
  thesisId: "thesis-1",
  thesis: {
    student: {
      studentNumber: "2026-001",
      user: { firstName: "Juan", lastName: "Dela Cruz" },
      program: { programName: "Master of Information Technology", programType: "MASTERS" },
    },
  },
};

function finalizedV2Score() {
  return {
    id: "score-p1",
    scheduleId: "sched-1",
    panelId: "p1",
    status: "FINALIZED",
    scoringVersion: "INSTITUTIONAL_MATRIX_V2",
    timelinessRelevance: 1,
    organization: 1.25,
    depthComprehensiveness: 1.5,
    relevanceConclusions: 1.75,
    evidenceOriginalThinking: 2,
    presentation: 1.25,
    masterySubject: 1.5,
    communicationSkill: 1.75,
    attitude: 2.5,
    groupAAverage: 1.5,
    groupBAverage: 1.75,
    overallAverage: 1.625,
    rating: null,
    recommendations: "Improve the methodology chapter.",
    signatureData: PNG_SIGNATURE,
    signedAt: new Date("2026-09-28T10:00:00Z"),
    finalizedAt: new Date("2026-09-28T10:05:00Z"),
    officialSnapshot: null,
  };
}

describe("decodeEvaluatorSignature", () => {
  it("accepts PNG data URL evidence and returns the exact bytes", () => {
    const image = decodeEvaluatorSignature(PNG_SIGNATURE);
    expect(image.mimeType).toBe("image/png");
    expect(image.bytes.length).toBeGreaterThan(0);
    expect(image.bytes[0]).toBe(0x89);
  });

  it("rejects missing signature evidence", () => {
    try {
      decodeEvaluatorSignature(null);
      throw new Error("expected rejection");
    } catch (error) {
      expectAppError(error, 409, /signature/i);
    }
  });

  it("rejects a malformed data URL", () => {
    try {
      decodeEvaluatorSignature("not-a-data-url");
      throw new Error("expected rejection");
    } catch (error) {
      expectAppError(error, 422, /malformed/i);
    }
  });

  it("rejects unsupported MIME types", () => {
    try {
      decodeEvaluatorSignature("data:image/gif;base64,R0lGODlhAQABAAAAACw=");
      throw new Error("expected rejection");
    } catch (error) {
      expectAppError(error, 422, /malformed/i);
    }
  });

  it("rejects invalid base64 payloads", () => {
    try {
      decodeEvaluatorSignature("data:image/png;base64,!!!!");
      throw new Error("expected rejection");
    } catch (error) {
      expectAppError(error, 422, /malformed/i);
    }
  });

  it("rejects image bytes whose magic bytes do not match the declared MIME", () => {
    try {
      decodeEvaluatorSignature(`data:image/png;base64,${Buffer.from([0xff, 0xd8, 0xff, 0x00]).toString("base64")}`);
      throw new Error("expected rejection");
    } catch (error) {
      expectAppError(error, 422, /image data/i);
    }
  });

  it("rejects evidence larger than the local official-form limit", () => {
    const oversized = `data:image/png;base64,${Buffer.alloc(MAX_SIGNATURE_BYTES + 1).toString("base64")}`;
    try {
      decodeEvaluatorSignature(oversized);
      throw new Error("expected rejection");
    } catch (error) {
      expectAppError(error, 413, /limit/i);
    }
  });
});

describe("mapOfficialCriteriaToRenderInput", () => {
  it("maps the authoritative V2 snapshot into TEMPLATE-1 exactly", () => {
    const input = mapOfficialCriteriaToRenderInput(v2Record(), LOGOS);

    expect(input.candidateName).toBe("Juan Dela Cruz");
    expect(input.course).toBe("Master of Information Technology");
    expect(input.date).toBe("28 September 2026");
    expect(input.evaluatorPrintedName).toBe("Ana Reyes");
    expect(input.groupI).toEqual(["1.00", "1.25", "1.50", "1.75", "2.00"]);
    expect(input.groupII).toEqual(["1.25", "1.50", "1.75", "2.50"]);
    expect(input.groupIAverage).toBe("1.50");
    expect(input.groupIIAverage).toBe("1.75");
    expect(input.recommendations).toBe("Improve the methodology chapter.");
    expect(input.rating).toBe("");
    expect(input.remarks).toBe("");
    expect(input.logos).toBe(LOGOS);
    expect(input.evaluatorSignature?.mimeType).toBe("image/png");
  });

  it("uses snapshot academic values rather than mutable record fields", () => {
    const record = v2Record({
      criteria: {
        timelinessRelevance: 2.5,
        organization: 2.5,
        depthComprehensiveness: 2.5,
        relevanceConclusions: 2.5,
        evidenceOriginalThinking: 2.5,
        presentation: 2.5,
        masterySubject: 2.5,
        communicationSkill: 2.5,
        attitude: 2.5,
      },
      groupIValue: 2.5,
      groupIIValue: 2.5,
      recommendations: "Mutable field value",
      rating: "Mutable rating",
    });

    const input = mapOfficialCriteriaToRenderInput(record, LOGOS);

    expect(input.groupI).toEqual(["1.00", "1.25", "1.50", "1.75", "2.00"]);
    expect(input.groupIAverage).toBe("1.50");
    expect(input.recommendations).toBe("Improve the methodology chapter.");
    expect(input.rating).toBe("");
  });

  it("maps a non-null rating only to rating, never to remarks", () => {
    const snapshot = { ...v2Snapshot(), rating: "Passed" };
    const input = mapOfficialCriteriaToRenderInput(
      v2Record({ rating: "Passed", officialSnapshot: snapshot }),
      LOGOS,
    );
    expect(input.rating).toBe("Passed");
    expect(input.remarks).toBe("");
  });

  it("fails closed for LEGACY_POINTS_V1 snapshots", () => {
    const snapshot = { ...v2Snapshot(), scoringVersion: "LEGACY_POINTS_V1" as const };
    try {
      mapOfficialCriteriaToRenderInput(v2Record({ officialSnapshot: snapshot }), LOGOS);
      throw new Error("expected rejection");
    } catch (error) {
      expectAppError(error, 422, /legacy/i);
    }
  });

  it("fails closed when the official snapshot is absent", () => {
    try {
      mapOfficialCriteriaToRenderInput(v2Record({ officialSnapshot: null, available: false }), LOGOS);
      throw new Error("expected rejection");
    } catch (error) {
      expectAppError(error, 409, /finalized/i);
    }
  });

  it("rejects criterion values outside the printed institutional matrix", () => {
    const snapshot = { ...v2Snapshot(), criteria: { ...v2Snapshot().criteria, organization: 2.25 } };
    try {
      mapOfficialCriteriaToRenderInput(v2Record({ officialSnapshot: snapshot }), LOGOS);
      throw new Error("expected rejection");
    } catch (error) {
      expectAppError(error, 422, /organization/i);
    }
  });

  it("rejects a missing criterion value instead of printing a blank official form", () => {
    const snapshot = { ...v2Snapshot(), criteria: { ...v2Snapshot().criteria, attitude: null } };
    try {
      mapOfficialCriteriaToRenderInput(v2Record({ officialSnapshot: snapshot }), LOGOS);
      throw new Error("expected rejection");
    } catch (error) {
      expectAppError(error, 422, /attitude/i);
    }
  });

  it("rejects a missing or out-of-range Group I average", () => {
    for (const groupIValue of [null, 0.75, 2.51]) {
      const snapshot = { ...v2Snapshot(), groupIValue };
      try {
        mapOfficialCriteriaToRenderInput(v2Record({ officialSnapshot: snapshot }), LOGOS);
        throw new Error("expected rejection");
      } catch (error) {
        expectAppError(error, 422, /group i/i);
      }
    }
  });

  it("rejects a missing candidate identity instead of rendering an empty form", () => {
    const snapshot = { ...v2Snapshot(), studentName: null };
    try {
      mapOfficialCriteriaToRenderInput(
        v2Record({ officialSnapshot: snapshot, studentName: null }),
        LOGOS,
      );
      throw new Error("expected rejection");
    } catch (error) {
      expectAppError(error, 422, /candidate/i);
    }
  });

  it("rejects a missing evaluator printed name", () => {
    const snapshot = {
      ...v2Snapshot(),
      evaluatorName: null,
    };
    try {
      mapOfficialCriteriaToRenderInput(
        v2Record({ officialSnapshot: snapshot, evaluatorName: null }),
        LOGOS,
      );
      throw new Error("expected rejection");
    } catch (error) {
      expectAppError(error, 422, /evaluator/i);
    }
  });
});

describe("OfficialDefenseDocumentService.generateIndividualEvaluationPdf", () => {
  beforeEach(() => vi.clearAllMocks());

  function makeService(record: OfficialCriteriaDto) {
    const getOfficialCriteria = vi.fn().mockResolvedValue(record);
    const render = vi.fn().mockResolvedValue(Buffer.from("%PDF-1.7 fake"));
    const service = new OfficialDefenseDocumentService({
      records: { getOfficialCriteria },
      loadLogos: async () => LOGOS,
      render,
    });
    return { service, getOfficialCriteria, render };
  }

  it("generates for a finalized V2 PANELIST record and passes the actor through", async () => {
    const { service, getOfficialCriteria, render } = makeService(v2Record());

    const pdf = await service.generateIndividualEvaluationPdf("sched-1", "p1", ADMIN);

    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
    expect(getOfficialCriteria).toHaveBeenCalledWith("sched-1", "p1", ADMIN);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("generates for a finalized V2 CHAIRMAN record", async () => {
    const snapshot = { ...v2Snapshot(), functionalRole: "CHAIRMAN" };
    const record = v2Record({ functionalRole: "CHAIRMAN", officialSnapshot: snapshot });
    const { service, render } = makeService(record);

    const pdf = await service.generateIndividualEvaluationPdf("sched-1", "p1", ADMIN);

    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
    expect(render).toHaveBeenCalledWith(expect.objectContaining({ evaluatorPrintedName: "Ana Reyes" }));
  });

  it("produces real PDF bytes through the accepted TEMPLATE-1 renderer", async () => {
    const record = v2Record();
    const service = new OfficialDefenseDocumentService({
      records: { getOfficialCriteria: vi.fn().mockResolvedValue(record) },
    });

    const pdf = await service.generateIndividualEvaluationPdf("sched-1", "p1", ADMIN);

    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it("denies non-Admin actors before reading the official record", async () => {
    const { service, getOfficialCriteria } = makeService(v2Record());
    for (const actor of [
      { userId: "u1", role: "PANELIST" },
      { userId: "s1", role: "STUDENT" },
    ]) {
      try {
        await service.generateIndividualEvaluationPdf("sched-1", "p1", actor);
        throw new Error("expected rejection");
      } catch (error) {
        expectAppError(error, 403, /admin/i);
      }
    }
    expect(getOfficialCriteria).not.toHaveBeenCalled();
  });

  it("rejects a DRAFT / not-finalized evaluation", async () => {
    const { service, render } = makeService(
      v2Record({ available: false, status: "DRAFT", officialSnapshot: null, signatureData: null }),
    );
    try {
      await service.generateIndividualEvaluationPdf("sched-1", "p1", ADMIN);
      throw new Error("expected rejection");
    } catch (error) {
      expectAppError(error, 409, /finalized/i);
    }
    expect(render).not.toHaveBeenCalled();
  });

  it("rejects a finalized record with missing signature evidence", async () => {
    const { service, render } = makeService(v2Record({ signatureData: null }));
    try {
      await service.generateIndividualEvaluationPdf("sched-1", "p1", ADMIN);
      throw new Error("expected rejection");
    } catch (error) {
      expectAppError(error, 409, /signature/i);
    }
    expect(render).not.toHaveBeenCalled();
  });

  it("rejects LEGACY_POINTS_V1 through the service boundary", async () => {
    const snapshot = { ...v2Snapshot(), scoringVersion: "LEGACY_POINTS_V1" as const };
    const { service, render } = makeService(v2Record({ officialSnapshot: snapshot }));
    try {
      await service.generateIndividualEvaluationPdf("sched-1", "p1", ADMIN);
      throw new Error("expected rejection");
    } catch (error) {
      expectAppError(error, 422, /legacy/i);
    }
    expect(render).not.toHaveBeenCalled();
  });

  it("maps renderer content rejection to a controlled 422", async () => {
    const failing = new OfficialDefenseDocumentService({
      records: { getOfficialCriteria: vi.fn().mockResolvedValue(v2Record()) },
      loadLogos: async () => LOGOS,
      render: async () => {
        throw new RangeError("Recommendations exceed the field bounds.");
      },
    });
    try {
      await failing.generateIndividualEvaluationPdf("sched-1", "p1", ADMIN);
      throw new Error("expected rejection");
    } catch (error) {
      expectAppError(error, 422, /cannot/i);
    }
  });

  it("fails closed when the exact schedule + panel assignment binding does not match", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleBase);
    prismaMock.panelAssignment.findUnique.mockResolvedValue({
      id: "p1",
      scheduleId: "sched-other",
      userId: "u1",
      role: "PANELIST",
      user: { id: "u1", firstName: "Ana", lastName: "Reyes" },
    });

    const service = new OfficialDefenseDocumentService({
      records: new OfficialDefenseRecordService(),
      loadLogos: async () => LOGOS,
      render: async () => Buffer.from("%PDF-1.7"),
    });

    try {
      await service.generateIndividualEvaluationPdf("sched-1", "p1", ADMIN);
      throw new Error("expected rejection");
    } catch (error) {
      expectAppError(error, 404, /Panel assignment not found/i);
    }
  });

  it("fails closed for a non-evaluator assignment", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleBase);
    prismaMock.panelAssignment.findUnique.mockResolvedValue({
      id: "pr",
      scheduleId: "sched-1",
      userId: "ur",
      role: "RAPPORTEUR",
      user: { id: "ur", firstName: "Rita", lastName: "Santos" },
    });

    const service = new OfficialDefenseDocumentService({
      records: new OfficialDefenseRecordService(),
      loadLogos: async () => LOGOS,
      render: async () => Buffer.from("%PDF-1.7"),
    });

    try {
      await service.generateIndividualEvaluationPdf("sched-1", "pr", ADMIN);
      throw new Error("expected rejection");
    } catch (error) {
      expectAppError(error, 404, /evaluator/i);
    }
  });

  it("uses the real official-record authority for a finalized V2 row", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleBase);
    prismaMock.panelAssignment.findUnique.mockResolvedValue({
      id: "p1",
      scheduleId: "sched-1",
      userId: "u1",
      role: "CHAIRMAN",
      user: { id: "u1", firstName: "Ana", lastName: "Reyes" },
    });
    prismaMock.oralExamScore.findUnique.mockResolvedValue(finalizedV2Score());
    prismaMock.oralExamScore.updateMany.mockResolvedValue({ count: 1 });

    const render = vi.fn().mockResolvedValue(Buffer.from("%PDF-1.7 real-authority"));
    const service = new OfficialDefenseDocumentService({
      records: new OfficialDefenseRecordService(),
      loadLogos: async () => LOGOS,
      render,
    });

    const pdf = await service.generateIndividualEvaluationPdf("sched-1", "p1", ADMIN);

    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
    const input = render.mock.calls[0][0];
    expect(input.groupI).toEqual(["1.00", "1.25", "1.50", "1.75", "2.00"]);
    expect(input.groupII).toEqual(["1.25", "1.50", "1.75", "2.50"]);
    expect(input.groupIAverage).toBe("1.50");
    expect(input.groupIIAverage).toBe("1.75");
    expect(input.recommendations).toBe("Improve the methodology chapter.");
    expect(input.evaluatorPrintedName).toBe("Ana Reyes");
  });

  it("rejects a DRAFT row through the real official-record authority", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleBase);
    prismaMock.panelAssignment.findUnique.mockResolvedValue({
      id: "p1",
      scheduleId: "sched-1",
      userId: "u1",
      role: "PANELIST",
      user: { id: "u1", firstName: "Ana", lastName: "Reyes" },
    });
    prismaMock.oralExamScore.findUnique.mockResolvedValue({
      status: "DRAFT",
      signatureData: null,
      finalizedAt: null,
    });

    const service = new OfficialDefenseDocumentService({
      records: new OfficialDefenseRecordService(),
      loadLogos: async () => LOGOS,
      render: async () => Buffer.from("%PDF-1.7"),
    });

    try {
      await service.generateIndividualEvaluationPdf("sched-1", "p1", ADMIN);
      throw new Error("expected rejection");
    } catch (error) {
      expectAppError(error, 409, /finalized/i);
    }
  });
});

describe("loadOfficialFormLogos", () => {
  it("loads the accepted production logo assets server-side", async () => {
    const logos = await loadOfficialFormLogos();
    expect(logos.earist.mimeType).toBe("image/jpeg");
    expect(logos.graduateSchool.mimeType).toBe("image/jpeg");
    expect(logos.earist.bytes.length).toBeGreaterThan(100);
    expect(logos.graduateSchool.bytes.length).toBeGreaterThan(100);
  });

  it("fails clearly without leaking a filesystem path when assets are missing", async () => {
    const missing = path.resolve(__dirname, "../../../assets/official-forms-does-not-exist");
    try {
      await loadOfficialFormLogos(missing);
      throw new Error("expected rejection");
    } catch (error) {
      expectAppError(error, 500, /assets are unavailable/i);
      expect((error as Error).message).not.toContain(missing);
    }
  });
});
