import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { performance } from "perf_hooks";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  defenseSchedule: { findUnique: vi.fn(), updateMany: vi.fn() },
  panelAssignment: { findFirst: vi.fn() },
  thesisDocument: { findUnique: vi.fn() },
  defenseAnnotation: { findMany: vi.fn() },
  rapReport: { findUnique: vi.fn(), updateMany: vi.fn() },
}));

vi.mock("../../src/config/database", () => ({ default: prismaMock }));

import { DefenseWorkspaceService } from "../../src/services/defense-workspace.service";
import { DefenseCollaborationService } from "../../src/services/defense-collaboration.service";
import { createPrismaDefenseRealtimeStore } from "../../src/realtime/defense-realtime.store";
import { targetsForMountedSchedule } from "../../../frontend/src/lib/realtime/defense-realtime-events";

const tempDirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

function committeeMember(index: number, role: string) {
  return {
    id: `pa-${index}`,
    scheduleId: "sched-1",
    userId: `user-${index}`,
    role,
    user: { id: `user-${index}`, firstName: `First${index}`, lastName: `Last${index}` },
  };
}

function workspaceFixture() {
  const panelAssignments = [
    committeeMember(1, "CHAIRMAN"),
    committeeMember(2, "PANELIST"),
    committeeMember(3, "PANELIST"),
    committeeMember(4, "PANELIST"),
    committeeMember(5, "RAPPORTEUR"),
    committeeMember(6, "ADVISER"),
    committeeMember(7, "FACILITATOR"),
  ];
  const manuscriptDocument = {
    id: "doc-final",
    docType: "FINAL_MANUSCRIPT",
    defenseStage: "FINAL",
    uploadedAt: new Date("2026-10-01T00:00:00Z"),
  };
  return {
    id: "sched-1",
    defenseType: "FINAL_DEFENSE",
    sessionStatus: "IN_PROGRESS",
    defenseDate: new Date("2026-10-20T00:00:00Z"),
    defenseTime: new Date("1970-01-01T09:00:00Z"),
    venueOrLink: "Room 101",
    rapporteurNotes: "Private draft notes",
    rapporteurNotesFinalizedAt: null,
    thesisId: "thesis-1",
    manuscriptDocumentId: manuscriptDocument.id,
    manuscriptDocument,
    thesis: {
      id: "thesis-1",
      student: {
        id: "student-1",
        studentNumber: "2026-0001",
        user: { firstName: "Test", lastName: "Student" },
        program: { programName: "MIT", programType: "MASTERS" },
      },
      thesisTitles: [
        { id: "title-1", titleText: "Synthetic Title One" },
        { id: "title-2", titleText: "Synthetic Title Two" },
        { id: "title-3", titleText: "Synthetic Title Three" },
      ],
      thesisDocuments: Array.from({ length: 5 }, (_, i) => ({
        id: `doc-version-${i + 1}`,
        docType: "FINAL_MANUSCRIPT",
        defenseStage: "FINAL",
        isCurrent: i === 4,
        uploadedAt: new Date(`2026-09-${20 + i}T00:00:00Z`),
        thesisId: "thesis-1",
      })),
      adviserCertifications: [
        {
          defenseStage: "FINAL_DEFENSE",
          reviewedDocumentId: "doc-final",
          status: "ISSUED",
        },
      ],
    },
    panelAssignments,
    oralExamScores: panelAssignments.slice(0, 4).map((pa) => ({
      panelId: pa.id,
      status: "FINALIZED",
    })),
    conclusion: null,
    oralExamSummary: { id: "summary-1" },
    rapReports: [
      {
        status: "FINALIZED",
        signatures: panelAssignments.slice(0, 5).map((pa, i) => ({
          userId: pa.userId,
          roleAtDefense: pa.role,
          required: true,
          isSigned: true,
          signedAt: new Date(`2026-10-02T0${i}:00:00Z`),
          user: { firstName: `First${i}`, lastName: `Last${i}` },
        })),
      },
    ],
  };
}

function annotationRows(annotationCount: number, commentsPerAnnotation: number) {
  return Array.from({ length: annotationCount }, (_, a) => ({
    id: `ann-${a}`,
    scheduleId: "sched-1",
    thesisDocumentId: "doc-final",
    pageNumber: (a % 50) + 1,
    selectedText: `Selected text ${a}`,
    anchorData: {
      rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.02 }],
      prefix: "prefix",
      suffix: "suffix",
    },
    anchorVersion: 1,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    author: committeeMember((a % 2) + 2, "PANELIST"),
    comments: Array.from({ length: commentsPerAnnotation }, (_, c) => ({
      id: `comment-${a}-${c}`,
      annotationId: `ann-${a}`,
      parentCommentId: null,
      body: `Synthetic committee comment ${a}-${c}`,
      createdAt: new Date("2026-10-01T00:00:00Z"),
      updatedAt: new Date("2026-10-01T00:00:00Z"),
      author: committeeMember((c % 3) + 2, c % 3 === 0 ? "RAPPORTEUR" : "PANELIST"),
    })),
  }));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

async function measure<T>(
  fn: () => Promise<T>,
  warmups = 3,
  iterations = 20,
): Promise<{ medianMs: number; minMs: number; maxMs: number; result: T }> {
  let result!: T;
  for (let i = 0; i < warmups; i += 1) result = await fn();
  const times: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    const start = performance.now();
    result = await fn();
    times.push(performance.now() - start);
  }
  return {
    medianMs: median(times),
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
    result,
  };
}

describe("CDW-9D representative performance baseline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.defenseSchedule.updateMany.mockResolvedValue({ count: 0 });
  });

  it("measures workspace and report reads", async () => {
    const fixture = workspaceFixture();
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(fixture);
    prismaMock.panelAssignment.findFirst.mockResolvedValue(fixture.panelAssignments[0]);

    const service = new DefenseWorkspaceService();
    const workspace = await measure(() => service.getWorkspace("sched-1", "user-1"));

    prismaMock.defenseSchedule.findUnique.mockClear();
    prismaMock.panelAssignment.findFirst.mockClear();
    await service.getWorkspace("sched-1", "user-1");

    const workspaceQueries =
      prismaMock.defenseSchedule.findUnique.mock.calls.length +
      prismaMock.panelAssignment.findFirst.mock.calls.length +
      prismaMock.defenseSchedule.updateMany.mock.calls.length;
    const workspacePayloadBytes = Buffer.byteLength(
      JSON.stringify(workspace.result),
      "utf8",
    );

    const collaboration = new DefenseCollaborationService();
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(fixture);
    prismaMock.panelAssignment.findFirst.mockResolvedValue(fixture.panelAssignments[4]);
    const report = await measure(() =>
      collaboration.getReportReadModel("sched-1", "user-5"),
    );
    prismaMock.defenseSchedule.findUnique.mockClear();
    prismaMock.panelAssignment.findFirst.mockClear();
    await collaboration.getReportReadModel("sched-1", "user-5");
    const reportQueries =
      prismaMock.defenseSchedule.findUnique.mock.calls.length +
      prismaMock.panelAssignment.findFirst.mock.calls.length;
    const reportPayloadBytes = Buffer.byteLength(JSON.stringify(report.result), "utf8");

    console.log(
      JSON.stringify({
        metric: "workspace_and_report",
        workspaceQueries,
        workspaceMedianMs: Number(workspace.medianMs.toFixed(3)),
        workspacePayloadBytes,
        reportQueries,
        reportMedianMs: Number(report.medianMs.toFixed(3)),
        reportPayloadBytes,
        rosterRows: fixture.panelAssignments.length,
        evaluatorRows: fixture.oralExamScores.length,
        signatureRows: fixture.rapReports[0].signatures.length,
        documentVersions: fixture.thesis.thesisDocuments.length,
      }),
    );

    expect(workspace.result.roster).toHaveLength(7);
    expect(workspace.result.documents).toHaveLength(1);
    expect(report.result.signatureProgress).toEqual({ required: 5, signed: 5 });
  }, 30_000);

  it("keeps workspace assignment resolution to one aggregate query", async () => {
    const fixture = workspaceFixture();
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(fixture);
    prismaMock.panelAssignment.findFirst.mockResolvedValue(fixture.panelAssignments[0]);

    const service = new DefenseWorkspaceService();
    await service.getWorkspace("sched-1", "user-1");

    expect(prismaMock.defenseSchedule.findUnique).toHaveBeenCalledTimes(1);
    expect(prismaMock.panelAssignment.findFirst).not.toHaveBeenCalled();
  });

  it("keeps committee report assignment resolution to one aggregate query", async () => {
    const fixture = workspaceFixture();
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(fixture);
    prismaMock.panelAssignment.findFirst.mockResolvedValue(fixture.panelAssignments[4]);

    const service = new DefenseCollaborationService();
    await service.getReportReadModel("sched-1", "user-5");

    expect(prismaMock.defenseSchedule.findUnique).toHaveBeenCalledTimes(1);
    expect(prismaMock.panelAssignment.findFirst).not.toHaveBeenCalled();
  });

  it("measures 250-annotation / 750-comment thread loading", async () => {
    const fixture = workspaceFixture();
    const rows = annotationRows(250, 3);
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(fixture);
    prismaMock.panelAssignment.findFirst.mockResolvedValue(fixture.panelAssignments[1]);
    prismaMock.thesisDocument.findUnique.mockResolvedValue({
      id: "doc-final",
      thesisId: "thesis-1",
      docType: "FINAL_MANUSCRIPT",
      defenseStage: "FINAL",
    });
    prismaMock.defenseAnnotation.findMany.mockResolvedValue(rows);

    const service = new DefenseCollaborationService();
    const live = await measure(
      () => service.listAnnotations("sched-1", "user-2", "doc-final"),
      2,
      10,
    );

    prismaMock.defenseSchedule.findUnique.mockClear();
    prismaMock.panelAssignment.findFirst.mockClear();
    prismaMock.thesisDocument.findUnique.mockClear();
    prismaMock.defenseAnnotation.findMany.mockClear();
    await service.listAnnotations("sched-1", "user-2", "doc-final");
    const liveQueries =
      prismaMock.defenseSchedule.findUnique.mock.calls.length +
      prismaMock.panelAssignment.findFirst.mock.calls.length +
      prismaMock.thesisDocument.findUnique.mock.calls.length +
      prismaMock.defenseAnnotation.findMany.mock.calls.length;

    const history = await measure(
      () => service.listAttemptAnnotationsForHistory("sched-1", "doc-final"),
      2,
      10,
    );

    prismaMock.defenseAnnotation.findMany.mockClear();
    await service.listAttemptAnnotationsForHistory("sched-1", "doc-final");
    const historyQueries = prismaMock.defenseAnnotation.findMany.mock.calls.length;
    const payloadBytes = Buffer.byteLength(JSON.stringify(live.result), "utf8");

    console.log(
      JSON.stringify({
        metric: "annotations",
        annotations: rows.length,
        comments: rows.reduce((sum, row) => sum + row.comments.length, 0),
        liveQueries,
        liveMedianMs: Number(live.medianMs.toFixed(3)),
        historyQueries,
        historyMedianMs: Number(history.medianMs.toFixed(3)),
        payloadBytes,
        payloadKiB: Number((payloadBytes / 1024).toFixed(2)),
      }),
    );

    expect(live.result).toHaveLength(250);
    expect(live.result.reduce((sum, row) => sum + row.comments.length, 0)).toBe(750);
    expect(historyQueries).toBe(1);
  }, 30_000);

  it("measures local large-manuscript transfer cost", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cdw9d-pdf-"));
    tempDirs.push(dir);
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    for (let pageIndex = 0; pageIndex < 250; pageIndex += 1) {
      const page = pdf.addPage([612, 792]);
      for (let line = 0; line < 40; line += 1) {
        page.drawText(
          `Synthetic manuscript page ${pageIndex + 1} line ${line + 1} - controlled performance fixture`,
          { x: 40, y: 740 - line * 17, size: 9, font },
        );
      }
    }
    // Model a media-rich manuscript with a large transfer payload while keeping
    // the generated fixture out of the repository.
    await pdf.attach(randomBytes(10 * 1024 * 1024), "synthetic-appendix.bin", {
      mimeType: "application/octet-stream",
      description: "Synthetic large-file transfer payload",
    });
    const bytes = await pdf.save();
    const filePath = path.join(dir, "synthetic-250-page.pdf");
    await fs.writeFile(filePath, bytes);
    const stat = await fs.stat(filePath);
    const read = await measure(() => fs.readFile(filePath), 2, 10);

    console.log(
      JSON.stringify({
        metric: "manuscript_transfer",
        pages: pdf.getPageCount(),
        fileBytes: stat.size,
        fileMiB: Number((stat.size / (1024 * 1024)).toFixed(2)),
        readMedianMs: Number(read.medianMs.toFixed(3)),
        readMiBPerSecond: Number(
          (stat.size / (1024 * 1024) / (read.medianMs / 1000)).toFixed(2),
        ),
      }),
    );

    expect(pdf.getPageCount()).toBe(250);
    expect(stat.size).toBeGreaterThan(0);
  }, 30_000);

  it("measures realtime invalidation and polling query amplification", async () => {
    const targets = [
      "defense.started",
      "annotation.created",
      "annotation.comment.created",
      "report.draft.updated",
      "evaluation.finalized",
      "report.ready_for_signature",
      "rap.signature.recorded",
      "rap.finalized",
      "defense.concluded",
    ] as const;
    const invalidationCounts = Object.fromEntries(
      targets.map((eventName) => {
        const event = {
          eventName,
          eventId: "event-1",
          scheduleId: "sched-1",
          occurredAt: "2026-10-19T00:00:00Z",
          ...(eventName.startsWith("annotation.") ? { thesisDocumentId: "doc-final" } : {}),
          ...(eventName === "report.draft.updated" ? { reportId: "rap-1", bodyVersion: 1 } : {}),
          ...(["report.ready_for_signature", "rap.signature.recorded", "rap.finalized"].includes(eventName)
            ? { reportId: "rap-1", contentVersion: 1 }
            : {}),
          ...(eventName === "defense.started" ? { sessionStatus: "IN_PROGRESS" } : {}),
          ...(eventName === "defense.concluded" ? { sessionStatus: "CONCLUDED" } : {}),
        } as never;
        return [
          eventName,
          targetsForMountedSchedule(event, "sched-1").length,
        ];
      }),
    );

    const participants = 5;
    const workspacePollsPerMinute = participants * (60 / 20);
    const annotationPollsPerMinute = participants * (60 / 15);

    console.log(
      JSON.stringify({
        metric: "realtime_polling_model",
        participants,
        workspacePollsPerMinute,
        annotationPollsPerMinute,
        invalidationCounts,
        workspaceQueriesPerMinute: workspacePollsPerMinute,
        annotationQueriesPerMinute: annotationPollsPerMinute * 4,
      }),
    );

    const storeReads = {
      status: vi.fn().mockResolvedValue("IN_PROGRESS"),
      assignment: vi.fn().mockResolvedValue({ id: "pa-1" }),
      assignments: vi.fn().mockResolvedValue([{ userId: "user-1" }]),
    };
    const store = createPrismaDefenseRealtimeStore({
      defenseSchedule: { findUnique: storeReads.status },
      panelAssignment: {
        findFirst: storeReads.assignment,
        findMany: storeReads.assignments,
      },
    } as never);
    await store.getSessionStatus("sched-1");
    await store.hasPanelAssignment("sched-1", "user-1");
    await store.listAssignedUserIds("sched-1", ["user-1"]);

    expect(storeReads.status).toHaveBeenCalledTimes(1);
    expect(storeReads.assignment).toHaveBeenCalledTimes(1);
    expect(storeReads.assignments).toHaveBeenCalledTimes(1);
    expect(Object.keys(invalidationCounts)).toHaveLength(9);
  });
});
