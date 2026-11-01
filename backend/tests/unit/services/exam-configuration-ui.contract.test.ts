import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as helpers from "../../../../frontend/src/lib/exam-configuration";
import { validateExamConfiguration } from "../../../src/services/exam-configuration.rules";

const frontendRequire = createRequire(path.resolve("../frontend/package.json"));
const { createElement } = frontendRequire("react");
const { renderToStaticMarkup } = frontendRequire("react-dom/server");
const state: any[] = [];
const refs: any[] = [];
let stateIndex = 0;
let refIndex = 0;
const query = vi.fn();
const request = vi.fn();
const mutate = vi.fn();
const mutationOptions = vi.fn();
const setQueryData = vi.fn();
const close = vi.fn();
let pending = false;
class ApiError extends Error { constructor(message: string, public statusCode: number) { super(message); } }
const tag = (name: string) => ({ children, showCloseButton: _show, onOpenChange: _change, ...props }: any) => createElement(name, props, children);
const values: helpers.ExamConfiguration = { examDurationMinutes: null, mcqPointsPerCorrectItem: null, essayMaximumScore: null, passingThreshold: null, passingThresholdUnit: null, timezone: "Asia/Manila", isComplete: false };
const code = ts.transpileModule(readFileSync(path.resolve("../frontend/src/components/exam-content/exam-configuration-dialog.tsx"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const modules: Record<string, unknown> = {
  "react/jsx-runtime": frontendRequire("react/jsx-runtime"),
  react: {
    useState: (initial: unknown) => {
      const index = stateIndex++;
      if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
      return [state[index], (next: unknown) => { state[index] = typeof next === "function" ? next(state[index]) : next; }];
    },
    useRef: (initial: unknown) => { const index = refIndex++; return refs[index] ??= { current: initial }; },
  },
  "@tanstack/react-query": { useQuery: query, useQueryClient: () => ({ setQueryData }), useMutation: (options: unknown) => { mutationOptions(options); return { mutateAsync: mutate, isPending: pending }; } },
  "@/lib/api.client": { ApiError, apiClientRequest: request },
  "@/lib/exam-configuration": helpers,
  "@/components/ui/button": { Button: tag("button") },
  "@/components/ui/input": { Input: tag("input") },
  "@/components/ui/label": { Label: tag("label") },
  "@/components/ui/dialog": { Dialog: tag("div"), DialogContent: tag("div"), DialogDescription: tag("p"), DialogHeader: tag("header"), DialogTitle: tag("h2") },
};
const exports: Record<string, any> = {};
new Function("require", "exports", code)((name: string) => {
  if (!(name in modules)) throw new Error(`Unexpected configuration dependency: ${name}`);
  return modules[name];
}, exports);
const Dialog = exports.ExamConfigurationDialog;
function walk(node: any, predicate: (value: any) => boolean): any[] {
  if (!node || typeof node !== "object") return [];
  return [...(predicate(node) ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(child => walk(child, predicate))];
}
function tree() { stateIndex = 0; refIndex = 0; return Dialog({ onClose: close }); }
function form() {
  const node = walk(tree(), node => node.type?.name === "ConfigurationForm")[0];
  return node.type(node.props);
}
function html() { stateIndex = 0; refIndex = 0; return renderToStaticMarkup(createElement(Dialog, { onClose: close })); }
function deferred() { let resolve!: (value: helpers.ExamConfiguration) => void; const promise = new Promise<helpers.ExamConfiguration>(done => { resolve = done; }); return { promise, resolve }; }

beforeEach(() => {
  vi.clearAllMocks(); state.length = 0; refs.length = 0; stateIndex = 0; refIndex = 0; pending = false;
  query.mockReturnValue({ data: values, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() });
  mutate.mockResolvedValue(values);
});

describe("B1 Admin draft values and state contract", () => {
  it("leaves missing values blank and passes explicit nulls without legacy defaults", () => {
    const draft = helpers.configurationDraft(values);
    expect(Object.values(draft)).toEqual(["", "", ""]);
    expect(helpers.configurationPayload(draft)).toEqual(validateExamConfiguration({ passingThreshold: null }));
  });

  it("preserves entered finite values through the server validator", () => {
    const payload = helpers.configurationPayload({ examDurationMinutes: "95", mcqPointsPerCorrectItem: "2.5", essayMaximumScore: "42" });
    expect(validateExamConfiguration(payload)).toEqual(payload);
  });

  it.each(["abc", "-1", "0", "Infinity", "NaN", "0x10", "1.5", String(Number.MAX_SAFE_INTEGER)])("rejects invalid or unsafe duration %s", value => {
    expect(() => helpers.configurationPayload({ ...helpers.configurationDraft(values), examDurationMinutes: value })).toThrow();
  });

  it("renders loading without editable fields or fake values", () => {
    query.mockReturnValue({ isLoading: true });
    expect(html()).toContain("Loading exam configuration");
    expect(html()).not.toContain("Save draft");
  });

  it("renders load failure with executable Retry and no save action", async () => {
    const retry = vi.fn(); query.mockReturnValue({ isLoading: false, isError: true, refetch: retry });
    expect(html()).toContain("Could not load exam configuration");
    expect(html()).not.toContain("Save draft");
    await walk(tree(), node => node.props?.onClick)[0].props.onClick();
    expect(retry).toHaveBeenCalledOnce();
  });

  it("shows explicit draft context, disabled threshold and fixed read-only timezone", () => {
    const rendered = html();
    for (const text of ["Exam Duration", "MCQ Points per Correct Item", "Essay Maximum Score", "Passing Threshold", "Asia/Manila", "system-defined, read-only", "policy confirmation", "Draft configuration"]) expect(rendered).toContain(text);
    expect(rendered).toMatch(/id="configuration-threshold"[^>]*disabled/);
    expect(rendered).not.toMatch(/value="(?:180|30|75|1)"|<select|settingKey|entrance_exam_configuration/);
  });

  it("keeps invalid edits and gives feedback without sending a mutation", async () => {
    form(); state[1].examDurationMinutes = "bad";
    await form().props.onSubmit({ preventDefault: vi.fn() });
    expect(mutate).not.toHaveBeenCalled();
    expect(html()).toContain("must be a positive");
    expect(close).not.toHaveBeenCalled();
  });

  it("prevents duplicate saves, blocks close while pending and reconciles persisted readback", async () => {
    form(); state[1] = { examDurationMinutes: "95", mcqPointsPerCorrectItem: "2.5", essayMaximumScore: "42" };
    const saved = { ...values, examDurationMinutes: 96, mcqPointsPerCorrectItem: 2.5, essayMaximumScore: 42 };
    const wait = deferred(); mutate.mockReturnValue(wait.promise);
    const element = form();
    const first = element.props.onSubmit({ preventDefault: vi.fn() });
    await element.props.onSubmit({ preventDefault: vi.fn() });
    expect(mutate).toHaveBeenCalledOnce();
    pending = true;
    tree().props.onOpenChange(false); expect(close).not.toHaveBeenCalled();
    expect(html()).toContain("Saving…");
    expect(walk(form(), node => node.type === "fieldset")[0].props.disabled).toBe(true);
    wait.resolve(saved); await first; pending = false;
    expect(state[1]).toEqual(helpers.configurationDraft(saved));
    expect(setQueryData).toHaveBeenCalledWith(["adminExamConfiguration"], saved);
    expect(html()).toContain("Draft configuration saved.");
    tree().props.onOpenChange(false); expect(close).toHaveBeenCalledOnce();
  });

  it("keeps failed saves open with edits intact and no false success", async () => {
    form(); state[1].examDurationMinutes = "95";
    mutate.mockRejectedValue(new Error("private database details"));
    await form().props.onSubmit({ preventDefault: vi.fn() });
    expect(state[1].examDurationMinutes).toBe("95");
    expect(html()).toContain("Your edits are still here");
    expect(html()).not.toMatch(/private database|Draft configuration saved/);
    expect(setQueryData).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
  });

  it("submits only typed editable values through the dedicated API", async () => {
    form();
    const payload = helpers.configurationPayload(helpers.configurationDraft(values));
    await mutationOptions.mock.calls[0][0].mutationFn(payload);
    expect(request).toHaveBeenCalledWith("/exam-engine/admin/configuration", { method: "PUT", body: JSON.stringify(payload) });
    expect(JSON.stringify(payload)).not.toMatch(/timezone|isComplete|settingKey|passingThresholdUnit/);
  });

  it("shows bounded server validation feedback without closing or clearing edits", async () => {
    form(); state[1].essayMaximumScore = "42";
    mutate.mockRejectedValue(new ApiError("Check the point values.", 400));
    await form().props.onSubmit({ preventDefault: vi.fn() });
    expect(html()).toContain("Check the point values.");
    expect(state[1].essayMaximumScore).toBe("42");
    expect(close).not.toHaveBeenCalled();
  });

  it("opens a fresh cancellable read and avoids background overwrites while editing", async () => {
    tree(); const options = query.mock.calls[0][0];
    expect(options).toMatchObject({ gcTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false });
    const signal = new AbortController().signal;
    await options.queryFn({ signal });
    expect(request).toHaveBeenCalledWith("/exam-engine/admin/configuration", { signal, cache: "no-store" });
  });

  it("keeps the configuration action on Question Bank alongside existing authoring", () => {
    const source = readFileSync(path.resolve("../frontend/src/app/(portal)/admin/exam/questions/page.tsx"), "utf8");
    expect(source).toMatch(/setConfigurationOpen\(true\)/);
    expect(source).toMatch(/configurationOpen \? <ExamConfigurationDialog/);
    expect(source).toContain("Add question"); expect(source).toContain("AdminQuestionEditor");
    expect(source).toContain("QuestionBankPagination");
  });
});
