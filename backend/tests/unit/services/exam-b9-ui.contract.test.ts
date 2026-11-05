// Controlled executable React handlers/components. This is not owner browser QA.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as schedule from "../../../../frontend/src/lib/admin-exam-schedules";
import * as statesHelper from "../../../../frontend/src/lib/exam-record-state";
const frontend = createRequire(path.resolve("../frontend/package.json"));
const { createElement } = frontend("react"),
  { renderToStaticMarkup } = frontend("react-dom/server");
let state: any[], cursor: number, query: any, mutation: any, pending: boolean;
const request = vi.fn(),
  mutate = vi.fn(),
  invalidate = vi.fn();
const primitive =
  (tag = "div") =>
  ({ children, ...props }: any) =>
    createElement(tag, props, children);
const modules: Record<string, any> = {
  "react/jsx-runtime": frontend("react/jsx-runtime"),
  react: {
    useState: (initial: any) => {
      const i = cursor++;
      if (!(i in state)) state[i] = initial;
      return [
        state[i],
        (v: any) => {
          state[i] = v;
        },
      ];
    },
    useRef: (initial: any) => {
      const i = cursor++;
      return (state[i] ??= { current: initial });
    },
  },
  "@tanstack/react-query": {
    useQuery: () => query,
    useQueryClient: () => ({ invalidateQueries: invalidate }),
    useMutation: (v: any) => {
      mutation = v;
      return { isPending: pending, mutate };
    },
  },
  "next-auth/react": {
    useSession: () => ({ data: { user: { id: "own-user" } } }),
  },
  "next/link": { __esModule: true, default: primitive("a") },
  "@/lib/api.client": { apiClientRequest: request },
  "@/lib/admin-exam-schedules": schedule,
  "@/components/ui/button": { Button: primitive("button") },
  "@/components/ui/label": { Label: primitive("label") },
  "@/components/ui/textarea": { Textarea: primitive("textarea") },
  "@/components/ui/card": { Card: primitive(), CardContent: primitive() },
  "@/components/ui/dialog": {
    Dialog: ({ open, children }: any) =>
      open ? createElement("section", {}, children) : null,
    DialogContent: primitive(),
    DialogHeader: primitive(),
    DialogTitle: primitive("h2"),
    DialogDescription: primitive("p"),
  },
  sonner: { toast: { success: vi.fn() } },
};
function load(file: string) {
  const code = ts.transpileModule(
    readFileSync(`../frontend/src/${file}`, "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText;
  const exports: any = {};
  new Function("require", "exports", code)((name: string) => {
    if (!(name in modules)) throw new Error(name);
    return modules[name];
  }, exports);
  return exports;
}
const Gate = load(
  "components/exam-content/applicant-appointment-gate.tsx",
).ApplicantAppointmentGate;
const Actions = load(
  "components/admin/exam/exam-record-actions.tsx",
).ExamRecordActions;
function nodes(tree: any): any[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree?.props) return [];
  return [tree, ...nodes(tree.props.children)];
}
function label(tree: any): string {
  if (Array.isArray(tree)) return tree.map(label).join("");
  if (tree == null || typeof tree === "boolean") return "";
  return typeof tree === "object" ? label(tree.props?.children) : String(tree);
}
const button = (tree: any, text: string) =>
  nodes(tree).find(
    (n) =>
      n.type === modules["@/components/ui/button"].Button && label(n) === text,
  );
const control = (tree: any, id: string) =>
  nodes(tree).find((n) => n.props.id === id);
const html = (tree: any) => renderToStaticMarkup(tree);
const slot = {
  examDate: "2026-11-04T00:00:00Z",
  examTime: "1970-01-01T09:00:00Z",
};
let record: any;
const gate = () => {
  cursor = 0;
  return Gate({
    children: createElement("p", {}, "Existing Start Examination"),
  });
};
const actions = () => {
  cursor = 0;
  return Actions({ record });
};
beforeEach(() => {
  vi.clearAllMocks();
  state = [];
  cursor = 0;
  pending = false;
  query = {
    data: {
      applicationId: "exact-owned-application",
      examStatus: "pending",
      canAppealMissedExam: false,
      confirmedSlot: slot,
      amendment: null,
    },
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  };
  record = {
    id: "exact-admin-record",
    status: "PENDING",
    slot,
    canAmendAppointment: false,
    canReconsiderResult: false,
    seatReleasedAt: null,
    scheduleAmendment: null,
    reconsideration: null,
  };
  invalidate.mockResolvedValue(undefined);
});
describe("B9 Applicant exact appointment controls", () => {
  it("same-day server denial preserves Start and exposes no appeal", () => {
    expect(html(gate())).toContain("Existing Start Examination");
    expect(button(gate(), "Appeal Missed Exam")).toBeUndefined();
  });
  it("only server-authorized prior-date state offers an appeal, with exact id and no target selection", async () => {
    query.data.canAppealMissedExam = true;
    button(gate(), "Appeal Missed Exam").props.onClick();
    expect(html(gate())).toContain(
      "Same-day late arrival follows Start Examination",
    );
    expect(html(gate())).toContain("November 4, 2026");
    expect(nodes(gate()).filter((n) => n.type === "select")).toHaveLength(0);
    expect(button(gate(), "Submit Appeal").props.disabled).toBe(true);
    control(gate(), "missed-appeal-reason").props.onChange({
      target: { value: "   " },
    });
    expect(button(gate(), "Submit Appeal").props.disabled).toBe(true);
    control(gate(), "missed-appeal-reason").props.onChange({
      target: { value: "  Required explanation  " },
    });
    const tree = gate();
    button(tree, "Submit Appeal").props.onClick();
    button(tree, "Submit Appeal").props.onClick();
    expect(mutate).toHaveBeenCalledTimes(1);
    await mutation.mutationFn();
    expect(request).toHaveBeenCalledWith(
      "/exam/applications/exact-owned-application/missed-appeal",
      {
        method: "POST",
        body: JSON.stringify({ reason: "Required explanation" }),
      },
    );
    mutation.onError(new Error("Conflict; reload"));
    expect(html(gate())).toContain("Conflict; reload");
    expect(control(gate(), "missed-appeal-reason").props.value).toBe(
      "  Required explanation  ",
    );
    await mutation.onSettled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["examStatus"] });
    mutation.onSuccess();
    query.data = {
      ...query.data,
      examStatus: "appealed",
      canAppealMissedExam: false,
    };
    expect(html(gate())).toContain("Missed Exam Appeal Pending");
    expect(button(gate(), "Appeal Missed Exam")).toBeUndefined();
  });
  it("a rejected appeal shows Missed and no retry or booking controls", () => {
    query.data.examStatus = "missed";
    expect(html(gate())).toContain("No replacement appointment is authorized");
    expect(button(gate(), "Appeal Missed Exam")).toBeUndefined();
  });
  it("loading/error state exposes no stale action", () => {
    query.isLoading = true;
    expect(html(gate())).toContain("Loading appointment");
    query.isLoading = false;
    query.isError = true;
    query.data.canAppealMissedExam = true;
    expect(html(gate())).toContain("Could not load");
    expect(button(gate(), "Appeal Missed Exam")).toBeUndefined();
  });
});
describe("B9 existing Admin Exam Record controls", () => {
  it.each(["TAKEN", "PASSED", "FAILED", "MISSED", "CANCELLED", "RESCHEDULED"])(
    "%s without server authority has no appointment/result mutation",
    (status) => {
      record.status = status;
      for (const text of [
        "Reschedule",
        "Cancel Appointment",
        "Reconsider Result",
      ])
        expect(button(actions(), text)).toBeUndefined();
    },
  );
  it.each([
    ["Reschedule", "reschedule", true],
    ["Cancel Appointment", "cancel-appointment", false],
    ["Reconsider Result", "reconsider-result", false],
    ["Approve Appeal", "missed-appeal/approve", true],
    ["Reject Appeal", "missed-appeal/reject", false],
  ])(
    "%s requires reason/confirmation and correct target contract",
    async (title, endpoint, target) => {
      if (title === "Reconsider Result") {
        record.status = "FAILED";
        record.canReconsiderResult = true;
      } else if (title.includes("Appeal")) {
        record.status = "APPEALED";
        record.seatReleasedAt = "2026-11-05T00:00:00Z";
        record.scheduleAmendment = {
          type: "MISSED_APPEAL",
          status: "PENDING",
          reason: "Applicant explanation",
          requestedAt: record.seatReleasedAt,
        };
      } else record.canAmendAppointment = true;
      query.data = [{ id: "future-target", ...slot, remainingSeats: 1 }];
      button(actions(), title).props.onClick();
      expect(button(actions(), "Confirm").props.disabled).toBe(true);
      control(actions(), "exam-action-reason").props.onChange({
        target: { value: "  Justified change  " },
      });
      if (target) {
        expect(button(actions(), "Confirm").props.disabled).toBe(true);
        control(actions(), "amendment-slot").props.onChange({
          target: { value: "future-target" },
        });
      }
      expect(button(actions(), "Confirm").props.disabled).toBe(false);
      const tree = actions();
      button(tree, "Confirm").props.onClick();
      button(tree, "Confirm").props.onClick();
      expect(mutate).toHaveBeenCalledTimes(1);
      await mutation.mutationFn();
      expect(request).toHaveBeenCalledWith(
        `/exam/applications/exact-admin-record/${endpoint}`,
        {
          method: "POST",
          body: JSON.stringify({
            reason: "Justified change",
            ...(target ? { targetSlotId: "future-target" } : {}),
          }),
        },
      );
      pending = true;
      expect(button(actions(), "Saving…").props.disabled).toBe(true);
      pending = false;
      mutation.onError(new Error("State changed"));
      expect(control(actions(), "exam-action-reason").props.value).toBe(
        "  Justified change  ",
      );
      await mutation.onSettled();
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["examRecord", "exact-admin-record"],
      });
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["adminApplicants"],
      });
    },
  );
  it("pending appeal displays reason/date/released seat; approved history links exact replacement and is readonly", () => {
    record.status = "APPEALED";
    record.seatReleasedAt = "2026-11-05T00:00:00Z";
    record.scheduleAmendment = {
      type: "MISSED_APPEAL",
      status: "PENDING",
      reason: "Applicant reason",
      requestedAt: record.seatReleasedAt,
    };
    expect(html(actions())).toContain("Applicant reason");
    expect(html(actions())).toContain("Released");
    expect(button(actions(), "Approve Appeal")).toBeTruthy();
    record.status = "RESCHEDULED";
    Object.assign(record.scheduleAmendment, {
      status: "APPROVED",
      decisionReason: "Admin reason",
      replacementApplicationId: "new-record",
      targetSlot: { id: "future-target", ...slot },
    });
    expect(html(actions())).toContain("/admin/exam/applications/new-record");
    expect(html(actions())).toContain("Admin reason");
    expect(button(actions(), "Approve Appeal")).toBeUndefined();
  });
  it("reconsideration shows immutable computed FAILED separately with actor/time/reason and no editor/revoke", () => {
    record.status = "FAILED";
    record.reconsideration = {
      reason: "Institutional justification",
      decidedAt: "2026-11-05T00:00:00Z",
      decidedBy: { firstName: "Ana", lastName: "Admin" },
    };
    const text = html(actions());
    for (const value of [
      "Computed Result: FAILED",
      "PASSED — RECONSIDERED",
      "Institutional justification",
      "Ana Admin",
    ])
      expect(text).toContain(value);
    expect(button(actions(), "Reconsider Result")).toBeUndefined();
    expect(text).not.toMatch(
      /Mark as Passed|Revoke|essay-score|Send Result Email/,
    );
  });
  it.each(["MISSED", "RESCHEDULED", "CANCELLED"])(
    "%s uses a truthful separate presentation state",
    (status) => {
      expect(statesHelper.deriveExamState(status)).toBe(status);
      expect(
        statesHelper.EXAM_STATE_LABEL[
          status as keyof typeof statesHelper.EXAM_STATE_LABEL
        ],
      ).toBe(status[0] + status.slice(1).toLowerCase());
    },
  );
  it("effective reconsidered badge never changes computed FAILED", () => {
    expect(statesHelper.deriveExamState("FAILED", false, true)).toBe(
      "PASSED_RECONSIDERED",
    );
    expect(statesHelper.deriveExamState("FAILED")).toBe("FAILED");
  });
});
