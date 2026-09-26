import { describe, expect, it } from "vitest";
import {
  formatNameList,
  pickCurrentDefenseSchedule,
  summarizeCommittee,
} from "../../../src/services/defense-application-session";

const user = (id: string, first: string, last: string) => ({
  id,
  firstName: first,
  lastName: last,
  email: `${first.toLowerCase()}@earist.edu.ph`,
});

describe("pickCurrentDefenseSchedule", () => {
  const schedules = [
    {
      id: "title-1",
      defenseType: "TITLE_DEFENSE",
      sessionStatus: "CONCLUDED",
      createdAt: "2026-07-01T00:00:00Z",
    },
    {
      id: "proposal-1",
      defenseType: "PROPOSAL_DEFENSE",
      sessionStatus: "SCHEDULED",
      createdAt: "2026-08-01T00:00:00Z",
    },
    {
      id: "title-cancelled",
      defenseType: "TITLE_DEFENSE",
      sessionStatus: "CANCELLED",
      createdAt: "2026-09-01T00:00:00Z",
    },
    {
      id: "proposal-reschedule",
      defenseType: "PROPOSAL_DEFENSE",
      sessionStatus: "SCHEDULED",
      createdAt: "2026-09-15T00:00:00Z",
    },
  ];

  it("matches the session to the current stage (not schedules[0])", () => {
    expect(pickCurrentDefenseSchedule("PROPOSAL", schedules)?.id).toBe(
      "proposal-reschedule",
    );
    expect(pickCurrentDefenseSchedule("TITLE", schedules)?.id).toBe("title-1");
  });

  it("ignores cancelled sessions and other stages", () => {
    expect(pickCurrentDefenseSchedule("FINAL", schedules)).toBe(null);
    const onlyCancelled = [
      {
        id: "x",
        defenseType: "FINAL_DEFENSE",
        sessionStatus: "CANCELLED",
        createdAt: "2026-09-01T00:00:00Z",
      },
    ];
    expect(pickCurrentDefenseSchedule("FINAL", onlyCancelled)).toBe(null);
  });

  it("prefers the latest non-cancelled session for re-defense", () => {
    const list = [
      {
        id: "old",
        defenseType: "FINAL_DEFENSE",
        sessionStatus: "CONCLUDED",
        createdAt: "2026-06-01T00:00:00Z",
      },
      {
        id: "new",
        defenseType: "FINAL_DEFENSE",
        sessionStatus: "SCHEDULED",
        createdAt: "2026-09-01T00:00:00Z",
      },
    ];
    expect(pickCurrentDefenseSchedule("FINAL", list)?.id).toBe("new");
  });
});

describe("summarizeCommittee", () => {
  it("keeps functional roles distinct and adviser only as an explicit seat", () => {
    const summary = summarizeCommittee([
      { role: "CHAIRMAN", user: user("a", "Ada", "Chair") },
      { role: "PANELIST", user: user("b", "Ben", "Panel") },
      { role: "PANELIST", user: user("c", "Cara", "Panel") },
      { role: "FACILITATOR", user: user("d", "Dan", "Fac") },
      { role: "RAPPORTEUR", user: user("e", "Eve", "Rap") },
    ]);
    expect(summary.chairman).toEqual(["Ada Chair"]);
    expect(summary.panelists).toEqual(["Ben Panel", "Cara Panel"]);
    expect(summary.facilitator).toEqual(["Dan Fac"]);
    expect(summary.rapporteur).toEqual(["Eve Rap"]);
    expect(summary.adviser).toEqual([]);
  });

  it("lists adviser only when that seat was explicitly assigned", () => {
    const summary = summarizeCommittee([
      { role: "ADVISER", user: user("adv", "Ann", "Adviser") },
      { role: "CHAIRMAN", user: user("a", "Ada", "Chair") },
    ]);
    expect(summary.adviser).toEqual(["Ann Adviser"]);
  });
});

describe("formatNameList", () => {
  it("truncates long lists with +N more", () => {
    expect(formatNameList(["A", "B", "C", "D", "E"], 3)).toBe("A, B, C +2 more");
    expect(formatNameList(["A"], 3)).toBe("A");
    expect(formatNameList([], 3)).toBe("—");
  });
});
