import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deriveExamState, EXAM_STATE_LABEL } from "../../../../frontend/src/lib/exam-record-state";

const frontendRequire = createRequire(path.resolve("../frontend/package.json"));
const { createElement } = frontendRequire("react");
const { renderToStaticMarkup } = frontendRequire("react-dom/server");
const jsxRuntime = frontendRequire("react/jsx-runtime");
function load(relativePath: string, modules: Record<string, unknown>) {
  const source = readFileSync(path.resolve("../frontend", relativePath), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const exports: Record<string, any> = {};
  const requireModule = (name: string) => {
    if (!(name in modules)) throw new Error(`Unexpected frontend contract dependency: ${name}`);
    return modules[name];
  };
  new Function("require", "exports", code)(requireModule, exports);
  return exports;
}
const api = load("src/lib/api.client.ts", {
  "next-auth/react": {}, "./backend-origin.client": {},
});
const query = vi.fn();
const request = vi.fn();
const tag = (name: string) => ({ children, ...props }: any) => createElement(name, props, children);
const Page = load("src/app/(portal)/applicant/results/page.tsx", {
  "react/jsx-runtime": jsxRuntime,
  "next/link": { __esModule: true, default: tag("a") },
  "@/components/ui/card": { Card: tag("div"), CardContent: tag("div"), CardHeader: tag("header"), CardTitle: tag("h3") },
  "@/components/ui/badge": { Badge: tag("span") },
  "@tanstack/react-query": { useQuery: query },
  "next-auth/react": { useSession: () => ({ data: { user: { id: "own-user" } } }) },
  "lucide-react": frontendRequire("lucide-react"),
  "@/lib/api.client": { ApiError: api.ApiError, apiClientRequest: request },
}).default;

const finalResult = (status: string) => ({ status, mcqScore: 63, mcqTotal: 72, essayScore: 20, essayTotal: 30, totalScore: 83, totalPossible: 102, passingScore: 76, examDate: "2026-11-02T00:00:00Z" });
const render = (data?: unknown, error?: Error, isLoading = false) => {
  query.mockReturnValue({ data, error, isLoading });
  return renderToStaticMarkup(createElement(Page));
};
beforeEach(() => { vi.clearAllMocks(); });

describe("B0B real Applicant Results component state rendering", () => {
  it.each(["pending", "unknown", "TAKEN", "", undefined])("successful nonfinal status %s cannot render a failure or completed score", status => {
    const html = render({ ...finalResult(status as string), essayScore: null, totalScore: null });
    expect(html).toContain("Results Not Available");
    expect(html).toContain("awaiting evaluation");
    expect(html).not.toMatch(/FAILED|PASSED|Score Breakdown|Passing Score|Re-application Information/);
  });

  it.each([404, 409])("uses typed HTTP %i unavailability, independent of message wording", status => {
    const html = render(undefined, new api.ApiError("Awaiting evaluation.", status));
    expect(html).toContain("Results Not Available");
    expect(html).toContain("Awaiting evaluation.");
    expect(html).not.toMatch(/FAILED|Score Breakdown|Error Loading Results/);
  });

  it("shows missing results without a failure interpretation", () => {
    expect(render()).toContain("Results Not Available");
    expect(render()).not.toContain("FAILED");
  });

  it.each(["passed", "failed"])("preserves completed %s presentation and persisted scores", status => {
    const html = render(finalResult(status));
    expect(html).toContain(status.toUpperCase());
    expect(html).not.toContain(status === "passed" ? "FAILED" : "PASSED");
    expect(html).toContain("Score Breakdown");
    expect(html).toContain("83");
    expect(html).toContain(status === "passed" ? "Upload COR" : "Re-application Information");
    expect(html).toContain("Result notifications use your registered email address.");
    expect(html).not.toMatch(/has been sent|has been delivered/);
  });

  it("keeps unexpected failures distinct and never displays internal error text or stale completed data", () => {
    const html = render(finalResult("failed"), new api.ApiError("private database pending internals", 500));
    expect(html).toContain("Error Loading Results");
    expect(html).not.toMatch(/Results Not Available|FAILED|Score Breakdown|private database/);
  });

  it("preserves the loading state", () => {
    expect(render(undefined, undefined, true)).toContain("Loading your results");
  });

  it("retains the session-specific cache key and owned result request", async () => {
    render(finalResult("passed"));
    const options = query.mock.calls[0][0];
    expect(options.queryKey).toEqual(["examResult", "own-user"]);
    await options.queryFn();
    expect(request).toHaveBeenCalledExactlyOnceWith("/exam/result", { method: "GET" });
  });

  it("preserves accepted Admin Exam Record state semantics", () => {
    expect(EXAM_STATE_LABEL[deriveExamState("TAKEN")]).toBe("Needs Essay Grading");
    expect(deriveExamState("PASSED")).toBe("PASSED");
    expect(deriveExamState("FAILED")).toBe("FAILED");
    expect(deriveExamState("PENDING")).toBe("SCHEDULED");
  });
});
