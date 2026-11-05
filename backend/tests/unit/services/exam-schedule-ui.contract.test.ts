import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as helpers from "../../../../frontend/src/lib/admin-exam-schedules";

const requireFrontend = createRequire(path.resolve("../frontend/package.json"));
const { createElement } = requireFrontend("react");
const { renderToStaticMarkup } = requireFrontend("react-dom/server");
let applicant: any;
const queries: any[] = [], mutations: any[] = [];
const request = vi.fn(), invalidateQueries = vi.fn();
const tag = (name: string) => ({ children }: any) => createElement(name, {}, children);
const modules: Record<string, unknown> = {
  "react/jsx-runtime": requireFrontend("react/jsx-runtime"),
  react: { useState: (initial: unknown) => [initial, vi.fn()] },
  "@tanstack/react-query": {
    useQuery: (options: any) => { queries.push(options); return { data: options.queryKey[0] === "examStatus" ? applicant : [], isLoading: false }; },
    useMutation: (options: any) => { mutations.push(options); return { isPending: false, mutate: vi.fn() }; },
    useQueryClient: () => ({ invalidateQueries }),
  },
  "next/link": { __esModule: true, default: tag("a") },
  "@/components/ui/card": { Card: tag("section"), CardContent: tag("div"), CardHeader: tag("header"), CardTitle: tag("h3") },
  "@/components/ui/badge": { Badge: tag("span") }, "@/components/ui/button": { Button: tag("button") },
  "@/components/ui/alert": { Alert: tag("aside"), AlertDescription: tag("p") },
  "lucide-react": new Proxy({}, { get: () => tag("i") }),
  "@/lib/api.client": { apiClientRequest: request }, "@/lib/admin-exam-schedules": helpers,
};
const source = readFileSync(path.resolve("../frontend/src/app/(portal)/applicant/schedule/page.tsx"), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const exports: Record<string, any> = {};
new Function("require", "exports", code)((name: string) => { if (!(name in modules)) throw new Error(`Unexpected schedule dependency: ${name}`); return modules[name]; }, exports);
const render = () => renderToStaticMarkup(createElement(exports.default));

beforeEach(() => { vi.clearAllMocks(); queries.length = 0; mutations.length = 0; applicant = { programId: "own-program", alignmentStatus: "ALIGNED", confirmedSlot: null }; });
describe("B3 Applicant schedule presentation and self-booking", () => {
  it("renders the exact booked Philippine wall-clock and retains automatic confirmation", () => {
    applicant.confirmedSlot = { id: "booked", programName: "Own Program", examDate: "2026-11-15T00:00:00.000Z", examTime: "1970-01-01T16:00:00.000Z" };
    const html = render();
    expect(html).toContain("Confirmed Schedule"); expect(html).toMatch(/November 15, 2026/); expect(html).toMatch(/4:00\s*PM/);
    expect(html).toContain("Own Program"); expect(queries[1].enabled).toBe(false);
    expect(source).not.toMatch(/toLocaleTimeString|toLocaleDateString|setHours/);
  });
  it.each(["ALIGNED", "CLEARED", "PENDING_WAIVER", "UNKNOWN"])("keeps availability query gating for alignment %s", alignmentStatus => {
    applicant.alignmentStatus = alignmentStatus; render();
    expect(queries[1].enabled).toBe(alignmentStatus === "ALIGNED" || alignmentStatus === "CLEARED");
  });
  it("retains slot-only booking, schedule-selection hierarchy and query refresh", async () => {
    const html = render(); expect(html).toContain("Exam Slot Selection"); expect(html).toContain("Exam Date"); expect(html).toContain("Exam Time");
    await queries[1].queryFn(); expect(request).toHaveBeenLastCalledWith("/exam/slots/available?programId=own-program", { method: "GET" });
    await mutations[0].mutationFn("slot-only"); expect(request).toHaveBeenLastCalledWith("/exam/schedule", { method: "POST", body: JSON.stringify({ slotId: "slot-only" }) });
    mutations[0].onSuccess(); expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["examStatus"] }); expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["examSlots"] });
  });
});

describe("B3 accepted UIUX-2H helper regressions", () => {
  const now = new Date("2026-11-15T02:00:00Z");
  const slot = { examDate: "2026-11-15T00:00:00.000Z", examTime: "1970-01-01T16:00:00.000Z", isActive: true, slotsTaken: 1, maxSlots: 2 };
  it("retains Past -> Closed -> Full -> Open precedence", () => {
    expect(helpers.resolveExamScheduleAvailability(slot, now)).toBe("OPEN");
    expect(helpers.resolveExamScheduleAvailability({ ...slot, slotsTaken: 2 }, now)).toBe("FULL");
    expect(helpers.resolveExamScheduleAvailability({ ...slot, slotsTaken: 2, isActive: false }, now)).toBe("CLOSED");
    expect(helpers.resolveExamScheduleAvailability({ ...slot, slotsTaken: 2, isActive: false, examTime: "1970-01-01T09:00:00.000Z" }, now)).toBe("PAST");
  });
  it("keeps filters consistent with availability, including same-day future", () => {
    expect(helpers.matchesTemporalFilter(slot, "upcoming", now)).toBe(true);
    expect(helpers.matchesTemporalFilter(slot, "past", now)).toBe(false);
    expect(helpers.matchesTemporalFilter(slot, "all", now)).toBe(true);
    expect(helpers.matchesAvailabilityFilter(slot, "open", now)).toBe(true);
    expect(helpers.matchesAvailabilityFilter(slot, "full", now)).toBe(false);
    expect(helpers.matchesAvailabilityFilter({ ...slot, isActive: false }, "closed", now)).toBe(true);
  });
  it("preserves wall-clock display/input/payload round-trip and capacity minimum", () => {
    expect(helpers.toDateInputValue(slot.examDate)).toBe("2026-11-15"); expect(helpers.toTimeInputValue(slot.examTime)).toBe("16:00");
    expect(helpers.toSchedulePayload("2026-11-15", "16:00")).toEqual({ examDate: "2026-11-15", examTime: slot.examTime });
    expect(helpers.resolveExamCapacity(1, 2)).toMatchObject({ booked: 1, maximum: 2, available: 1, isFull: false });
    expect(helpers.validateExamScheduleForm({ programId: "p", examDate: "2026-11-15", examTime: "16:00", capacity: "1" }, { bookedCount: 2 }).capacity).toMatch(/less than/);
    expect(helpers.validateExamScheduleForm({ programId: "p", examDate: "2026-11-15", examTime: "16:00", capacity: "2" }, { bookedCount: 2 })).toEqual({});
  });
  it("preserves the accepted Admin hierarchy and Edit/booking-state controls", () => {
    const admin = readFileSync(path.resolve("../frontend/src/app/(portal)/admin/exam/slots/page.tsx"), "utf8");
    for (const text of ["Entrance Exam Schedules", "Create Schedule", "Upcoming", "Past", "Close for Booking", "Reopen for Booking", "isEditingBooked", "validateExamScheduleForm", "isEditingPast"]) expect(admin).toContain(text);
    expect(admin).not.toMatch(/Activate|Deactivate|Trash/);
  });
});
