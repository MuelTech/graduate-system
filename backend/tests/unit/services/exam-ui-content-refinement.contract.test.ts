// Actual component composition with controlled API responses; no browser QA claim.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as states from "../../../../frontend/src/lib/exam-record-state";
import * as schedules from "../../../../frontend/src/lib/admin-exam-schedules";
import * as executionHelpers from "../../../../frontend/src/lib/exam-execution";

const frontend = createRequire(path.resolve("../frontend/package.json"));
const React = frontend("react");
const { renderToStaticMarkup } = frontend("react-dom/server");
const tag = (name: string) => ({ children }: any) => React.createElement(name, {}, children);
const primitive = (names: string[]) => Object.fromEntries(names.map(name => [name, tag("div")]));
let record: any, execution: any, applicantResult: any;
const modules: Record<string, any> = {
  react: React,
  "react/jsx-runtime": frontend("react/jsx-runtime"),
  "@tanstack/react-query": {
    useQuery: ({ queryKey }: any) => ({ data: queryKey[0] === "examRecord" ? record : queryKey[0] === "examResult" ? applicantResult : execution }),
    useMutation: () => ({ isPending: false, mutate: vi.fn() }),
    useQueryClient: () => ({ invalidateQueries: vi.fn(), setQueryData: vi.fn() }),
  },
  "@/lib/api.client": { apiClientRequest: vi.fn(), ApiError: class extends Error {} },
  "@/lib/utils": { cn: (...values: string[]) => values.join(" ") },
  "@/lib/exam-record-state": states,
  "@/lib/admin-exam-schedules": schedules,
  "@/lib/exam-execution": executionHelpers,
  "next/navigation": { useParams: () => ({ id: "record" }) },
  "next-auth/react": { useSession: () => ({ data: { user: { id: "applicant" } } }) },
  "next/link": { __esModule: true, default: ({ children, ...props }: any) => React.createElement("a", props, children) },
  "@/components/ui/button": { Button: tag("button"), buttonVariants: () => "button" },
  "@/components/ui/card": primitive(["Card", "CardContent", "CardHeader", "CardTitle"]),
  "@/components/ui/input": { Input: tag("input") },
  "@/components/ui/textarea": { Textarea: tag("textarea") },
  "@/components/ui/label": { Label: tag("label") },
  "@/components/ui/badge": { Badge: tag("span") },
  "@/components/ui/skeleton": { Skeleton: () => null },
  "@/components/ui/breadcrumb": { Breadcrumb: () => null },
  "@/components/ui/page-header": { PageHeader: ({ title, description, actions }: any) => React.createElement("header", {}, React.createElement("h1", {}, title), description, actions) },
  "@/components/ui/dialog": {
    ...primitive(["DialogContent", "DialogHeader", "DialogTitle", "DialogDescription", "DialogFooter"]),
    Dialog: ({ open, children }: any) => open ? children : null,
  },
  "@/components/exam-content/semantic-text": { SemanticText: ({ text }: any) => text },
  "@/components/exam-content/stimulus-renderer": { StimulusRenderer: () => null },
  sonner: { toast: { success: vi.fn(), error: vi.fn() } },
  "lucide-react": new Proxy({}, { get: () => () => null }),
};
function load(file: string) {
  const code = ts.transpileModule(readFileSync(`../frontend/src/${file}`, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports: any = {};
  new Function("require", "exports", code)((name: string) => {
    if (!(name in modules)) throw new Error(`Unexpected UI dependency: ${name}`);
    return modules[name];
  }, exports);
  return exports;
}
for (const file of [
  "components/exam-content/result-breakdown",
  "components/admin/exam/start-authorization",
  "components/admin/exam/exam-record-actions",
  "components/admin/exam/essay-evaluation-panel",
]) modules[`@/${file}`] = load(`${file}.tsx`);
const Admin = load("app/(portal)/admin/exam/applications/[id]/page.tsx").default;
const Applicant = load("app/(portal)/applicant/results/page.tsx").default;
const render = (component = Admin) => renderToStaticMarkup(React.createElement(component));
const count = (html: string, value: string) => html.split(value).length - 1;

beforeEach(() => {
  const result = {
    provenance: "B8", status: "failed", computedStatus: "failed", effectiveStatus: "failed",
    institutionalDecision: null, mcqScore: "0.125", mcqTotal: "0.25", essayScore: "0.125", essayTotal: "0.25",
    totalScore: "0.25", totalPossible: "0.5", percentage: "50.00", passingThreshold: "75",
    mcqCorrectCount: 1, mcqQuestionCount: 2, scoredAt: "2026-11-05T03:00:00Z",
  };
  record = {
    id: "record", status: "FAILED", effectiveStatus: "failed", result, canAmendAppointment: false,
    canReconsiderResult: true, reconsideration: null, resultEmailEligible: false,
    student: { id: "student", pinnacleApplicantId: "PIN-123", user: { firstName: "Ana", lastName: "Fixture" } },
    program: { programName: "Unique Program" },
    slot: { examDate: "2026-11-05T00:00:00Z", examTime: "1970-01-01T09:00:00Z" },
    essayEvaluation: {
      status: "COMPLETED", question: { questionText: "Exact essay prompt" }, responseText: "Exact response\nwith spaces  ",
      maximumScore: 0.25, essayScore: 0.125, evaluator: { firstName: "Eva", lastName: "Admin" }, evaluatedAt: "2026-11-05T03:00:00Z",
    },
  };
  execution = {
    state: "TERMINAL", appointment: { ...record.slot }, actualStartedAt: "2026-11-05T01:00:00Z",
    deadlineAt: "2026-11-05T03:00:00Z", authorization: null, canAuthorize: false,
  };
  applicantResult = { ...result, examDate: record.slot.examDate };
});

describe("EXAM-B10-MQA-UI complete record composition", () => {
  it("gives identity, result, timing, essay and reconsideration distinct ordered homes", () => {
    const html = render();
    const ordered = ["Ana Fixture", "Examination Result", "Exam Timing", "Essay Evaluation", "Reconsideration"];
    for (let i = 1; i < ordered.length; i++) expect(html.indexOf(ordered[i])).toBeGreaterThan(html.indexOf(ordered[i - 1]));
    expect(count(html, "Unique Program")).toBe(1);
    expect(count(html, "November 5, 2026")).toBe(1);
    expect(count(html, "Computed Result")).toBe(1);
    expect(count(html, ">Failed<")).toBe(1);
    expect(html).toContain("0.25 / 0.5");
    expect(html).toContain("Exact response\nwith spaces  ");
    expect(html).not.toMatch(/Current Exam State|Exam Information|Institutional Decision|display rounded|exact score comparison|Not authorized|Original appointment|Actual examination start|Individual deadline/);
  });
  it("separates one immutable FAILED from the current reconsidered final decision", () => {
    record.effectiveStatus = "passed_reconsidered";
    record.canReconsiderResult = false;
    record.reconsideration = { reason: "Reviewed justification", decidedAt: "2026-11-05T04:00:00Z", decidedBy: { firstName: "Dean", lastName: "Fixture" } };
    record.result.institutionalDecision = { decision: "PASSED_RECONSIDERED", decidedAt: record.reconsideration.decidedAt };
    const before = JSON.stringify(record.result), html = render();
    expect(count(html, "Final Decision: Passed — Reconsidered")).toBe(1);
    expect(count(html, "Computed Result")).toBe(1);
    expect(count(html, "FAILED")).toBe(1);
    expect(html).toContain("Reviewed justification"); expect(html).toContain("Dean Fixture");
    expect(html).toContain("Decision date"); expect(html).not.toContain("Reconsider Result");
    expect(JSON.stringify(record.result)).toBe(before);
  });
  it.each(["PENDING", "TAKEN", "PASSED"])("%s without reconsideration authority omits the exception section", status => {
    record.status = status; record.canReconsiderResult = false;
    if (status !== "PASSED") record.result = null;
    if (status === "PENDING") record.essayEvaluation = null;
    if (status === "TAKEN") record.essayEvaluation.status = "PENDING";
    const html = render(); expect(html).not.toContain("Reconsideration");
    if (status === "PENDING") expect(html).not.toContain("Essay Evaluation");
    if (status === "TAKEN") { expect(html).toContain("Save Essay Evaluation"); expect(html).not.toContain("Computed Result"); }
  });
  it("keeps early-start evidence operational before start and out of normal started timing", () => {
    execution.authorization = { authorizedAt: "2026-11-05T00:30:00Z", authorizedBy: { firstName: "Start", lastName: "Admin" } };
    expect(render()).not.toContain("Authorized by Start Admin");
    execution.actualStartedAt = null; execution.deadlineAt = null; execution.state = "READY";
    const html = render(); expect(html).toContain("Authorized by Start Admin"); expect(html).toContain("Not started");
    expect(html).not.toContain("Not authorized");
  });
  it("keeps historical unknowns truthful without inventing start times or score limits", () => {
    execution.state = "LEGACY_UNBOUND"; execution.actualStartedAt = null; execution.deadlineAt = null;
    Object.assign(record.result, { provenance: "LEGACY", mcqTotal: null, essayTotal: null, totalPossible: null, percentage: null, passingThreshold: null, scoredAt: null });
    const html = render(); expect(html).toContain("Not recorded for this legacy examination");
    expect(html).toContain("Historical result."); expect(html).not.toContain("Score percentage");
  });
});

describe("shared Applicant result breakdown regression", () => {
  it.each(["B8", "LEGACY"])("%s retains server numbers and computed outcome without technical rounding narration", provenance => {
    applicantResult.provenance = provenance;
    const before = JSON.stringify(applicantResult), html = render(Applicant);
    for (const value of ["0.125 / 0.25", "0.25 / 0.5", "50.00%", "75%", "Computed Result"]) expect(html).toContain(value);
    expect(html).not.toMatch(/display rounded|exact score comparison/);
    expect(JSON.stringify(applicantResult)).toBe(before);
  });
});
