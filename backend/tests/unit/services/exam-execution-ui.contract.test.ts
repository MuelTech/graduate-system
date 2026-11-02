// Controlled React component/handler contracts. No manual/browser QA claim.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as executionHelpers from "../../../../frontend/src/lib/exam-execution";
import * as scheduleHelpers from "../../../../frontend/src/lib/admin-exam-schedules";
import type { ExamExecution } from "../../../../frontend/src/lib/exam-execution";
const requireFrontend = createRequire(path.resolve("../frontend/package.json"));
const { createElement } = requireFrontend("react");
const { renderToStaticMarkup } = requireFrontend("react-dom/server");
let states: any[], cursor: number, queries: any[], mutations: any[], queryResult: any, questions: any[], pending: boolean;
const request = vi.fn(), mutate = vi.fn(), refetch = vi.fn(), invalidate = vi.fn();
const primitive = (name: string) => ({ children }: any) => createElement(name, {}, children);
const primitives = (names: string[]) => Object.fromEntries(names.map(name => [name, primitive("div")]));
const modules: Record<string, any> = {
  "react/jsx-runtime": requireFrontend("react/jsx-runtime"),
  react: {
    useState: (initial: any) => { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], (v: any) => { states[i] = typeof v === "function" ? v(states[i]) : v; }]; },
    useRef: (initial: any) => { const i = cursor++; return states[i] ??= { current: initial }; }, useEffect: () => {},
  },
  "@tanstack/react-query": {
    useQuery: (options: any) => { queries.push(options); return options.queryKey[0] === "applicant-bound-exam-questions" ? { data: questions } : queryResult; },
    useMutation: (options: any) => { mutations.push(options); return { isPending: pending, mutate, reset: vi.fn() }; },
    useQueryClient: () => ({ invalidateQueries: invalidate }),
  },
  "@/lib/api.client": { apiClientRequest: request }, "@/lib/exam-execution": executionHelpers, "@/lib/admin-exam-schedules": scheduleHelpers,
  "@/lib/applicant-exam-content": { withApplicantAnswer: (before: any, id: string, option: string) => ({ ...before, [id]: option }) },
  "@/components/ui/button": { Button: primitive("button") }, "@/components/ui/card": primitives(["Card", "CardContent", "CardHeader", "CardTitle"]),
  "@/components/ui/dialog": primitives(["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription", "DialogFooter"]),
  "@/components/ui/badge": primitives(["Badge"]), "@/components/ui/alert": primitives(["Alert", "AlertDescription"]), "@/components/ui/skeleton": primitives(["Skeleton"]),
  "@/components/ui/page-header": { PageHeader: ({ title }: any) => createElement("h1", {}, title) },
  "@/components/exam-content/applicant-question-renderer": { ApplicantQuestionRenderer: primitive("div") }, "@/components/exam-content/semantic-text": { SemanticText: primitive("span") },
  "@/components/exam-content/stimulus-renderer": primitives(["StimulusRenderer"]), "@/components/exam-content/exam-execution-context": { ExamExecutionContext: { Provider: primitive("div") } },
  "next/link": { __esModule: true, default: primitive("a") }, "lucide-react": new Proxy({}, { get: () => primitive("i") }),
  "next-auth/react": { useSession: () => ({ data: { user: { id: "synthetic-user" } } }) },
};
const applicantSource = readFileSync("../frontend/src/app/(portal)/applicant/exam/page.tsx", "utf8");
const adminSource = readFileSync("../frontend/src/components/admin/exam/start-authorization.tsx", "utf8");
function compile(source: string) {
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports: any = {}; new Function("require", "exports", code)((name: string) => { if (!(name in modules)) throw new Error(name); return modules[name]; }, exports); return exports;
}
const applicant = compile(applicantSource).default, admin = compile(adminSource).StartAuthorization;
const props = { applicationId: "exact-application", applicantName: "Ada Fixture" };
function render(component = applicant) { cursor = 0; queries = []; mutations = []; return component(props); }
function nodes(tree: any): any[] { if (Array.isArray(tree)) return tree.flatMap(nodes); if (!tree?.props) return []; return [tree, ...nodes(tree.props.children)]; }
function text(tree: any): string { if (Array.isArray(tree)) return tree.map(text).join(""); if (tree == null || typeof tree === "boolean") return ""; return typeof tree === "object" ? text(tree.props?.children) : String(tree); }
function button(tree: any, label: string) { const node = nodes(tree).find(n => text(n) === label && typeof n.props.onClick === "function"); if (!node) throw new Error(`Missing ${label}`); return node; }
function execution(patch: Partial<ExamExecution> = {}): ExamExecution {
  return { applicationId: props.applicationId, applicationStatus: "PENDING", state: "READY", reason: null, canStart: true, canAuthorize: true,
    serverNow: "2026-11-03T02:17:00Z", actualStartedAt: null, deadlineAt: null, remainingSeconds: 0, durationMinutes: null, contentRevisionId: null, authorization: null,
    appointment: { examDate: "2026-11-03T00:00:00Z", examTime: "1970-01-01T09:00:00Z", programName: "Synthetic Program" }, ...patch };
}
beforeEach(() => {
  vi.clearAllMocks(); states = []; cursor = 0; queries = []; mutations = []; pending = false; questions = [];
  queryResult = { data: { execution: execution(), receivedAt: 100 }, refetch }; refetch.mockResolvedValue({ isError: false });
});
describe("B4 Applicant server execution UI", () => {
  it("pre-start displays original appointment and explicit Start without fetching protected content", () => {
    const tree = render(); expect(text(tree)).toContain("Examination not started."); expect(text(tree)).toContain("9:00 AM"); expect(button(tree, "Start Examination").props.disabled).toBe(false); expect(queries[1].enabled).toBe(false);
    expect(renderToStaticMarkup(tree)).toContain("Answers are not restored after refresh");
  });
  it("does not unlock from device time when the server blocks early entry", () => {
    queryResult.data.execution = execution({ state: "BLOCKED", canStart: false, reason: "Scheduled time has not arrived" });
    expect(button(render(), "Start Examination").props.disabled).toBe(true);
  });
  it("Start is an exact authenticated mutation with synchronous repeated-click suppression", async () => {
    const tree = render(); button(tree, "Start Examination").props.onClick(); button(tree, "Start Examination").props.onClick(); expect(mutate).toHaveBeenCalledTimes(1);
    await mutations[0].mutationFn(); expect(request).toHaveBeenCalledWith("/exam-engine/applications/exact-application/start", { method: "POST", body: "{}" });
    await mutations[0].onSettled(); expect(refetch).toHaveBeenCalled();
  });
  it("pending Start disables action and changing server authorization never implies started", () => {
    pending = true; queryResult.data.execution.authorization = { authorizedAt: "2026-11-03T01:00:00Z", authorizedBy: null };
    const tree = render(); expect(button(tree, "Starting…").props.disabled).toBe(true); expect(text(tree)).toContain("Your timer has not started");
  });
  it("started render restores the server deadline, bound content and exact media context", () => {
    queryResult.data.execution = execution({ state: "ACTIVE", actualStartedAt: "2026-11-03T02:17:00Z", deadlineAt: "2026-11-03T04:17:00Z", contentRevisionId: "revision1", remainingSeconds: 7200 });
    const tree = render(); expect(text(tree)).toContain("02:00:00"); expect(tree.props.value).toBe(props.applicationId); expect(queries[1].enabled).toBe(true); expect(text(tree)).toContain("Deadline:");
  });
  it("a second render/device clock sample keeps the same deadline with less time", () => {
    const data = execution({ state: "ACTIVE", deadlineAt: "2026-11-03T04:17:00Z" });
    expect(executionHelpers.executionSeconds({ execution: data, receivedAt: 100 }, 60100)).toBe(7140);
    const reopened = { ...data, serverNow: "2026-11-03T02:18:00Z" };
    expect(executionHelpers.executionSeconds({ execution: reopened, receivedAt: 10 }, 10)).toBe(7140); expect(reopened.deadlineAt).toBe(data.deadlineAt);
    const clockSpy = vi.spyOn(Date, "now").mockReturnValue(0); expect(executionHelpers.executionSeconds({ execution: data, receivedAt: 100 }, 60100)).toBe(7140); clockSpy.mockRestore();
  });
  it("refresh query pins the exact application and polls/resynchronizes without Starting", async () => {
    render(); request.mockResolvedValueOnce(execution()); await queries[0].queryFn(); render(); request.mockResolvedValueOnce(execution()); await queries[0].queryFn();
    expect(request.mock.calls.map(c => c[0])).toEqual(["/exam-engine/execution", "/exam-engine/applications/exact-application/execution"]); expect(queries[0].refetchInterval).toBe(15000); expect(queries[0].refetchOnReconnect).toBe("always"); expect(mutate).not.toHaveBeenCalled();
  });
  it.each(["EXPIRED", "LEGACY_UNBOUND", "TERMINAL"] as const)("%s never renders active exam controls", state => {
    queryResult.data.execution = execution({ state }); const tree = render(); expect(text(tree)).not.toContain("Start Examination"); expect(queries[1].enabled).toBe(false);
  });
  it("deadline zero and failed synchronization lock access without claiming timeout submission", () => {
    queryResult.data.execution = execution({ state: "ACTIVE", deadlineAt: "2026-11-03T02:17:00Z" }); expect(text(render())).toContain("Automatic submission and a final receipt are not available yet");
    queryResult.isError = true; expect(text(render())).toContain("Reconnect and refresh");
  });
  it("blocked started records retain recorded timing instead of claiming not started", () => {
    queryResult.data.execution = execution({ state: "BLOCKED", actualStartedAt: "2026-11-03T02:17:00Z", deadlineAt: "2026-11-03T04:17:00Z", reason: "Contact staff" });
    const tree = render(); expect(text(tree)).toContain("Your recorded start"); expect(text(tree)).not.toContain("Examination not started");
  });
  it("removes independent duration, live-bank start, local clock authority and answer-recovery claims", () => {
    expect(applicantSource).not.toMatch(/10800|3 Hours|3-hour|new Date\(\)|Date\.now\(|\/exam-engine\/questions/);
    expect(applicantSource).toContain("performance.now()"); expect(applicantSource).toContain('window.addEventListener("online"'); expect(applicantSource).toContain('document.addEventListener("visibilitychange"');
    expect(applicantSource).not.toMatch(/localStorage|hydrate|savedAnswers/);
  });
});
describe("B4 exact per-record Admin start authorization", () => {
  it("belongs to individual detail and confirms the exact Applicant with unchanged appointment/timer consequence", () => {
    queryResult.data = execution(); let tree = render(admin); button(tree, "Authorize Start Now").props.onClick(); tree = render(admin);
    expect(text(tree)).toContain("Authorize Start Now for Ada Fixture?"); expect(text(tree)).toContain("The timer begins only when this Applicant clicks Start Examination today");
    const source = readFileSync("../frontend/src/app/(portal)/admin/exam/applications/[id]/page.tsx", "utf8"); expect(source.replace(/\s+/g, " ")).toContain("<StartAuthorization applicationId={applicationId} applicantName={fullName}");
  });
  it("sends exact authorization mutation once and refreshes per-record status", async () => {
    queryResult.data = execution(); const tree = render(admin); const confirm = nodes(tree).filter(n => text(n) === "Authorize Start Now" && n.props.onClick).at(-1); confirm.props.onClick(); confirm.props.onClick(); expect(mutate).toHaveBeenCalledTimes(1);
    await mutations[0].mutationFn(); expect(request).toHaveBeenCalledWith("/exam-engine/admin/applications/exact-application/start-authorization", { method: "POST", body: "{}" }); await mutations[0].onSuccess(); expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin-exam-execution", props.applicationId] });
  });
  it("shows actor/time and Authorized separately from actual Not started", () => {
    queryResult.data = execution({ authorization: { authorizedAt: "2026-11-03T01:00:00Z", authorizedBy: { id: "a", firstName: "Admin", lastName: "Fixture" } } });
    expect(text(render(admin))).toContain("Authorized by Admin Fixture"); expect(text(render(admin))).toContain("The Applicant has not started");
    queryResult.data = execution({ actualStartedAt: "2026-11-03T02:17:00Z", deadlineAt: "2026-11-03T04:17:00Z", canAuthorize: false });
    const tree = render(admin); expect(text(tree)).toContain("Individual deadline"); expect(text(tree)).not.toContain("The Applicant has not started");
  });
});
