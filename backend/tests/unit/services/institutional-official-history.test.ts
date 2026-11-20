import { beforeEach, describe, expect, it, vi } from "vitest";
import { STUDENT_SIGNATURE } from "../../fixtures/adviser-request-signed";
import {
  INSTITUTIONAL_OFFICIALS_SETTING_KEY,
  listInstitutionalOfficialHistory,
  loadInstitutionalOfficialsAsOf,
  previousCalendarDayIso,
  recordInstitutionalOfficialTransition,
  resolveOfficialTermForDate,
  type OfficialTermRecord,
} from "../../../src/services/institutional-officials.service";

describe("Phase 3 — Institutional Officials Office-Holder History", () => {
  describe("resolveOfficialTermForDate", () => {
    const deanTerms: OfficialTermRecord[] = [
      {
        id: "t-1",
        role: "DEAN",
        name: "Dr. Former Dean",
        signatureData: "sig-old",
        effectiveFrom: new Date("2024-01-01T00:00:00Z"),
        effectiveTo: new Date("2026-05-31T00:00:00Z"),
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-01T00:00:00Z"),
      },
      {
        id: "t-2",
        role: "DEAN",
        name: "Dr. Current Dean",
        signatureData: "sig-new",
        effectiveFrom: new Date("2026-06-01T00:00:00Z"),
        effectiveTo: null,
        createdAt: new Date("2026-06-01T00:00:00Z"),
        updatedAt: new Date("2026-06-01T00:00:00Z"),
      },
    ];

    it("resolves the prior office holder for dates inside the closed term", () => {
      const matched = resolveOfficialTermForDate(deanTerms, "2026-05-31");
      expect(matched?.id).toBe("t-1");
      expect(matched?.name).toBe("Dr. Former Dean");
    });

    it("resolves the new office holder on and after the transition effectiveFrom date", () => {
      expect(resolveOfficialTermForDate(deanTerms, "2026-06-01")?.id).toBe("t-2");
      expect(resolveOfficialTermForDate(deanTerms, "2026-11-21")?.id).toBe("t-2");
    });

    it("falls back to the earliest recorded term for records predating term tracking", () => {
      const matched = resolveOfficialTermForDate(deanTerms, "2022-03-15");
      expect(matched?.id).toBe("t-1");
    });

    it("resolves the open active term when asOfDate is omitted", () => {
      expect(resolveOfficialTermForDate(deanTerms, null)?.id).toBe("t-2");
      expect(resolveOfficialTermForDate(deanTerms)?.id).toBe("t-2");
    });
  });

  describe("previousCalendarDayIso", () => {
    it("handles month and leap-year boundaries accurately", () => {
      expect(previousCalendarDayIso("2026-06-01")).toBe("2026-05-31");
      expect(previousCalendarDayIso("2024-03-01")).toBe("2024-02-29");
      expect(previousCalendarDayIso("2026-01-01")).toBe("2025-12-31");
    });
  });

  describe("loadInstitutionalOfficialsAsOf & recordInstitutionalOfficialTransition", () => {
    let storedSetting: string | null = null;
    let terms: Array<{
      id: string;
      role: "DEAN" | "VPAA" | "PRESIDENT";
      name: string;
      signatureData: string | null;
      effectiveFrom: Date;
      effectiveTo: Date | null;
      createdById: string | null;
      updatedById: string | null;
      createdAt: Date;
      updatedAt: Date;
    }> = [];
    let auditLogs: Array<Record<string, unknown>> = [];
    let idSeq = 1;

    const dbMock = {
      systemSetting: {
        findUnique: vi.fn(async () =>
          storedSetting ? { settingValue: storedSetting } : null,
        ),
        upsert: vi.fn(async ({ update, create }: any) => {
          storedSetting = update?.settingValue ?? create?.settingValue ?? null;
          return { settingKey: INSTITUTIONAL_OFFICIALS_SETTING_KEY };
        }),
      },
      institutionalOfficialTerm: {
        findMany: vi.fn(async (args?: any) => {
          const filtered = args?.where?.role
            ? terms.filter((t) => t.role === args.where.role)
            : [...terms];
          const desc = args?.orderBy?.[0]?.effectiveFrom === "desc";
          return filtered.sort((a, b) =>
            desc
              ? b.effectiveFrom.getTime() - a.effectiveFrom.getTime()
              : a.effectiveFrom.getTime() - b.effectiveFrom.getTime(),
          );
        }),
        create: vi.fn(async ({ data }: any) => {
          const now = new Date();
          const row = {
            id: `term-${idSeq++}`,
            role: data.role,
            name: data.name,
            signatureData: data.signatureData ?? null,
            effectiveFrom: data.effectiveFrom,
            effectiveTo: data.effectiveTo ?? null,
            createdById: data.createdById ?? null,
            updatedById: data.updatedById ?? null,
            createdAt: now,
            updatedAt: now,
          };
          terms.push(row);
          return row;
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const idx = terms.findIndex((t) => t.id === where.id);
          if (idx >= 0) {
            terms[idx] = { ...terms[idx], ...data, updatedAt: new Date() };
            return terms[idx];
          }
          throw new Error("Not found");
        }),
      },
      auditLog: {
        create: vi.fn(async ({ data }: any) => {
          auditLogs.push(data);
          return { id: `audit-${auditLogs.length}` };
        }),
      },
      $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(dbMock)),
    };

    beforeEach(() => {
      vi.clearAllMocks();
      storedSetting = JSON.stringify({
        dean: {
          name: "Dr. Legacy Dean",
          signatureData: STUDENT_SIGNATURE,
          updatedAt: "2025-01-10T00:00:00.000Z",
        },
        vpaa: {
          name: "Dr. Active VPAA",
          signatureData: null,
          updatedAt: "2025-01-10T00:00:00.000Z",
        },
        president: {
          name: "Engr. Active President",
          signatureData: null,
          updatedAt: "2025-01-10T00:00:00.000Z",
        },
      });
      terms = [];
      auditLogs = [];
      idSeq = 1;
    });

    it("preserves prior system_settings holder as a closed baseline term on first transition and resolves old vs new dates accurately", async () => {
      const history = await recordInstitutionalOfficialTransition(
        {
          role: "dean",
          name: "Dr. Incoming Dean",
          signatureData: STUDENT_SIGNATURE,
          effectiveFrom: "2026-07-01",
        },
        "admin-1",
        dbMock,
      );

      expect(history.terms.dean).toHaveLength(2);
      expect(history.terms.dean[0]).toMatchObject({
        name: "Dr. Incoming Dean",
        effectiveFrom: "2026-07-01",
        effectiveTo: null,
        isCurrent: true,
      });
      expect(history.terms.dean[1]).toMatchObject({
        name: "Dr. Legacy Dean",
        effectiveFrom: "2025-01-10",
        effectiveTo: "2026-06-30",
        isCurrent: false,
      });

      // Historical defense date before transition resolves Dr. Legacy Dean
      const before = await loadInstitutionalOfficialsAsOf("2026-06-15", dbMock);
      expect(before.dean.name).toBe("Dr. Legacy Dean");
      expect(before.vpaa.name).toBe("Dr. Active VPAA");

      // Defense date on/after transition resolves Dr. Incoming Dean
      const after = await loadInstitutionalOfficialsAsOf("2026-07-01", dbMock);
      expect(after.dean.name).toBe("Dr. Incoming Dean");

      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0]).toMatchObject({
        actorId: "admin-1",
        actionType: "INSTITUTIONAL_OFFICIAL_TERM_RECORDED",
      });
    });

    it("rejects a new transition whose effectiveFrom is on or before the current term's effectiveFrom", async () => {
      await recordInstitutionalOfficialTransition(
        {
          role: "dean",
          name: "Dr. Incoming Dean",
          effectiveFrom: "2026-07-01",
        },
        "admin-1",
        dbMock,
      );

      await expect(
        recordInstitutionalOfficialTransition(
          {
            role: "dean",
            name: "Dr. Third Dean",
            effectiveFrom: "2026-07-01",
          },
          "admin-1",
          dbMock,
        ),
      ).rejects.toMatchObject({ statusCode: 400 });

      const hist = await listInstitutionalOfficialHistory(dbMock);
      expect(hist.terms.dean).toHaveLength(2);
    });
  });
});
