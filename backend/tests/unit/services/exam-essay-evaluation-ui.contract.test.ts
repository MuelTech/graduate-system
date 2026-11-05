// Executable controlled React/handler contracts; not manual/browser QA.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as statesHelper from "../../../../frontend/src/lib/exam-record-state";
import * as scheduleHelper from "../../../../frontend/src/lib/admin-exam-schedules";
const requireFrontend = createRequire(path.resolve("../frontend/package.json"));
const { createElement } = requireFrontend("react");
const { renderToStaticMarkup } = requireFrontend("react-dom/server");
let states: any[], cursor: number, mutation: any, record: any, pending: boolean;
const request = vi.fn(), mutate = vi.fn(), invalidate = vi.fn(), setData = vi.fn(), success = vi.fn(), failure = vi.fn();
const primitive = (tag = "div") => ({ children, ...props }: any) => createElement(tag, props, children);
const modules: Record<string, any> = {
  "@/components/admin/exam/exam-record-actions": { ExamRecordActions: () => null },
  "react/jsx-runtime": requireFrontend("react/jsx-runtime"),
  react: { useState: (initial: any) => { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], (value: any) => { states[i] = value; }]; }, useRef: (initial: any) => { const i = cursor++; return states[i] ??= { current: initial }; } },
  "@tanstack/react-query": { useMutation: (options: any) => { mutation = options; return { isPending: pending, mutate }; }, useQuery: () => ({ data: record, isLoading: false, isError: false }), useQueryClient: () => ({ setQueryData: setData, invalidateQueries: invalidate }) },
  "@/lib/api.client": { apiClientRequest: request, ApiError: class extends Error {} },
  "@/components/ui/button": { Button: primitive("button"), buttonVariants: () => "button" },
  "@/components/ui/input": { Input: primitive("input") },
  "@/components/exam-content/semantic-text": { SemanticText: ({ text }: any) => createElement("span", {}, text) },
  "@/components/exam-content/stimulus-renderer": { StimulusRenderer: () => null },
  sonner: { toast: { success, error: failure } },
  "next/navigation": { useParams: () => ({ id: "application" }) },
  "next/link": { __esModule: true, default: primitive("a") },
  "@/lib/utils": { cn: (...values: any[]) => values.join(" ") },
  "@/lib/exam-record-state": statesHelper, "@/lib/admin-exam-schedules": scheduleHelper,
  "@/components/ui/page-header": { PageHeader: ({ title }: any) => createElement("h1", {}, title) },
  "@/components/ui/skeleton": { Skeleton: () => null }, "@/components/ui/breadcrumb": { Breadcrumb: () => null },
  "@/components/ui/card": { Card: primitive(), CardContent: primitive() },
  "@/components/admin/exam/exam-state-badge": { ExamStateBadge: ({ state }: any) => createElement("span", {}, statesHelper.EXAM_STATE_LABEL[state as keyof typeof statesHelper.EXAM_STATE_LABEL]) },
  "@/components/admin/exam/start-authorization": { StartAuthorization: () => createElement("p", {}, "Existing Start Authorization") },
  "lucide-react": new Proxy({}, { get: () => () => null }),
};
function compile(file: string) {
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports: any = {}; new Function("require", "exports", code)((name: string) => { if (!(name in modules)) throw new Error(name); return modules[name]; }, exports); return exports;
}
modules["@/components/exam-content/result-breakdown"] = compile("../frontend/src/components/exam-content/result-breakdown.tsx");
const panel = compile("../frontend/src/components/admin/exam/essay-evaluation-panel.tsx").EssayEvaluationPanel;
modules["@/components/admin/exam/essay-evaluation-panel"] = { EssayEvaluationPanel: panel };
const page = compile("../frontend/src/app/(portal)/admin/exam/applications/[id]/page.tsx").default;
function evaluation(overrides: any = {}) { return { status: "PENDING", questionId: "frozen-question", question: { id: "frozen-question", questionText: "Frozen essay prompt", type: "ESSAY", options: [], stimulusType: "NONE" }, responseText: "Exact response\nwith spaces  ", responseState: "SUBMITTED", maximumScore: 25.5, essayScore: null, evaluator: null, evaluatedAt: null, ...overrides }; }
function renderPanel() { cursor = 0; return panel({ applicationId: "application", evaluation: record.essayEvaluation }); }
function nodes(tree: any): any[] { if (Array.isArray(tree)) return tree.flatMap(nodes); if (!tree?.props) return []; return [tree, ...nodes(tree.props.children)]; }
function label(tree: any): string { if (Array.isArray(tree)) return tree.map(label).join(""); if (tree == null || typeof tree === "boolean") return ""; return typeof tree === "object" ? label(tree.props?.children) : String(tree); }
const input = (tree: any) => nodes(tree).find(n => n.props.id === "essay-score");
const save = (tree: any) => nodes(tree).find(n => typeof n.props.onClick === "function");
beforeEach(() => {
  vi.clearAllMocks(); states = []; cursor = 0; pending = false;
  record = { id: "application", status: "TAKEN", result: null, resultEmailEligible: false, essayEvaluation: evaluation(), score: { status: "PENDING", totalScore: null }, essayAnswers: [], student: { id: "student", user: { firstName: "Ana", lastName: "Fixture" } }, program: { programName: "Synthetic", examEssayTotal: 1000, examMcqTotal: 1000 }, slot: { examDate: "2026-11-01T00:00:00Z", examTime: "1970-01-01T09:00:00Z" } };
  invalidate.mockResolvedValue(undefined); setData.mockImplementation((_key, updater) => { record = updater(record); });
});
describe("B7 existing Exam Record evaluation UI", () => {
  it.each(["PASSED","FAILED"])("B8 %s uses the same fractional breakdown and hides pending/recovery wording", status => {
    record.status = status; record.resultEmailEligible = true;
    record.result = { provenance: "B8", status: status.toLowerCase(), mcqScore: "0.125", mcqTotal: "0.125", essayScore: "0.25", essayTotal: "0.375", totalScore: "0.375", totalPossible: "0.5", percentage: "75.00", passingThreshold: "75", mcqCorrectCount: 1, mcqQuestionCount: 1, scoredAt: "2026-11-05T00:00:00Z" };
    record.essayEvaluation = evaluation({ status: "COMPLETED", essayScore: 0.25, maximumScore: 0.375 });
    cursor = 0; const html = renderToStaticMarkup(page());
    for (const text of ["0.125 / 0.125","0.25 / 0.375","0.375 / 0.5","75.00%","75%","Send Result Email","Existing Start Authorization"]) expect(html).toContain(text);
    expect(html).not.toMatch(/Final Result Pending|Finalize Result|1000/);
  });
  it("B8 partial evidence hides the email action and shows staff review", () => {
    record.status = "FAILED"; record.essayEvaluation = { status: "STAFF_REVIEW", reason: "Staff review required" };
    cursor = 0; const html = renderToStaticMarkup(page());
    expect(html).toContain("Result evidence requires staff review"); expect(html).not.toContain("Send Result Email");
  });
  it("renders frozen prompt, exact response and captured maximum without mutable Program authority", () => {
    const html = renderToStaticMarkup(renderPanel()); expect(html).toContain("Frozen essay prompt"); expect(html).toContain("Exact response\nwith spaces  "); expect(html).toContain("/ 25.5"); expect(html).not.toContain("1000");
    const control = input(renderPanel()); expect(control.props.step).toBe("any"); expect(control.props.inputMode).toBe("decimal"); expect(save(renderPanel()).props.disabled).toBe(true);
  });
  it.each([null, "", "   \n"])("missing/blank response %# says no response, requires explicit score", value => {
    record.essayEvaluation.responseText = value; const tree = renderPanel(); expect(renderToStaticMarkup(tree)).toContain("No response submitted."); expect(input(tree).props.value).toBe(""); expect(save(tree).props.disabled).toBe(true);
  });
  it.each(["0", "18.25", "25.5"])("explicit score %s sends JSON number and suppresses repeated clicks", async value => {
    input(renderPanel()).props.onChange({ target: { value } }); const tree = renderPanel(); expect(save(tree).props.disabled).toBe(false);
    save(tree).props.onClick(); save(tree).props.onClick(); expect(mutate).toHaveBeenCalledTimes(1);
    await mutation.mutationFn(); expect(request).toHaveBeenCalledWith("/exam/scores/application/grade", { method: "POST", body: JSON.stringify({ essayScore: Number(value) }) });
  });
  it.each(["26", "-1", "Infinity", "NaN", "  "])("invalid score %s disables save", value => {
    input(renderPanel()).props.onChange({ target: { value } }); expect(save(renderPanel()).props.disabled).toBe(true);
  });
  it.each([null, 0, -1, Infinity, "25"])("invalid captured maximum %# disables grading", maximumScore => {
    record.essayEvaluation.maximumScore = maximumScore; input(renderPanel()).props.onChange({ target: { value: "0" } });
    expect(input(renderPanel()).props.disabled).toBe(true); expect(save(renderPanel()).props.disabled).toBe(true);
  });
  it.each(["STAFF_REVIEW", "LEGACY", "UNAVAILABLE"])("%s has no grading control", status => {
    record.essayEvaluation = { status, reason: "Staff review required" }; expect(input(renderPanel())).toBeUndefined(); expect(save(renderPanel())).toBeUndefined();
  });
  it("successful authoritative evaluation immediately replaces editing with score/evaluator/time and refreshes exact record/list", async () => {
    renderPanel(); const completed = evaluation({ status: "COMPLETED", essayScore: 0, evaluator: { firstName: "Maria", lastName: "Admin" }, evaluatedAt: "2026-11-04T12:00:00Z" });
    mutation.onSuccess({ ...completed, result: { provenance: "B8", status: "failed", mcqScore: "0", mcqTotal: "2", essayScore: "0", essayTotal: "25.5", totalScore: "0", totalPossible: "27.5", passingThreshold: "75", percentage: "0.00", scoredAt: null, mcqCorrectCount: 0, mcqQuestionCount: 1 } }); await mutation.onSettled(); const tree = renderPanel(), html = renderToStaticMarkup(tree);
    expect(html).toContain("Evaluated on"); expect(html).not.toContain("Final Result Pending"); expect(html).toContain("0 / 25.5"); expect(html).toContain("Maria Admin"); expect(html).toContain("Nov 4, 2026");
    expect(input(tree)).toBeUndefined(); expect(save(tree)).toBeUndefined(); expect(invalidate).toHaveBeenCalledWith({ queryKey: ["examRecord", "application"] }); expect(invalidate).toHaveBeenCalledWith({ queryKey: ["examRecords"] });
  });
  it("conflict/lost-response settlement refreshes authority before another attempt", async () => {
    renderPanel(); mutation.onError(new Error("Already evaluated")); await mutation.onSettled(); expect(failure).toHaveBeenCalledWith("Already evaluated"); expect(invalidate).toHaveBeenCalledWith({ queryKey: ["examRecord", "application"] });
  });
  it("in-flight save disables input and action", () => { pending = true; expect(input(renderPanel()).props.disabled).toBe(true); expect(save(renderPanel()).props.disabled).toBe(true); });
  it.each([false, true])("detail preserves Start Authorization; B7 completion=%s has no final result/email", completed => {
    if (completed) record.essayEvaluation = evaluation({ status: "COMPLETED", essayScore: 18, evaluator: { firstName: "Admin", lastName: "Fixture" }, evaluatedAt: "2026-11-04T12:00:00Z" });
    cursor = 0; const html = renderToStaticMarkup(page());
    expect(html).toContain("Existing Start Authorization"); expect(html).not.toContain("Send Result Email"); expect(html).not.toMatch(/>Passed<|>Failed</);
    expect(html).toContain(completed ? "Essay Evaluated — Final Result Pending" : "Needs Essay Grading");
    if (completed) expect(html).not.toContain("Needs Essay Grading");
  });
  it("list presentation distinguishes evaluated TAKEN without persisted status change", () => {
    expect(statesHelper.deriveExamState("TAKEN", false)).toBe("NEEDS_GRADING"); expect(statesHelper.deriveExamState("TAKEN", true)).toBe("FINAL_RESULT_PENDING");
  });
});
