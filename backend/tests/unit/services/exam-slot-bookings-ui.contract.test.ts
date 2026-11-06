// Actual transpiled JSX with controlled hooks/queries, following existing Exam UI tests.
// Shared primitive behavior is inspected/rendered; this is not browser/manual QA.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as schedule from "../../../../frontend/src/lib/admin-exam-schedules";
import * as state from "../../../../frontend/src/lib/exam-record-state";
import { examinationTimestamp } from "../../../../frontend/src/lib/exam-execution";

const requireFrontend = createRequire(path.resolve("../frontend/package.json"));
const { createElement } = requireFrontend("react");
const { renderToStaticMarkup } = requireFrontend("react-dom/server");
type Element = { type: unknown; props: Record<string, any> };
let states: any[], cursor: number, queries: any[], mutations: any[], bookingResult: any;
const request = vi.fn(), refetch = vi.fn(), invalidateQueries = vi.fn();
const tag = (name: string) => ({ children }: any) => createElement(name, {}, children);
const primitives = (names: string[]) => Object.fromEntries(names.map(name => [name, tag("div")]));
const slot = { id: "slot-1", programId: "program-1", program: { programName: "Master of Test Studies" },
  examDate: "2099-11-06T00:00:00.000Z", examTime: "1970-01-01T16:00:00.000Z", slotsTaken: 2, maxSlots: 5, isActive: true };
const booking = { id: "application-9", status: "PENDING", createdAt: "2026-11-05T17:30:00.000Z",
  essayEvaluationCompleted: false, reconsidered: false,
  student: { pinnacleApplicantId: "PIN-123", user: { firstName: "Ana", lastName: "Applicant" } } };
const modules: Record<string, any> = {
  "react/jsx-runtime": requireFrontend("react/jsx-runtime"),
  react: {
    useState: (initial: any) => { const index = cursor++; if (!(index in states)) states[index] = initial;
      return [states[index], (value: any) => { states[index] = value; }]; },
    useRef: (initial: any) => { const index = cursor++; return states[index] ??= { current: initial }; },
  },
  "@tanstack/react-query": {
    useQuery: (options: any) => { queries.push(options);
      if (options.queryKey[0] === "examSlotBookings") return bookingResult;
      if (options.queryKey[0] === "examSlots") return { data: [slot], isLoading: false };
      return { data: { graduatePrograms: [{ id: slot.programId, programName: slot.program.programName }] } };
    },
    useMutation: (options: any) => { mutations.push(options); return { isPending: false, mutate: vi.fn() }; },
    useQueryClient: () => ({ invalidateQueries }),
  },
  "@/lib/api.client": { apiClientRequest: request },
  "@/lib/utils": { cn: (...values: any[]) => values.join(" ") },
  "@/lib/admin-exam-schedules": schedule,
  "@/lib/exam-record-state": state,
  "@/lib/exam-execution": { examinationTimestamp },
  "@/components/admin/exam/exam-state-badge": { ExamStateBadge: ({ state: key }: any) => createElement("span", {}, state.EXAM_STATE_LABEL[key as state.ExamStateKey]) },
  "@/components/ui/dialog": primitives(["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription", "DialogFooter"]),
  "@/components/ui/button": { Button: tag("button"), buttonVariants: () => "button" },
  "@/components/ui/badge": { Badge: tag("span") },
  "@/components/ui/card": primitives(["Card", "CardContent"]),
  "@/components/ui/skeleton": { Skeleton: tag("div") },
  "@/components/ui/input": { Input: tag("input") },
  "@/components/ui/page-header": { PageHeader: tag("header") },
  "@/components/ui/select": primitives(["Select", "SelectContent", "SelectItem", "SelectTrigger"]),
  "next/link": { __esModule: true, default: ({ children, ...props }: any) => createElement("a", props, children) },
  "lucide-react": new Proxy({}, { get: (_, name) => (props: any) => createElement("svg", { ...props, "data-icon": String(name) }) }),
  "@base-ui/react/tooltip": { Tooltip: {
    ...primitives(["Root", "Portal", "Positioner", "Popup"]),
    Trigger: ({ render: _render, children, ...props }: any) => createElement("button", props, children),
  } },
};
function source(file: string) { return readFileSync(path.resolve(`../frontend/src/${file}`), "utf8"); }
function compile(input: string, extra = "") {
  const code = ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports: any = {};
  new Function("require", "exports", code + extra)((name: string) => {
    if (!(name in modules)) throw new Error(`Unexpected booking UI dependency ${name}`); return modules[name];
  }, exports);
  return exports;
}
const tooltipSource = source("components/ui/tooltip.tsx");
modules["@/components/ui/tooltip"] = compile(tooltipSource);
const dialogSource = source("components/admin/exam/schedule-bookings-dialog.tsx");
const dialog = compile(dialogSource, "\nexports.BookingList = BookingList;");
modules["@/components/admin/exam/schedule-bookings-dialog"] = dialog;
const pageSource = source("app/(portal)/admin/exam/slots/page.tsx");
const page = compile(pageSource, "\nexports.CapacityCell = CapacityCell;");
function render(component: any, props: any = {}) { cursor = 0; queries = []; mutations = []; return component(props); }
function nodes(tree: any): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object" || !tree.props) return [];
  return [tree, ...nodes(tree.props.children)];
}
function html(component: any, props: any) { return renderToStaticMarkup(render(component, props)); }
beforeEach(() => {
  vi.clearAllMocks(); states = []; cursor = 0; queries = []; mutations = [];
  bookingResult = { data: [booking], isLoading: false, isFetching: false, isError: false, refetch };
});

describe("Entrance Exam Schedules booking viewer", () => {
  it("keeps Users beside booked capacity and uses the shared named tooltip/focus control", () => {
    const markup = html(page.CapacityCell, { slotsTaken: 2, maxSlots: 5, onViewBookings: vi.fn() });
    expect(markup).toContain("2 / 5 booked"); expect(markup).toContain("3 seats available");
    expect(markup).toContain('aria-label="View bookings"'); expect(markup).toContain('data-icon="Users"');
    expect(markup).toMatch(/>View bookings<\/div>/); expect(markup).toContain("focus-visible:ring-2");
    expect(markup).toContain("border-(--earist-border-gray)");
    expect(markup).toContain("bg-(--earist-surface-gray)");
    expect(markup).toContain("text-(--earist-primary)");
    expect(tooltipSource).toContain("TooltipPrimitive.Popup");
  });
  it("retains the booking control even if capacity is unavailable", () => {
    expect(html(page.CapacityCell, { slotsTaken: 0, maxSlots: 0, onViewBookings: vi.fn() })).toContain('aria-label="View bookings"');
  });
  it("opens the exact selected schedule and configures return focus; dismissal remains allowed for pending reads", () => {
    let tree = render(page.default);
    const capacity = nodes(tree).find(node => node.type === page.CapacityCell)!;
    const trigger = { focus: vi.fn() };
    capacity.props.onViewBookings(trigger);
    tree = render(page.default);
    const viewer = nodes(tree).find(node => node.type === dialog.ScheduleBookingsDialog)!;
    expect(viewer.props.slot).toEqual(slot); expect(viewer.props.returnFocusRef.current).toBe(trigger);
    const dialogTree = render(dialog.ScheduleBookingsDialog, viewer.props);
    expect(dialogTree.props.open).toBe(true);
    expect(nodes(dialogTree).some(node => node.props.finalFocus === viewer.props.returnFocusRef)).toBe(true);
    dialogTree.props.onOpenChange(false);
    tree = render(page.default);
    expect(nodes(tree).find(node => node.type === dialog.ScheduleBookingsDialog)!.props.slot).toBeNull();
  });
  it("keeps Pencil as an icon-only Edit schedule action with its existing edit behavior", () => {
    let tree = render(page.default);
    const edit = nodes(tree).find(node => node.props.label === "Edit schedule")!;
    expect(renderToStaticMarkup(edit)).toContain('aria-label="Edit schedule"');
    expect(renderToStaticMarkup(edit)).toContain('data-icon="Pencil"');
    expect(renderToStaticMarkup(edit)).not.toMatch(/>Edit<|>Edit schedule<\/button>/);
    edit.props.onClick(); tree = render(page.default);
    expect(renderToStaticMarkup(tree)).toContain("Edit Schedule");
    const payload = { programId: slot.programId, examDate: "2099-11-06", examTime: slot.examTime, maxSlots: 5 };
    return mutations[0].mutationFn(payload).then(() => {
      expect(request).toHaveBeenLastCalledWith(`/exam/slots/${slot.id}`, { method: "PUT", body: JSON.stringify(payload) });
    });
  });
  it("identifies Program/date/original schedule wall-clock once, without opening another data query", () => {
    const markup = html(dialog.ScheduleBookingsDialog, { slot, onClose: vi.fn(), returnFocusRef: { current: null } });
    expect(markup).toContain(slot.program.programName); expect(markup).toContain("November 6, 2099"); expect(markup).toMatch(/4:00\s*PM/);
    expect(markup.split(slot.program.programName)).toHaveLength(2);
    expect(dialogSource).toContain("{slot && <BookingList key={slot.id}");
  });
  it("reads only the exact schedule with GET and a schedule-specific query key", async () => {
    render(dialog.BookingList, { slotId: "slot/encoded" });
    expect(queries[0].queryKey).toEqual(["examSlotBookings", "slot/encoded"]);
    expect(queries[0].gcTime).toBe(0);
    await queries[0].queryFn();
    expect(request).toHaveBeenCalledWith("/exam/slots/slot%2Fencoded/bookings", { method: "GET" });
    expect(mutations).toEqual([]);
  });
  it("shows Applicant, Pinnacle ID, createdAt evidence, canonical state and exact application navigation", () => {
    const markup = html(dialog.BookingList, { slotId: slot.id });
    for (const value of ["Ana", "Applicant", "PIN-123", "Pinnacle Applicant ID", "Booking recorded", "Exam State", "Scheduled", "View Exam Record"]) expect(markup).toContain(value);
    expect(markup).not.toContain("Philippine Time (Asia/Manila)");
    expect(markup).toContain('href="/admin/exam/applications/application-9"');
    expect(markup).toContain(`dateTime="${booking.createdAt}"`);
    expect(markup).toMatch(/Nov 6, 2026.*1:30\s*AM/);
    expect(markup).not.toMatch(/Self-booked|Assigned by Admin|Applicant booked at/);
  });
  it.each(["UTC", "Asia/Manila", "America/Los_Angeles"])("renders Booking recorded in Manila regardless of browser zone %s", zone => {
    vi.stubEnv("TZ", zone);
    try { expect(html(dialog.BookingList, { slotId: slot.id })).toMatch(/Nov 6, 2026.*1:30\s*AM/); }
    finally { vi.unstubAllEnvs(); }
  });
  it.each([
    ["TAKEN", false, false, "Needs Essay Grading"],
    ["TAKEN", true, false, "Essay Evaluated — Final Result Pending"],
    ["FAILED", false, true, "PASSED — RECONSIDERED"],
    ["FAILED", false, false, "Failed"],
    ["APPEALED", false, false, "Appeal Pending"],
  ])("reuses recorded state %s without browser-clock classification", (status, essayEvaluationCompleted, reconsidered, expected) => {
    bookingResult.data = [{ ...booking, status, essayEvaluationCompleted, reconsidered }];
    expect(html(dialog.BookingList, { slotId: slot.id })).toContain(expected);
    expect(dialogSource).not.toMatch(/Date\.now|new Date|isPastExamSchedule/);
  });
  it("shows a truthful empty state and never mistakes loading/error/refetch for empty", () => {
    bookingResult.data = [];
    expect(html(dialog.BookingList, { slotId: slot.id })).toContain("No current bookings for this schedule.");
    bookingResult.isLoading = true;
    expect(html(dialog.BookingList, { slotId: slot.id })).toContain('aria-label="Loading bookings"');
    bookingResult.isLoading = false; bookingResult.isError = true;
    let tree = render(dialog.BookingList, { slotId: slot.id });
    expect(renderToStaticMarkup(tree)).toContain("Could not load schedule bookings.");
    nodes(tree).find(node => typeof node.props.onClick === "function")!.props.onClick();
    expect(refetch).toHaveBeenCalledOnce();
    bookingResult.isError = false; bookingResult.isFetching = true; bookingResult.data = [booking];
    const markup = html(dialog.BookingList, { slotId: slot.id });
    expect(markup).not.toContain("No current bookings"); expect(markup).not.toContain("PIN-123");
  });
  it("keeps the accepted table, original create/status payloads and scheduling guards", async () => {
    render(page.default);
    const payload = { programId: slot.programId, examDate: "2099-11-06", examTime: slot.examTime, maxSlots: 5 };
    await mutations[0].mutationFn(payload);
    expect(request).toHaveBeenLastCalledWith("/exam/slots", { method: "POST", body: JSON.stringify(payload) });
    await mutations[1].mutationFn({ id: slot.id, isActive: false });
    expect(request).toHaveBeenLastCalledWith(`/exam/slots/${slot.id}/status`, { method: "PATCH", body: JSON.stringify({ isActive: false }) });
    for (const label of ["Program", "Schedule", "Capacity", "Availability", "Action"]) expect(pageSource).toContain(label);
    for (const guard of ["isEditingBooked", "isEditingPast", "validateExamScheduleForm", "bookedCount: editingBookedCount", "saveMutation.isPending", "toggleMutation.isPending"]) expect(pageSource).toContain(guard);
  });
  it("uses wrapping rows, stacked narrow layout, scrolling and no booking-viewer write actions", () => {
    for (const token of ["max-h-[85dvh]", "overflow-y-auto", "[overflow-wrap:anywhere]", "flex-col", "sm:flex-row", "sm:grid-cols-2", "whitespace-normal", "h-auto"]) expect(dialogSource).toContain(token);
    expect(dialogSource).not.toMatch(/useMutation|slotsTaken|assignments|reschedule|method: "(POST|PUT|PATCH|DELETE)"/);
  });
});
