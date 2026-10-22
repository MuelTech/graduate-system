import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  defenseSchedule: { findUnique: vi.fn() },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { AppError } from "../../../src/utils/AppError";
import { OfficialDefenseRecordService } from "../../../src/services/official-defense-record.service";
import {
  OfficialDefenseDocumentService,
  mapDefenseApplicationToRenderInput,
} from "../../../src/services/official-defense-document.service";
import type { OfficialDefenseApplicationDocumentSource } from "../../../src/services/official-defense-record.service";

const ADMIN = { userId: "admin-1", role: "ADMIN" };
const LOGOS = {
  earist: { bytes: new Uint8Array([1, 2, 3]), mimeType: "image/jpeg" as const },
  graduateSchool: { bytes: new Uint8Array([4, 5, 6]), mimeType: "image/jpeg" as const },
};

interface Seat {
  panelAssignmentId: string;
  userId: string;
  role: string;
  name: string;
  createdAt: string;
}

function seat(role: string, name: string, createdAt: string, id: string): Seat {
  return {
    panelAssignmentId: id,
    userId: `user-${id}`,
    role,
    name,
    createdAt,
  };
}

/** Committee built from the expected accepted policy matrix (assertions only). */
function committeeFor(programType: string, defenseType: string): Seat[] {
  const isDoctoral = programType === "DOCTORAL";
  const isTitle = defenseType === "TITLE_DEFENSE";
  const panelistCount = isTitle ? (isDoctoral ? 5 : 4) : isDoctoral ? 4 : 3;

  const seats: Seat[] = [
    seat("FACILITATOR", "Facilitator One", "2026-09-01T08:00:00.000Z", "fac"),
    seat("RAPPORTEUR", "Rapporteur One", "2026-09-01T08:05:00.000Z", "rap"),
  ];
  for (let i = 1; i <= panelistCount; i += 1) {
    seats.push(
      seat(
        "PANELIST",
        `Panelist ${i}`,
        `2026-09-01T09:0${i}:00.000Z`,
        `panel-${i}`,
      ),
    );
  }
  // Chairman deliberately created after the Panelists: selection must be by role.
  seats.push(seat("CHAIRMAN", "Chair One", "2026-09-01T09:59:00.000Z", "chair"));
  if (!isTitle) {
    seats.push(seat("ADVISER", "Adviser One", "2026-09-01T08:30:00.000Z", "adv"));
  }
  return seats;
}

function source(
  overrides: Partial<OfficialDefenseApplicationDocumentSource> = {},
): OfficialDefenseApplicationDocumentSource {
  const programType = overrides.programType ?? "MASTERS";
  const defenseType = overrides.defenseType ?? "PROPOSAL_DEFENSE";
  return {
    scheduleId: "sched-1",
    defenseType,
    defenseDate: "2026-09-28T00:00:00.000Z",
    defenseTime: "1970-01-01T13:30:00.000Z",
    venueOrLink: "Room 101, GS Building",
    studentName: "Juan Dela Cruz",
    studentNumber: "2026-001",
    cellphone: "09171234567",
    programName: "Master of Information Technology",
    programType,
    assignments: committeeFor(programType, defenseType),
    ...overrides,
  };
}

function expectAppError(error: unknown, statusCode: number, message: RegExp): void {
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).statusCode).toBe(statusCode);
  expect((error as AppError).message).toMatch(message);
}

function expectMappingError(
  input: OfficialDefenseApplicationDocumentSource,
  statusCode: number,
  message: RegExp,
): void {
  try {
    mapDefenseApplicationToRenderInput(input, LOGOS);
    throw new Error("expected rejection");
  } catch (error) {
    expectAppError(error, statusCode, message);
  }
}

describe("mapDefenseApplicationToRenderInput — accepted policy matrix", () => {
  const combinations = [
    {
      programType: "MASTERS",
      defenseType: "TITLE_DEFENSE",
      variant: "masters",
      applicationType: "title",
      printedPanelists: 5,
      hasAdviser: false,
    },
    {
      programType: "MASTERS",
      defenseType: "PROPOSAL_DEFENSE",
      variant: "masters",
      applicationType: "proposal",
      printedPanelists: 4,
      hasAdviser: true,
    },
    {
      programType: "MASTERS",
      defenseType: "FINAL_DEFENSE",
      variant: "masters",
      applicationType: "final",
      printedPanelists: 4,
      hasAdviser: true,
    },
    {
      programType: "DOCTORAL",
      defenseType: "TITLE_DEFENSE",
      variant: "doctoral",
      applicationType: "title",
      printedPanelists: 6,
      hasAdviser: false,
    },
    {
      programType: "DOCTORAL",
      defenseType: "PROPOSAL_DEFENSE",
      variant: "doctoral",
      applicationType: "proposal",
      printedPanelists: 5,
      hasAdviser: true,
    },
    {
      programType: "DOCTORAL",
      defenseType: "FINAL_DEFENSE",
      variant: "doctoral",
      applicationType: "final",
      printedPanelists: 5,
      hasAdviser: true,
    },
  ] as const;

  it.each(combinations)(
    "$programType $defenseType -> $variant / $applicationType",
    ({ programType, defenseType, variant, applicationType, printedPanelists, hasAdviser }) => {
      const input = mapDefenseApplicationToRenderInput(
        source({ programType, defenseType }),
        LOGOS,
      );

      expect(input.variant).toBe(variant);
      expect(input.applicationType).toBe(applicationType);
      expect(input.committee.panelistNames).toHaveLength(printedPanelists);
      expect(input.committee.panelistNames[0]).toBe("Chair One");
      expect(input.committee.adviserName ?? "").toBe(hasAdviser ? "Adviser One" : "");
      expect(input.committee.facilitatorName).toBe("Facilitator One");
      expect(input.committee.rapporteurName).toBe("Rapporteur One");
    },
  );
});

describe("mapDefenseApplicationToRenderInput — identity and display mapping", () => {
  it("uses the exact schedule student identity and program name without inferred major", () => {
    const input = mapDefenseApplicationToRenderInput(source(), LOGOS);
    expect(input.studentName).toBe("Juan Dela Cruz");
    expect(input.courseAndMajor).toBe("Master of Information Technology");
    expect(input.studentNumber).toBe("2026-001");
    expect(input.cellphoneNumber).toBe("09171234567");
  });

  it("keeps nullable student number and cellphone blank", () => {
    const input = mapDefenseApplicationToRenderInput(
      source({ studentNumber: null, cellphone: null }),
      LOGOS,
    );
    expect(input.studentNumber).toBe("");
    expect(input.cellphoneNumber).toBe("");
  });

  it("keeps every currently unavailable field blank", () => {
    const input = mapDefenseApplicationToRenderInput(
      // Even if a live email-style value is present in the source, it is not mapped.
      { ...source(), userEmail: "student@gmail.com" } as OfficialDefenseApplicationDocumentSource,
      LOGOS,
    );
    expect(input.applicantDateAndTime).toBe("");
    expect(input.amountPaid).toBe("");
    expect(input.officialReceiptNumber).toBe("");
    expect(input.dateOfApplication).toBe("");
    expect(input.personalGmail).toBe("");
    expect(input.deanName).toBe("");
    expect(input.vicePresidentName).toBe("");
    expect(input.presidentName).toBe("");
  });

  it("formats the exact defense date", () => {
    const input = mapDefenseApplicationToRenderInput(source(), LOGOS);
    expect(input.defenseDate).toBe("28 September 2026");
  });

  it("preserves wall-clock defense time without timezone conversion", () => {
    const afternoon = mapDefenseApplicationToRenderInput(
      source({ defenseTime: "1970-01-01T13:30:00.000Z" }),
      LOGOS,
    );
    expect(afternoon.defenseTime).toBe("1:30 PM");

    const morning = mapDefenseApplicationToRenderInput(
      source({ defenseTime: "1970-01-01T10:00:00.000Z" }),
      LOGOS,
    );
    expect(morning.defenseTime).toBe("10:00 AM");

    const midnight = mapDefenseApplicationToRenderInput(
      source({ defenseTime: "1970-01-01T00:15:00.000Z" }),
      LOGOS,
    );
    expect(midnight.defenseTime).toBe("12:15 AM");
  });

  it("passes venueOrLink as exact display text without URL transformation", () => {
    const physical = mapDefenseApplicationToRenderInput(
      source({ venueOrLink: "Room 101, GS Building" }),
      LOGOS,
    );
    expect(physical.defenseLink).toBe("Room 101, GS Building");

    const url = mapDefenseApplicationToRenderInput(
      source({ venueOrLink: "https://meet.example.com/abc-def" }),
      LOGOS,
    );
    expect(url.defenseLink).toBe("https://meet.example.com/abc-def");

    const blank = mapDefenseApplicationToRenderInput(
      source({ venueOrLink: null }),
      LOGOS,
    );
    expect(blank.defenseLink).toBe("");
  });

  it("selects Chairman explicitly by role and prints it first", () => {
    const input = mapDefenseApplicationToRenderInput(source(), LOGOS);
    expect(input.committee.panelistNames[0]).toBe("Chair One");
    expect(input.committee.panelistNames).toEqual([
      "Chair One",
      "Panelist 1",
      "Panelist 2",
      "Panelist 3",
    ]);
  });

  it("orders Panelists by createdAt then id regardless of raw assignment order", () => {
    const assignments = committeeFor("DOCTORAL", "TITLE_DEFENSE");
    const scrambled = [
      ...assignments.filter((a) => a.role === "CHAIRMAN"),
      ...assignments.filter((a) => a.role === "PANELIST").reverse(),
      ...assignments.filter((a) => a.role === "RAPPORTEUR"),
      ...assignments.filter((a) => a.role === "FACILITATOR"),
    ];
    const input = mapDefenseApplicationToRenderInput(
      source({
        programType: "DOCTORAL",
        defenseType: "TITLE_DEFENSE",
        assignments: scrambled,
      }),
      LOGOS,
    );
    expect(input.committee.panelistNames).toEqual([
      "Chair One",
      "Panelist 1",
      "Panelist 2",
      "Panelist 3",
      "Panelist 4",
      "Panelist 5",
    ]);
  });

  it("breaks createdAt ties by id ascending", () => {
    const same = "2026-09-01T09:10:00.000Z";
    const base = committeeFor("MASTERS", "PROPOSAL_DEFENSE").filter(
      (a) => a.role !== "PANELIST",
    );
    const ties = [
      ...base,
      seat("PANELIST", "Panel B", same, "b"),
      seat("PANELIST", "Panel A", same, "a"),
      seat("PANELIST", "Panel C", same, "c"),
    ];
    const input = mapDefenseApplicationToRenderInput(
      source({ assignments: ties }),
      LOGOS,
    );
    expect(input.committee.panelistNames.slice(1)).toEqual([
      "Panel A",
      "Panel B",
      "Panel C",
    ]);
  });

  it("embeds no signature evidence or approval identity", () => {
    const input = mapDefenseApplicationToRenderInput(source(), LOGOS);
    expect(input).not.toHaveProperty("signatureData");
    expect(JSON.stringify(input)).not.toContain("data:image");
    expect(input.deanName).toBe("");
    expect(input.vicePresidentName).toBe("");
    expect(input.presidentName).toBe("");
  });
});

describe("mapDefenseApplicationToRenderInput — fail-closed validation", () => {
  it("rejects unsupported program types instead of guessing from the name", () => {
    expectMappingError(
      source({ programType: "UNKNOWN", programName: "PhD in Education" }),
      422,
      /program type/i,
    );
  });

  it("rejects unsupported defense types", () => {
    expectMappingError(
      source({ defenseType: "COMPREHENSIVE_EXAM" }),
      422,
      /defense type/i,
    );
  });

  it("rejects missing student/program context", () => {
    expectMappingError(source({ studentName: null }), 422, /student/i);
    expectMappingError(source({ programName: null }), 422, /program/i);
  });

  it("rejects an Adviser seat on Title Defense", () => {
    const assignments = [
      ...committeeFor("MASTERS", "TITLE_DEFENSE"),
      seat("ADVISER", "Adviser One", "2026-09-01T08:30:00.000Z", "adv"),
    ];
    expectMappingError(
      source({ defenseType: "TITLE_DEFENSE", assignments }),
      409,
      /adviser/i,
    );
  });

  it("rejects a missing or duplicate Proposal/Final Adviser", () => {
    const missing = committeeFor("MASTERS", "PROPOSAL_DEFENSE").filter(
      (a) => a.role !== "ADVISER",
    );
    expectMappingError(
      source({ defenseType: "PROPOSAL_DEFENSE", assignments: missing }),
      409,
      /adviser/i,
    );

    const duplicated = [
      ...committeeFor("MASTERS", "FINAL_DEFENSE"),
      seat("ADVISER", "Adviser Two", "2026-09-01T08:31:00.000Z", "adv-2"),
    ];
    expectMappingError(
      source({ defenseType: "FINAL_DEFENSE", assignments: duplicated }),
      409,
      /adviser/i,
    );
  });

  it("rejects a missing or duplicate Chairman", () => {
    const missing = committeeFor("MASTERS", "PROPOSAL_DEFENSE").filter(
      (a) => a.role !== "CHAIRMAN",
    );
    expectMappingError(source({ assignments: missing }), 409, /chairman/i);

    const duplicated = [
      ...committeeFor("MASTERS", "PROPOSAL_DEFENSE"),
      seat("CHAIRMAN", "Chair Two", "2026-09-01T09:58:00.000Z", "chair-2"),
    ];
    expectMappingError(source({ assignments: duplicated }), 409, /chairman/i);
  });

  it("rejects a wrong Panelist count instead of truncating or padding", () => {
    const missing = committeeFor("MASTERS", "PROPOSAL_DEFENSE").filter(
      (a) => a.panelAssignmentId !== "panel-3",
    );
    expectMappingError(source({ assignments: missing }), 409, /panelist/i);
  });

  it("rejects a missing or duplicate Facilitator", () => {
    const missing = committeeFor("MASTERS", "PROPOSAL_DEFENSE").filter(
      (a) => a.role !== "FACILITATOR",
    );
    expectMappingError(source({ assignments: missing }), 409, /facilitator/i);

    const duplicated = [
      ...committeeFor("MASTERS", "PROPOSAL_DEFENSE"),
      seat("FACILITATOR", "Facilitator Two", "2026-09-01T08:01:00.000Z", "fac-2"),
    ];
    expectMappingError(source({ assignments: duplicated }), 409, /facilitator/i);
  });

  it("rejects a missing or duplicate Rapporteur", () => {
    const missing = committeeFor("MASTERS", "PROPOSAL_DEFENSE").filter(
      (a) => a.role !== "RAPPORTEUR",
    );
    expectMappingError(source({ assignments: missing }), 409, /rapporteur/i);

    const duplicated = [
      ...committeeFor("MASTERS", "PROPOSAL_DEFENSE"),
      seat("RAPPORTEUR", "Rapporteur Two", "2026-09-01T08:06:00.000Z", "rap-2"),
    ];
    expectMappingError(source({ assignments: duplicated }), 409, /rapporteur/i);
  });

  it("rejects a duplicate user across committee seats", () => {
    const assignments = committeeFor("MASTERS", "PROPOSAL_DEFENSE").map((a) =>
      a.role === "ADVISER" ? { ...a, userId: "user-chair" } : a,
    );
    expectMappingError(source({ assignments }), 409, /same user|cannot/i);
  });

  it("rejects a required seat with a blank printable name", () => {
    const assignments = committeeFor("MASTERS", "PROPOSAL_DEFENSE").map((a) =>
      a.role === "PANELIST" && a.panelAssignmentId === "panel-1"
        ? { ...a, name: "   " }
        : a,
    );
    expectMappingError(source({ assignments }), 409, /name/i);
  });

  it("rejects missing or invalid schedule date/time", () => {
    expectMappingError(source({ defenseDate: null as never }), 422, /date/i);
    expectMappingError(source({ defenseTime: null as never }), 422, /time/i);
  });
});

describe("OfficialDefenseDocumentService.generateDefenseApplicationPdf", () => {
  beforeEach(() => vi.clearAllMocks());

  function makeService(input: OfficialDefenseApplicationDocumentSource = source()) {
    const getOfficialDefenseApplicationDocumentSource = vi
      .fn()
      .mockResolvedValue(input);
    const renderApplication = vi.fn().mockResolvedValue(Buffer.from("%PDF-1.7 app"));
    const service = new OfficialDefenseDocumentService({
      records: {
        getOfficialCriteria: vi.fn(),
        getOfficialSummaryDocumentSource: vi.fn(),
        getOfficialDefenseApplicationDocumentSource,
      },
      loadLogos: async () => LOGOS,
      renderApplication,
    });
    return { service, getOfficialDefenseApplicationDocumentSource, renderApplication };
  }

  it("generates for an ADMIN using the exact scheduleId", async () => {
    const { service, getOfficialDefenseApplicationDocumentSource, renderApplication } =
      makeService();

    const pdf = await service.generateDefenseApplicationPdf("sched-1", ADMIN);

    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
    expect(getOfficialDefenseApplicationDocumentSource).toHaveBeenCalledWith(
      "sched-1",
      ADMIN,
    );
    expect(renderApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "masters",
        applicationType: "proposal",
        studentName: "Juan Dela Cruz",
      }),
    );
  });

  it("rejects non-Admin actors before reading the protected source", async () => {
    const { service, getOfficialDefenseApplicationDocumentSource } = makeService();
    for (const actor of [
      { userId: "u1", role: "PANELIST" },
      { userId: "s1", role: "STUDENT" },
    ]) {
      try {
        await service.generateDefenseApplicationPdf("sched-1", actor);
        throw new Error("expected rejection");
      } catch (error) {
        expectAppError(error, 403, /admin/i);
      }
    }
    expect(getOfficialDefenseApplicationDocumentSource).not.toHaveBeenCalled();
  });

  it("maps renderer overflow to a controlled 422", async () => {
    const service = new OfficialDefenseDocumentService({
      records: {
        getOfficialCriteria: vi.fn(),
        getOfficialSummaryDocumentSource: vi.fn(),
        getOfficialDefenseApplicationDocumentSource: vi
          .fn()
          .mockResolvedValue(source()),
      },
      loadLogos: async () => LOGOS,
      renderApplication: async () => {
        throw new RangeError("Too long");
      },
    });
    try {
      await service.generateDefenseApplicationPdf("sched-1", ADMIN);
      throw new Error("expected rejection");
    } catch (error) {
      expectAppError(error, 422, /cannot/i);
    }
  });

  it("renders realistic physical venues and meeting URLs through the production path", async () => {
    const links = [
      "Room 101, GS Building",
      "Graduate School Conference Room, Nudas Building",
      "https://meet.google.com/abc-defg-hij",
      "https://teams.microsoft.com/l/meetup-join/19%3ameeting_MTc0ZjQ2YjItOWQ4ZS00N2M5LThhYjgtZjY0ZTk2N2Q4YjIx%40thread.v2/0?context=%7b%22Tid%22%3a%228b3f5c2a-1d4e-4f6a-9c7b-2e1d0a9f8c6b%22%2c%22Oid%22%3a%224c2e6f1a-7b3d-4a8e-9f5c-1d2b3a4c5d6e%22%7d",
    ];
    for (const link of links) {
      const service = new OfficialDefenseDocumentService({
        records: {
          getOfficialCriteria: vi.fn(),
          getOfficialSummaryDocumentSource: vi.fn(),
          getOfficialDefenseApplicationDocumentSource: vi
            .fn()
            .mockResolvedValue(source({ venueOrLink: link })),
        },
      });
      const pdf = await service.generateDefenseApplicationPdf("sched-1", ADMIN);
      expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
      expect(pdf.length).toBeGreaterThan(1000);
    }
  });

  it("produces real TEMPLATE-3 PDFs for a Master's and a Doctoral fixture", async () => {
    for (const [programType, defenseType] of [
      ["MASTERS", "TITLE_DEFENSE"],
      ["DOCTORAL", "PROPOSAL_DEFENSE"],
    ] as const) {
      const service = new OfficialDefenseDocumentService({
        records: {
          getOfficialCriteria: vi.fn(),
          getOfficialSummaryDocumentSource: vi.fn(),
          getOfficialDefenseApplicationDocumentSource: vi
            .fn()
            .mockResolvedValue(source({ programType, defenseType })),
        },
      });
      const pdf = await service.generateDefenseApplicationPdf("sched-1", ADMIN);
      expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
      expect(pdf.length).toBeGreaterThan(1000);
    }
  });
});

describe("OfficialDefenseRecordService.getOfficialDefenseApplicationDocumentSource", () => {
  const records = new OfficialDefenseRecordService();

  const scheduleRow = {
    id: "sched-1",
    defenseType: "PROPOSAL_DEFENSE",
    defenseDate: new Date("2026-09-28T00:00:00.000Z"),
    defenseTime: new Date("1970-01-01T13:30:00.000Z"),
    venueOrLink: "Room 101",
    thesis: {
      student: {
        studentNumber: "2026-001",
        cellphone: "09171234567",
        user: { firstName: "Juan", lastName: "Dela Cruz", email: "student@gmail.com" },
        program: {
          programName: "Master of Information Technology",
          programType: "MASTERS",
        },
      },
    },
    panelAssignments: committeeFor("MASTERS", "PROPOSAL_DEFENSE").map((a) => ({
      id: a.panelAssignmentId,
      userId: a.userId,
      role: a.role,
      createdAt: new Date(a.createdAt),
      user: {
        id: a.userId,
        firstName: a.name.split(" ")[0],
        lastName: a.name.split(" ").slice(1).join(" "),
      },
    })),
  };

  beforeEach(() => vi.clearAllMocks());

  it("rejects non-Admin actors before reading the schedule", async () => {
    try {
      await records.getOfficialDefenseApplicationDocumentSource("sched-1", {
        userId: "u1",
        role: "PANELIST",
      });
      throw new Error("expected rejection");
    } catch (error) {
      expectAppError(error, 403, /admin/i);
    }
    expect(prismaMock.defenseSchedule.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a missing exact schedule", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(null);
    try {
      await records.getOfficialDefenseApplicationDocumentSource("sched-404", ADMIN);
      throw new Error("expected rejection");
    } catch (error) {
      expectAppError(error, 404, /Defense session not found/i);
    }
    expect(prismaMock.defenseSchedule.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "sched-404" } }),
    );
  });

  it("reads the exact schedule with student/program and does not select email", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleRow);

    const result = await records.getOfficialDefenseApplicationDocumentSource(
      "sched-1",
      ADMIN,
    );

    expect(result.scheduleId).toBe("sched-1");
    expect(result.studentName).toBe("Juan Dela Cruz");
    expect(result.studentNumber).toBe("2026-001");
    expect(result.cellphone).toBe("09171234567");
    expect(result.programName).toBe("Master of Information Technology");
    expect(result.programType).toBe("MASTERS");
    expect(result.defenseDate).toBe("2026-09-28T00:00:00.000Z");
    expect(result.defenseTime).toBe("1970-01-01T13:30:00.000Z");
    expect(result.assignments).toHaveLength(7);

    const call = prismaMock.defenseSchedule.findUnique.mock.calls[0][0];
    const studentSelect = call.include.thesis.include.student.select;
    expect(studentSelect).toBeUndefined(); // uses include, not select
    const userSelect = call.include.thesis.include.student.include.user.select;
    expect(userSelect).toEqual({ firstName: true, lastName: true });
    expect(userSelect).not.toHaveProperty("email");
    expect(call.include.panelAssignments.orderBy).toEqual([
      { createdAt: "asc" },
      { id: "asc" },
    ]);
  });

  it("maps the real source through the document service without using email", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleRow);
    const renderApplication = vi.fn().mockResolvedValue(Buffer.from("%PDF-1.7"));
    const service = new OfficialDefenseDocumentService({
      records: new OfficialDefenseRecordService(),
      loadLogos: async () => LOGOS,
      renderApplication,
    });

    await service.generateDefenseApplicationPdf("sched-1", ADMIN);

    const input = renderApplication.mock.calls[0][0];
    expect(input.personalGmail).toBe("");
    expect(input.studentName).toBe("Juan Dela Cruz");
    expect(input.courseAndMajor).toBe("Master of Information Technology");
    expect(input.committee.panelistNames).toHaveLength(4);
    expect(input.committee.panelistNames[0]).toBe("Chair One");
  });

  it("fails closed when student/program context is absent", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue({
      ...scheduleRow,
      thesis: { student: null },
    });
    const service = new OfficialDefenseDocumentService({
      records: new OfficialDefenseRecordService(),
      loadLogos: async () => LOGOS,
      renderApplication: async () => Buffer.from("%PDF-1.7"),
    });
    try {
      await service.generateDefenseApplicationPdf("sched-1", ADMIN);
      throw new Error("expected rejection");
    } catch (error) {
      expectAppError(error, 422, /student|program/i);
    }
  });
});
