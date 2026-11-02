// Executes actual transpiled components with controlled hooks/query results.
// This is focused component/contract verification, not browser/manual QA.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as scheduleHelpers from "../../../../frontend/src/lib/admin-exam-schedules";
import * as recordHelpers from "../../../../frontend/src/lib/exam-record-state";

const requireFrontend = createRequire(path.resolve("../frontend/package.json"));
const { createElement } = requireFrontend("react");
const { renderToStaticMarkup } = requireFrontend("react-dom/server");
type Element = { type: unknown; props: Record<string, any> };
let states: any[] = [], cursor = 0, queries: any[] = [], mutation: any;
let searchResult: any, optionsResult: any, mutationPending = false;
const request = vi.fn(), invalidateQueries = vi.fn(), mutate = vi.fn(), refetch = vi.fn(), toast = vi.fn();
const tag = (name: string) => ({ children }: any) => createElement(name, {}, children);
const primitives = (names: string[]) => Object.fromEntries(names.map(name => [name, tag("div")]));
const modules: Record<string, unknown> = {
  "react/jsx-runtime": requireFrontend("react/jsx-runtime"),
  react: {
    useState: (initial: any) => {
      const index = cursor++; if (!(index in states)) states[index] = initial;
      return [states[index], (value: any) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
    },
    useRef: (initial: any) => { const index = cursor++; return states[index] ??= { current: initial }; },
    useEffect: () => {}, // Debounce is verified separately in source; no browser timer claim.
  },
  "@tanstack/react-query": {
    useQuery: (query: any) => {
      queries.push(query);
      if (query.queryKey[0] === "assignmentApplicantSearch") return searchResult;
      if (query.queryKey[0] === "examAssignmentOptions") return optionsResult;
      if (query.queryKey[0] === "examRecords") return { data: [{ id: "record-1", status: "PENDING",
        student: { user: { firstName: "Ada", lastName: "Fixture", email: "ada@example.invalid" }, pinnacleApplicantId: "PIN-1" },
        program: { id: "program-1", programName: "Test Program" }, slot: { examDate: "2026-11-02T00:00:00Z", examTime: "1970-01-01T09:00:00Z" } }] };
      return { data: { graduatePrograms: [] } };
    },
    useMutation: (options: any) => { mutation = options; return { isPending: mutationPending, mutate }; },
    useQueryClient: () => ({ invalidateQueries }),
  },
  sonner: { toast: { success: toast } },
  "@/lib/api.client": { apiClientRequest: request },
  "@/lib/admin-exam-schedules": scheduleHelpers,
  "@/lib/exam-record-state": recordHelpers,
  "@/lib/utils": { cn: (...values: string[]) => values.join(" ") },
  "@/components/ui/dialog": primitives(["Dialog", "DialogContent", "DialogDescription", "DialogFooter", "DialogHeader", "DialogTitle", "DialogTrigger"]),
  "@/components/ui/button": { Button: tag("button"), buttonVariants: () => "button" },
  "@/components/ui/input": { Input: tag("input") },
  "@/components/ui/label": { Label: tag("label") },
  "@/components/ui/page-header": { PageHeader: ({ title, actions }: any) => createElement("header", {}, title, actions) },
  "@/components/ui/card": primitives(["Card", "CardContent"]),
  "@/components/ui/skeleton": primitives(["Skeleton"]),
  "@/components/ui/select": primitives(["Select", "SelectContent", "SelectItem", "SelectTrigger"]),
  "@/components/ui/pagination": primitives(["Pagination", "PaginationContent", "PaginationItem"]),
  "@/components/admin/exam/exam-state-badge": { ExamStateBadge: ({ state }: any) => createElement("span", {}, state) },
  "@/components/admin/exam/assign-applicant-dialog": { AssignApplicantDialog: tag("button") },
  "next/link": { __esModule: true, default: ({ children, ...props }: any) => createElement("a", props, children) },
  "lucide-react": new Proxy({}, { get: () => tag("i") }),
};
const dialogSource = readFileSync(path.resolve("../frontend/src/components/admin/exam/assign-applicant-dialog.tsx"), "utf8");
const pageSource = readFileSync(path.resolve("../frontend/src/app/(portal)/admin/exam/applications/page.tsx"), "utf8");
function compile(source: string, extra = "") {
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports: any = {};
  new Function("require", "exports", code + extra)((name: string) => {
    if (!(name in modules)) throw new Error(`Unexpected UI dependency: ${name}`);
    return modules[name];
  }, exports);
  return exports;
}
const components = compile(dialogSource, "\nexports.AssignmentForm = AssignmentForm;");
const page = compile(pageSource).default;
const pendingRef = { current: false }, close = vi.fn(), assigned = vi.fn();
const props = { pendingRef, onClose: close, onAssigned: assigned };
function render(component = components.AssignmentForm, suppliedProps = props): Element {
  cursor = 0; queries = []; return component(suppliedProps);
}
function nodes(tree: any): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object" || !tree.props) return [];
  return [tree, ...nodes(tree.props.children)];
}
function text(tree: any): string {
  if (Array.isArray(tree)) return tree.map(text).join("");
  if (tree === null || tree === undefined || typeof tree === "boolean") return "";
  return typeof tree === "object" ? text(tree.props?.children) : String(tree);
}
const button = (tree: Element, label: string) => {
  const result = nodes(tree).find(node => text(node) === label && typeof node.props.onClick === "function");
  if (!result) throw new Error(`Missing button ${label}`);
  return result;
};
function chooseApplicant() {
  states = ["Ada", "Ada", 1, "", "", false, ""];
  const tree = render();
  nodes(tree).find(node => node.type === "button" && text(node).includes("Ada"))!.props.onClick();
}
function chooseSlot() {
  const tree = render();
  nodes(tree).find(node => node.props.type === "radio")!.props.onChange();
}
beforeEach(() => {
  vi.clearAllMocks(); states = []; cursor = 0; queries = []; pendingRef.current = false; mutationPending = false;
  searchResult = { data: { applicants: [{ id: "student-1", firstName: "Ada", lastName: "Fixture", email: "ada@example.invalid",
    pinnacleApplicantId: "PIN-1", program: { id: "program-1", programName: "Test Program" } }], total: 1 }, isLoading: false, refetch };
  optionsResult = { data: { applicant: { id: "student-1", firstName: "Ada", lastName: "Fixture", email: "ada@example.invalid",
    pinnacleApplicantId: "PIN-1", program: { id: "program-1", programName: "Test Program" }, alignmentStatus: "CLEARED" },
    eligible: true, reason: null, date: "2026-11-02", timeZone: "Asia/Manila",
    slots: [{ id: "slot-1", examDate: "2026-11-02T00:00:00.000Z", examTime: "1970-01-01T09:00:00.000Z", slotsTaken: 1, maxSlots: 2, remainingSeats: 1 }] }, refetch };
});

describe("Admin same-day assignment dialog", () => {
  it("opens from one shared Dialog trigger and closes/resets the form; blocks dismissal in flight", () => {
    let tree = render(components.AssignApplicantDialog, { onAssigned: assigned } as any);
    expect(text(tree)).toBe("Assign Applicant"); expect(tree.props.open).toBe(false);
    tree.props.onOpenChange(true); tree = render(components.AssignApplicantDialog, { onAssigned: assigned } as any);
    expect(tree.props.open).toBe(true);
    const form = nodes(tree).find(node => node.type === components.AssignmentForm)!;
    form.props.pendingRef.current = true;
    tree.props.onOpenChange(false); expect(render(components.AssignApplicantDialog).props.open).toBe(true);
    form.props.pendingRef.current = false;
    form.props.onClose(); expect(render(components.AssignApplicantDialog).props.open).toBe(false);
    expect(dialogSource).toContain("{open && ("); // Unmount discards prior selection/error/draft.
  });
  it("reuses paginated registered Applicant search with encoded terms, then loads exact selected Student options", async () => {
    states = ["A&B", "A&B", 2, "", "", false, ""]; render();
    expect(queries[0].enabled).toBe(true); await queries[0].queryFn();
    expect(request).toHaveBeenLastCalledWith("/admin/applicants?search=A%26B&page=2&pageSize=10");
    chooseApplicant(); render(); expect(states[3]).toBe("student-1"); expect(queries[0].enabled).toBe(false);
    await queries[1].queryFn(); expect(request).toHaveBeenLastCalledWith("/exam/assignment-options/student-1");
  });
  it("reviews authoritative identity, Program, clearance, original wall clock and capacity before confirmation", () => {
    chooseApplicant(); chooseSlot(); let tree = render();
    for (const value of ["Ada Fixture", "PIN-1", "Test Program", "Cleared", "November 2, 2026", "1 / 2 booked", "1 seats remaining"]) expect(text(tree)).toContain(value);
    expect(text(tree)).toMatch(/9:00\s*AM/);
    button(tree, "Review Assignment").props.onClick(); tree = render();
    expect(text(tree)).toContain("Confirm Applicant Assignment");
    expect(text(tree)).toContain("original date and time remain unchanged");
    expect(button(tree, "Confirm Assignment").props.disabled).toBe(false);
  });
  it("prevents two clicks before rerender and disables actions/close during mutation", async () => {
    chooseApplicant(); chooseSlot(); button(render(), "Review Assignment").props.onClick();
    const confirm = button(render(), "Confirm Assignment"); confirm.props.onClick(); confirm.props.onClick();
    expect(mutate).toHaveBeenCalledOnce(); expect(pendingRef.current).toBe(true);
    await mutation.mutationFn(); expect(request).toHaveBeenCalledWith("/exam/assignments", { method: "POST", body: JSON.stringify({ studentId: "student-1", slotId: "slot-1" }) });
    expect(mutation.retry).toBe(false);
    mutationPending = true; const tree = render();
    expect(button(tree, "Assigning…").props.disabled).toBe(true); expect(button(tree, "Cancel").props.disabled).toBe(true);
    expect(tree.props.showCloseButton).toBe(false);
  });
  it("success refreshes existing records and Applicant caches, resets page filters and closes", () => {
    render(); mutation.onSuccess(); mutation.onSettled();
    for (const key of ["examRecords", "adminApplicants", "examAssignmentOptions"]) expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: [key] });
    expect(assigned).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce(); expect(pendingRef.current).toBe(false);
    expect(toast).toHaveBeenCalledOnce();
  });
  it("rejection retains bounded server reason, clears selection and refreshes authority without override", () => {
    chooseApplicant(); chooseSlot(); button(render(), "Review Assignment").props.onClick(); render();
    mutation.onError(new Error("This slot is fully booked.")); mutation.onSettled();
    const tree = render(); expect(text(tree)).toContain("This slot is fully booked.");
    expect(states[4]).toBe(""); expect(states[5]).toBe(false); expect(close).not.toHaveBeenCalled(); expect(refetch).toHaveBeenCalledOnce();
    expect(nodes(tree).some(node => node.props.role === "alert")).toBe(true);
    expect(button(tree, "Review Assignment").props.disabled).toBe(true);
  });
  it("blocked Applicant has a truthful reason and cannot select a schedule", () => {
    chooseApplicant(); optionsResult.data.eligible = false; optionsResult.data.reason = "Program clearance is required.";
    const tree = render(); expect(text(tree)).toContain("Program clearance is required.");
    expect(nodes(tree).some(node => node.props.type === "radio")).toBe(false);
    expect(button(tree, "Review Assignment").props.disabled).toBe(true);
  });
  it("missing slots, options error and background refetch each prevent confirmation", () => {
    chooseApplicant(); optionsResult.data.slots = [];
    expect(text(render())).toContain("No eligible same-day schedules");
    optionsResult.isError = true; optionsResult.error = new Error("Applicant not found.");
    expect(text(render())).toContain("Applicant not found.");
    optionsResult.isError = false; optionsResult.isFetching = true;
    const tree = render(); expect(text(tree)).toContain("Checking Applicant"); expect(button(tree, "Review Assignment").props.disabled).toBe(true);
  });
  it("search failure and confirmed empty results remain distinct", () => {
    states = ["Ada", "Ada", 1, "", "", false, ""]; searchResult.isError = true;
    expect(text(render())).toContain("Applicants could not be loaded.");
    searchResult.isError = false; searchResult.data = { applicants: [], total: 0 };
    expect(text(render())).toContain("No registered Applicants match");
  });
  it("retains responsive shared Dialog semantics, labels, native radio group and no browser confirmations", () => {
    expect(dialogSource).toContain("DialogTitle"); expect(dialogSource).toContain("DialogDescription");
    expect(dialogSource).toContain("htmlFor=\"assignment-search\""); expect(dialogSource).toContain("<fieldset");
    expect(dialogSource).toContain("<legend"); expect(dialogSource).toContain("max-h-[90dvh]");
    expect(dialogSource).not.toMatch(/\balert\(|window\.confirm\(/);
  });
});

describe("Existing Entrance Exam Records page", () => {
  it("keeps PageHeader action above unchanged table/filter/View/pagination composition", () => {
    expect(pageSource).toContain("actions={<AssignApplicantDialog onAssigned={clearFilters} />}");
    expect(pageSource).not.toMatch(/KPI|StatisticCard/);
    const html = renderToStaticMarkup(render(page));
    for (const label of ["Entrance Exam Records", "Applicant", "Program", "Exam Schedule", "Exam State", "Action", "Search", "Showing 1 to 1 of 1 exam record"]) expect(html).toContain(label);
    expect(html).toContain('/admin/exam/applications/record-1');
    expect(html).toContain("View exam record for Ada Fixture");
    states[0] = "unmatched";
    expect(renderToStaticMarkup(render(page))).toContain("No exam records match the current filters.");
  });
});
