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
let draftState: any;
const draftChange = vi.fn(), draftFlush = vi.fn(), draftPrepare = vi.fn(), draftResync = vi.fn();
const draftQueue = { snapshot: () => draftState, subscribe: () => () => {}, activate: vi.fn(), pause: vi.fn(), change: draftChange, flush: draftFlush, prepare: draftPrepare, resync: draftResync };
const primitive = (name: string) => ({ children }: any) => createElement(name, {}, children);
const primitives = (names: string[]) => Object.fromEntries(names.map(name => [name, primitive("div")]));
const modules: Record<string, any> = {
  "react/jsx-runtime": requireFrontend("react/jsx-runtime"),
  react: {
    useState: (initial: any) => { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], (v: any) => { states[i] = typeof v === "function" ? v(states[i]) : v; }]; },
    useRef: (initial: any) => { const i = cursor++; return states[i] ??= { current: initial }; }, useEffect: () => {},
    useMemo: (factory: any) => { const i = cursor++; return states[i] ??= factory(); },
    useSyncExternalStore: (_subscribe: any, snapshot: any) => snapshot(),
  },
  "@tanstack/react-query": {
    useQuery: (options: any) => { queries.push(options); return options.queryKey[0] === "applicant-bound-exam-questions" ? { data: questions } : queryResult; },
    useMutation: (options: any) => { mutations.push(options); return { isPending: pending, mutate, reset: vi.fn() }; },
    useQueryClient: () => ({ invalidateQueries: invalidate }),
  },
  "@/lib/api.client": { apiClientRequest: request }, "@/lib/exam-execution": executionHelpers, "@/lib/admin-exam-schedules": scheduleHelpers,
  "@/lib/applicant-exam-content": { withApplicantAnswer: (before: any, id: string, option: string) => ({ ...before, [id]: option }) },
  "@/lib/exam-drafts": { ExamDraftQueue: class { constructor() { return draftQueue; } }, draftStatusText: { saved: "Saved", unsaved: "Unsaved changes", saving: "Saving…", error: "Save failed", conflict: "Answers changed elsewhere" } },
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
  draftState = { values: {}, status: "saved", ready: true }; draftPrepare.mockResolvedValue(true);
  queryResult = { data: { execution: execution(), receivedAt: 100 }, refetch }; refetch.mockResolvedValue({ isError: false });
});
describe("B4 Applicant server execution UI", () => {
  it("pre-start displays original appointment and explicit Start without fetching protected content", () => {
    const tree = render(); expect(text(tree)).toContain("Examination not started."); expect(text(tree)).toContain("9:00 AM"); expect(button(tree, "Start Examination").props.disabled).toBe(false); expect(queries[1].enabled).toBe(false);
    expect(renderToStaticMarkup(tree)).toContain("saved answers");
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
    queryResult.data.execution = execution({ state: "ACTIVE", deadlineAt: "2026-11-03T02:17:00Z" }); expect(text(render())).toContain("Submission is confirmed only when your receipt is available");
    queryResult.isError = true; expect(text(render())).toContain("Reconnect and refresh");
  });
  it("blocked started records retain recorded timing instead of claiming not started", () => {
    queryResult.data.execution = execution({ state: "BLOCKED", actualStartedAt: "2026-11-03T02:17:00Z", deadlineAt: "2026-11-03T04:17:00Z", reason: "Contact staff" });
    const tree = render(); expect(text(tree)).toContain("Your recorded start"); expect(text(tree)).not.toContain("Examination not started");
  });
  it("preserves B4 duration/content authority while B5 adds acknowledged draft recovery", () => {
    expect(applicantSource).not.toMatch(/10800|3 Hours|3-hour|new Date\(\)|Date\.now\(|\/exam-engine\/questions/);
    expect(applicantSource).toContain("performance.now()"); expect(applicantSource).toContain('window.addEventListener("online"'); expect(applicantSource).toContain('document.addEventListener("visibilitychange"');
    expect(applicantSource).not.toMatch(/localStorage|sessionStorage|indexedDB/);
    expect(applicantSource).toContain("ExamDraftQueue");
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

describe("B5 Applicant component and submission contracts", () => {
  function activePage() {
    queryResult.data.execution = execution({ state: "ACTIVE", actualStartedAt: "2026-11-03T02:17:00Z", deadlineAt: "2026-11-03T04:17:00Z", contentRevisionId: "revision1" });
    questions = [{ id: "q", type: "MULTIPLE_CHOICE", options: [], questionText: "Synthetic MCQ" }, { id: "e", type: "ESSAY", options: [], questionText: "Synthetic essay" }];
    return render();
  }
  it("hydrates MCQ renderer selection, essay and answered navigator from the queue", () => {
    draftState.values = { q: { selectedOptionId: "option-a" }, e: { essayAnswer: "saved essay" } };
    const tree = activePage(); const renderer = nodes(tree).find(n => n.props?.selectedOptionId);
    expect(renderer.props.selectedOptionId).toBe("option-a"); expect(text(tree)).toContain("1 / 1");
    button(tree, "Essay Question").props.onClick(); const textarea = nodes(render()).find(n => n.type === "textarea"); expect(textarea.props.value).toBe("saved essay");
    textarea.props.onChange({ target: { value: "" } }); expect(draftChange).toHaveBeenCalledWith("e", { essayAnswer: "" }); textarea.props.onBlur(); expect(draftFlush).toHaveBeenCalled();
  });
  it("MCQ selection/change and clear use exact opaque IDs and explicit null", () => {
    draftState.values = { q: { selectedOptionId: "option-a" } }; const tree = activePage();
    nodes(tree).find(n => n.props?.onSelect).props.onSelect("option-b"); expect(draftChange).toHaveBeenCalledWith("q", { selectedOptionId: "option-b" });
    button(tree, "Clear answer").props.onClick(); expect(draftChange).toHaveBeenCalledWith("q", { selectedOptionId: null });
  });
  it.each(["unsaved", "saving", "saved", "error", "conflict"])("shows %s without hidden revision numbers", status => {
    draftState.status = status; const tree = activePage(); expect(nodes(tree).some(n => n.props.role === "status")).toBe(true);
    if (status === "error") { button(tree, "Retry save").props.onClick(); expect(draftPrepare).toHaveBeenCalled(); }
    if (status === "conflict") { expect(nodes(tree).find(n => n.type === "fieldset").props.disabled).toBe(true); button(tree, "Refresh saved answers").props.onClick(); expect(draftResync).toHaveBeenCalledWith(true); }
    expect(text(tree)).not.toContain("revision");
  });
  it("guards confirmation until pending drafts drain and blocks unresolved conflict", async () => {
    let resolve!: (v: boolean) => void; draftPrepare.mockReturnValue(new Promise(done => { resolve = done; }));
    let tree = activePage(); const pending = button(tree, "Submit Exam").props.onClick(); tree = render();
    expect(nodes(tree).find(n => n.type === modules["@/components/ui/dialog"].Dialog).props.open).toBe(false);
    expect(nodes(tree).find(n => n.type === "fieldset").props.disabled).toBe(true);
    resolve(false); await Promise.resolve(); await Promise.resolve(); await pending;
    expect(nodes(render()).find(n => n.type === modules["@/components/ui/dialog"].Dialog).props.open).toBe(false);
  });
  it("final submission rechecks/drains drafts and sends only incomplete confirmation", async () => {
    draftState.values = { q: { selectedOptionId: "option-a" }, e: { essayAnswer: "" } }; let tree = activePage();
    button(tree, "Submit Exam").props.onClick(); await Promise.resolve(); await Promise.resolve(); tree = render();
    expect(nodes(tree).find(n => n.type === modules["@/components/ui/dialog"].Dialog).props.open).toBe(true);
    await button(tree, "Yes, Submit Exam").props.onClick(); expect(draftPrepare).toHaveBeenCalledTimes(2); expect(mutate).toHaveBeenCalledOnce();
    await mutations[1].mutationFn(true); expect(JSON.parse(request.mock.calls.at(-1)![1].body)).toEqual({ acknowledgeIncomplete: true });
  });
  it("does not keep protected content in local persistent caches or retain the transitional interval", () => {
    const source = readFileSync("../frontend/src/lib/exam-drafts.ts", "utf8") + applicantSource;
    expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB|60_000|sendBeacon/);
    expect(source).toContain('"visibilitychange"'); expect(source).toContain('"focus"'); expect(source).toContain("drafts.pause()");
  });
});


describe("B6 Applicant finalization and recovery", () => {
  const receipt = { receiptId: "stable-receipt", applicationId: props.applicationId, finalizationReason: "APPLICANT_SUBMITTED", finalizedAt: "2026-11-03T03:17:00Z", actualStartedAt: "2026-11-03T02:17:00Z", deadlineAt: "2026-11-03T04:17:00Z", contentRevisionId: "revision1", answeredCount: 1, unansweredCount: 1, questionCount: 2 };
  function activePage() {
    queryResult.data.execution = execution({ state: "ACTIVE", actualStartedAt: receipt.actualStartedAt, deadlineAt: receipt.deadlineAt, contentRevisionId: "revision1" });
    questions = [{ id: "q", type: "MULTIPLE_CHOICE", options: [], questionText: "Synthetic MCQ" }, { id: "e", type: "ESSAY", options: [], questionText: "Synthetic essay" }];
    return render();
  }
  it("incomplete confirmation warns unanswered items remain unanswered", async () => {
    let tree = activePage(); button(tree, "Submit Exam").props.onClick(); await Promise.resolve(); await Promise.resolve(); tree = render();
    expect(text(tree)).toContain("2 questions are unanswered"); expect(text(tree)).toContain("confirm incomplete submission");
    await button(tree, "Yes, Submit Exam").props.onClick(); expect(mutate).toHaveBeenCalledWith(true);
  });
  it("complete answers submit without an incomplete warning", async () => {
    draftState.values = { q: { selectedOptionId: "option" }, e: { essayAnswer: "actual answer" } };
    let tree = activePage(); button(tree, "Submit Exam").props.onClick(); await Promise.resolve(); await Promise.resolve(); tree = render();
    expect(text(tree)).not.toContain("questions are unanswered"); await button(tree, "Yes, Submit Exam").props.onClick(); expect(mutate).toHaveBeenCalledWith(false);
  });
  it("locks answer editing during pending commit and blocks duplicate final clicks", async () => {
    let tree = activePage(); button(tree, "Submit Exam").props.onClick(); await Promise.resolve(); await Promise.resolve(); tree = render();
    await button(tree, "Yes, Submit Exam").props.onClick(); await button(tree, "Yes, Submit Exam").props.onClick(); expect(mutate).toHaveBeenCalledOnce();
    expect(nodes(render()).find(n => n.type === "fieldset").props.disabled).toBe(true);
  });
  it.each(["APPLICANT_SUBMITTED", "TIME_EXPIRED"])("reopen %s shows authoritative receipt and no editable questions", reason => {
    queryResult.data.execution = execution({ state: "TERMINAL", finalization: { ...receipt, finalizationReason: reason as any } });
    const tree = render(); expect(text(tree)).toContain("stable-receipt"); expect(text(tree)).toContain("1 answered; 1 unanswered"); expect(nodes(tree).some(n => n.type === "fieldset")).toBe(false);
    expect(queries[1].enabled).toBe(false);
  });
  it("successful response renders a receipt even before the execution query refresh", () => {
    activePage(); mutations[1].onSuccess(receipt); expect(text(render())).toContain("stable-receipt"); expect(draftQueue.pause).toHaveBeenCalled();
  });
  it("lost response locks editing, GET recovers the committed receipt without another submit", async () => {
    activePage(); mutations[1].onError(new Error("Connection dropped"));
    let tree = render(); expect(text(tree)).toContain("Submission status could not be confirmed"); expect(nodes(tree).some(n => n.type === "fieldset")).toBe(false);
    request.mockResolvedValueOnce({ state: "FINALIZED", receipt });
    await button(tree, "Retrieve submission status").props.onClick(); await Promise.resolve(); await Promise.resolve(); tree = render();
    expect(request.mock.calls.at(-1)![0]).toBe("/exam-engine/applications/exact-application/finalization"); expect(text(tree)).toContain("stable-receipt"); expect(mutate).not.toHaveBeenCalled();
  });
  it("timeout zero truthfully waits for receipt and keeps content disabled", () => {
    queryResult.data.execution = execution({ state: "ACTIVE", deadlineAt: "2026-11-03T02:17:00Z" });
    const tree = render(); expect(text(tree)).toContain("Retrieving final status"); expect(text(tree)).toContain("Submission is confirmed only when your receipt is available"); expect(text(tree)).not.toContain("Examination Submitted"); expect(queries[1].enabled).toBe(false);
  });
});
