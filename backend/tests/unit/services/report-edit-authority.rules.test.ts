import { describe, expect, it } from "vitest";

import {
  FROZEN_REPORT_STATUSES,
  isCollaborationWritableStatus,
  isReportBodyEditable,
} from "../../../src/services/report-edit-authority.rules";

describe("report-edit-authority.rules", () => {
  it.each(["SCHEDULED", "IN_PROGRESS", "AWAITING_CONCLUSION"])(
    "allows the assigned Rapporteur to edit an unfrozen DRAFT while %s",
    (sessionStatus) => {
      expect(
        isReportBodyEditable({
          sessionStatus,
          role: "RAPPORTEUR",
          rapStatus: "DRAFT",
          rapFrozenAt: null,
        }),
      ).toBe(true);
    },
  );

  it("allows the assigned Rapporteur to begin before a report exists", () => {
    expect(
      isReportBodyEditable({
        sessionStatus: "IN_PROGRESS",
        role: "RAPPORTEUR",
        rapStatus: null,
        rapFrozenAt: null,
      }),
    ).toBe(true);
  });

  it.each(["CHAIRMAN", "PANELIST", "ADVISER", "FACILITATOR", "STUDENT", "ADMIN"])(
    "rejects report editing for %s even with a broad account role",
    (role) => {
      expect(
        isReportBodyEditable({
          sessionStatus: "IN_PROGRESS",
          role,
          rapStatus: "DRAFT",
          rapFrozenAt: null,
        }),
      ).toBe(false);
    },
  );

  it.each(["CONCLUDED", "CANCELLED", "UNSCHEDULED", ""])(
    "rejects editing while the session is %s",
    (sessionStatus) => {
      expect(
        isReportBodyEditable({
          sessionStatus,
          role: "RAPPORTEUR",
          rapStatus: "DRAFT",
          rapFrozenAt: null,
        }),
      ).toBe(false);
    },
  );

  it.each(FROZEN_REPORT_STATUSES)("rejects editing when the report is %s", (status) => {
    expect(
      isReportBodyEditable({
        sessionStatus: "AWAITING_CONCLUSION",
        role: "RAPPORTEUR",
        rapStatus: status,
        rapFrozenAt: null,
      }),
    ).toBe(false);
  });

  it("rejects editing when the report carries a frozenAt timestamp", () => {
    expect(
      isReportBodyEditable({
        sessionStatus: "IN_PROGRESS",
        role: "RAPPORTEUR",
        rapStatus: "DRAFT",
        rapFrozenAt: new Date("2026-10-17T00:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("only reports active collaboration statuses as writable", () => {
    expect(["SCHEDULED", "IN_PROGRESS", "AWAITING_CONCLUSION"].every(isCollaborationWritableStatus)).toBe(
      true,
    );
    expect(["CONCLUDED", "CANCELLED", "UNSCHEDULED"].some(isCollaborationWritableStatus)).toBe(
      false,
    );
  });
});
