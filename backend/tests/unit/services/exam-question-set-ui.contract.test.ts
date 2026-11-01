import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as helpers from "../../../../frontend/src/lib/exam-question-set";
const frontendRequire = createRequire(path.resolve("../frontend/package.json"));
const { createElement } = frontendRequire("react"); const { renderToStaticMarkup } = frontendRequire("react-dom/server");
const state: any[] = []; const refs: any[] = []; let stateIndex = 0; let refIndex = 0;
const request = vi.fn(); const query = vi.fn(); const cache = vi.fn(); const close = vi.fn(); const busyChange = vi.fn();
class ApiError extends Error { constructor(message: string, public statusCode: number) { super(message); } }
const tag = (name: string) => ({ children, showCloseButton: _show, onOpenChange: _change, ...props }: any) => createElement(name, props, children);
const modules: Record<string, unknown> = {
  "react/jsx-runtime": frontendRequire("react/jsx-runtime"),
  react: { useState: (initial: unknown) => { const i = stateIndex++; if (!(i in state)) state[i] = typeof initial === "function" ? initial() : initial; return [state[i], (next: unknown) => { state[i] = typeof next === "function" ? next(state[i]) : next; }]; }, useRef: (initial: unknown) => { const i = refIndex++; return refs[i] ??= { current: initial }; } },
  "@tanstack/react-query": { useQuery: query, useQueryClient: () => ({ setQueryData: cache }) },
  "@/lib/api.client": { ApiError, apiClientRequest: request }, "@/lib/exam-question-set": helpers,
  "@/components/ui/button": { Button: tag("button") },
  "@/components/ui/dialog": { Dialog: tag("div"), DialogContent: tag("div"), DialogHeader: tag("header"), DialogTitle: tag("h2"), DialogDescription: tag("p") },
};
const code = ts.transpileModule(readFileSync(path.resolve("../frontend/src/components/exam-content/exam-question-set-dialog.tsx"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const exports: Record<string, any> = {};
new Function("require", "exports", code)((name: string) => { if (!(name in modules)) throw new Error(name); return modules[name]; }, exports);
let loaded: any;
function walk(node: any, test: (node: any) => boolean): any[] { if (!node || typeof node !== "object") return []; return [...(test(node) ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(child => walk(child, test))]; }
function form() { stateIndex = 0; refIndex = 0; return exports.QuestionSetForm({ loaded, onBusyChange: busyChange }); }
function dialog() { stateIndex = 0; refIndex = 0; return exports.ExamQuestionSetDialog({ onClose: close }); }
function html() { return renderToStaticMarkup(form()); }
function button(text: string) { return walk(form(), n => n.props?.onClick && renderToStaticMarkup(n).includes(text))[0]; }
function checkbox(index = 0) { return walk(form(), n => n.type === "input")[index]; }
async function flush() { await new Promise(resolve => setImmediate(resolve)); }
function deferred() { let resolve!: (value: unknown) => void; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => {
  vi.clearAllMocks(); state.length = 0; refs.length = 0; stateIndex = 0; refIndex = 0;
  loaded = { draft: { questionIds: ["q0"], questions: [], latestPublication: null }, bank: Array.from({ length: 23 }, (_, i) => ({ id: `q${i}`, order: i + 1, type: i === 22 ? "ESSAY" : "MULTIPLE_CHOICE", questionText: `Question body ${i}` })) };
  query.mockReturnValue({ data: loaded, isLoading: false, isError: false, isFetching: false });
});
describe("B2 executable Question Set component/handler contracts", () => {
  it("shows loading, load errors and executable Retry", () => {
    query.mockReturnValue({ isLoading: true }); expect(renderToStaticMarkup(dialog())).toContain("Loading Question Set");
    const retry = vi.fn(); query.mockReturnValue({ isError: true, refetch: retry }); const tree = dialog(); expect(renderToStaticMarkup(tree)).toContain("Could not load");
    walk(tree, n => n.props?.onClick)[0].props.onClick(); expect(retry).toHaveBeenCalledOnce();
  });
  it("freshly loads both persisted selection and bank and avoids focus refetch replacing edits", async () => {
    dialog(); const opts = query.mock.calls[0][0]; request.mockResolvedValueOnce(loaded.draft).mockResolvedValueOnce(loaded.bank);
    const signal = new AbortController().signal; expect(await opts.queryFn({ signal })).toEqual(loaded);
    expect(request.mock.calls.map(call => call[0])).toEqual(["/exam-engine/admin/question-set", "/exam-engine/admin/questions"]);
    expect(opts.refetchOnWindowFocus).toBe(false); expect(opts.refetchOnReconnect).toBe(false); expect(opts.gcTime).toBe(0);
    expect(request.mock.calls[0][1]).toMatchObject({ signal, cache: "no-store" });
  });
  it("loads server membership, selected count and neutral publication status", () => {
    expect(checkbox(1).props.checked).toBe(true); expect(html()).toContain("1 selected"); expect(html()).toContain("No question set published yet");
    expect(html()).toContain("does not start an exam or change current Applicant content"); expect(html()).toContain("institutional approval");
    expect(html()).not.toMatch(/snapshot hash|immutable JSON|V1|V2|Activate Exam/);
  });
  it("keeps selection across pages and permits deselection plus inspection of selected type/order", () => {
    checkbox(2).props.onChange(); button("Next").props.onClick(); checkbox(1).props.onChange();
    expect(html()).toContain("3 selected"); expect(html()).toContain("Page 2 of 3");
    button("Previous").props.onClick(); expect(checkbox(2).props.checked).toBe(true); checkbox(1).props.onChange(); expect(html()).toContain("2 selected");
    checkbox(0).props.onChange({ target: { checked: true } }); expect(html()).toContain("Question body 10"); expect(html()).toContain("Order 11");
  });
  it("saves one complete selection, prevents duplicate submit, disables editing and reconciles authoritative readback", async () => {
    checkbox(2).props.onChange(); const wait = deferred(); request.mockReturnValue(wait.promise);
    const save = button("Save draft selection"); save.props.onClick(); save.props.onClick();
    expect(request).toHaveBeenCalledOnce(); expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ questionIds: ["q0", "q1"] });
    expect(html()).toContain("Saving…"); expect(walk(form(), n => n.type === "fieldset")[0].props.disabled).toBe(true);
    const saved = { ...loaded.draft, questionIds: ["q2"] }; wait.resolve(saved); await flush();
    expect(checkbox(1).props.checked).toBe(false); expect(checkbox(3).props.checked).toBe(true);
    expect(cache).toHaveBeenCalledWith(["adminExamQuestionSet"], { ...loaded, draft: saved }); expect(html()).toContain("Draft selection saved"); expect(busyChange.mock.calls).toEqual([[true], [false]]);
  });
  it("preserves failed save edits and offers retry without false success", async () => {
    checkbox(2).props.onChange(); request.mockRejectedValue(new Error("private stack")); button("Save draft selection").props.onClick(); await flush();
    expect(html()).toContain("Your edits are still here"); expect(checkbox(2).props.checked).toBe(true); expect(html()).not.toContain("Draft selection saved");
    expect(html()).not.toContain("private stack"); expect(cache).not.toHaveBeenCalled();
  });
  it("prevents publishing an empty or unsaved selection", () => {
    checkbox(1).props.onChange(); expect(button("Publish Question Set").props.disabled).toBe(true);
    expect(html()).toContain("Save your selection before publishing");
  });
  it("requires a consequence-aware confirmation and supports cancel", () => {
    button("Publish Question Set").props.onClick(); expect(request).not.toHaveBeenCalled();
    expect(html()).toContain("This freezes the selected content and order"); expect(html()).toContain("Later bank edits do not alter");
    expect(walk(form(), n => n.type === "fieldset")[0].props.disabled).toBe(true);
    button("Cancel publication").props.onClick(); expect(html()).not.toContain("Confirm publication");
  });
  it("publishes once and shows persistent success without claiming Applicant binding", async () => {
    button("Publish Question Set").props.onClick(); const wait = deferred(); request.mockReturnValue(wait.promise);
    const confirm = button("Confirm publication"); confirm.props.onClick(); confirm.props.onClick(); expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0][0]).toBe("/exam-engine/admin/question-set/publish"); expect(html()).toContain("Publishing…");
    wait.resolve({ id: "private-revision-id", publishedAt: "2026-11-02", questionCount: 1 }); await flush();
    expect(html()).toContain("Question set published"); expect(html()).toContain("Published question set available"); expect(html()).not.toContain("private-revision-id");
  });
  it("keeps publication failure visible without claiming success", async () => {
    button("Publish Question Set").props.onClick(); request.mockRejectedValue(new ApiError("The saved selection changed. Reload and review it before publishing.", 409)); button("Confirm publication").props.onClick(); await flush();
    expect(html()).toContain("Reload and review"); expect(html()).not.toContain("Question set published."); expect(html()).toContain("Confirm publication");
  });
  it("blocks dialog closing synchronously during saves and permits closing afterward", () => {
    const tree = dialog(); const child = walk(tree, n => n.type === exports.QuestionSetForm)[0];
    child.props.onBusyChange(true); tree.props.onOpenChange(false); expect(close).not.toHaveBeenCalled();
    child.props.onBusyChange(false); tree.props.onOpenChange(false); expect(close).toHaveBeenCalledOnce();
  });
  it("composes on existing Question Bank beside configuration and authoring without another sidebar destination", () => {
    const page = readFileSync(path.resolve("../frontend/src/app/(portal)/admin/exam/questions/page.tsx"), "utf8");
    for (const text of ["Question Set", "Exam Configuration", "Add question", "AdminQuestionEditor", "ExamConfigurationDialog", "ExamQuestionSetDialog"]) expect(page).toContain(text);
    const nav = readFileSync(path.resolve("../frontend/src/app/(portal)/admin/layout.tsx"), "utf8"); expect(nav).not.toContain("question-set");
  });
});
