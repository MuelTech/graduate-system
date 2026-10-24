import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  defenseSchedule: { findUnique: vi.fn() },
  panelAssignment: { findFirst: vi.fn() },
  thesisDocument: { findUnique: vi.fn() },
  defenseAnnotation: { findMany: vi.fn() },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { DefenseCollaborationService } from "../../../src/services/defense-collaboration.service";

describe("CDW-6 shared attempt-annotation read (used by current + history)", () => {
  const svc = new DefenseCollaborationService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes the read by the EXACT scheduleId + thesisDocumentId and preserves original roles", async () => {
    prismaMock.defenseAnnotation.findMany.mockResolvedValue([
      {
        id: "ann-1",
        scheduleId: "sched-a",
        thesisDocumentId: "doc-a",
        pageNumber: 2,
        selectedText: "text",
        anchorData: { rects: [], prefix: "", suffix: "" },
        anchorVersion: 1,
        createdAt: new Date("2026-07-01T00:00:00Z"),
        updatedAt: new Date("2026-07-01T00:00:00Z"),
        author: {
          id: "pa-old",
          userId: "old-user",
          role: "PANELIST",
          isActive: false,
          user: { firstName: "Old", lastName: "Role" },
        },
        comments: [],
      },
    ]);

    const result = await svc.listAttemptAnnotationsForHistory("sched-a", "doc-a");

    expect(prismaMock.defenseAnnotation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { scheduleId: "sched-a", thesisDocumentId: "doc-a" } }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].scheduleId).toBe("sched-a");
    expect(result[0].thesisDocumentId).toBe("doc-a");
    // The author role is read from the historical assignment, never remapped,
    // even after that exact assignment has been retired from current authority.
    expect(result[0].author.role).toBe("PANELIST");
    expect(result[0].author.assignmentId).toBe("pa-old");
    expect(prismaMock.defenseSchedule.findUnique).not.toHaveBeenCalled();
  });
});
