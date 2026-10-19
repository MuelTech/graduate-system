// CDW-9B — Committee Report finalization/signing stale-client hardening.
//
// Run: node --test scripts/verify-cdw9b-report-signature-hardening.mjs
//
// Focused frontend source-contract verifier. Backend freeze/sign concurrency is
// covered by the focused Vitest suites.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

const SIGNATURE_PANEL = "src/components/defense-workspace/rap-signature-panel.tsx";
const REPORT_PANEL = "src/components/defense-workspace/committee-report-panel.tsx";
const RICH_TEXT_EDITOR =
  "src/components/defense-workspace/rich-text-report-editor.tsx";
const SIGNATURE_DIALOG =
  "src/components/defense-workspace/committee-report-signature-dialog.tsx";

function mutationSource(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  assert.ok(start >= 0, `${startToken} is present`);
  const end = source.indexOf(endToken, start);
  assert.ok(end > start, `${startToken} boundary is present`);
  return source.slice(start, end);
}

test("Committee Report conflict policy invalidates all authoritative reads", () => {
  const panel = read(SIGNATURE_PANEL);

  assert.match(panel, /import \{ apiClientRequest, ApiError \}/);
  assert.match(panel, /queryKey: \["committeeReport", scheduleId\]/);
  assert.match(panel, /queryKey: \["defenseWorkspace", scheduleId\]/);
  assert.match(panel, /queryKey: \["conclusionReadiness", scheduleId\]/);
});

test("finalization 409 closes stale confirmation and refreshes state", () => {
  const panel = read(SIGNATURE_PANEL);
  const finalize = mutationSource(panel, "const finalize = useMutation({", "const requestFinalize");

  assert.match(finalize, /error instanceof ApiError && error\.statusCode === 409/);
  assert.match(finalize, /setConfirmingFinalize\(false\)/);
  assert.match(finalize, /void invalidate\(\)/);
  assert.doesNotMatch(finalize, /finalize\.mutate|retry/i);
});

test("signature 409 closes the stale dialog and refreshes state", () => {
  const panel = read(SIGNATURE_PANEL);
  const sign = mutationSource(panel, "const sign = useMutation({", "if (!frozen)");

  assert.match(sign, /error instanceof ApiError && error\.statusCode === 409/);
  assert.match(sign, /setSignDialogOpen\(false\)/);
  assert.match(sign, /setSignError\(null\)/);
  assert.match(sign, /void invalidate\(\)/);
  assert.doesNotMatch(sign, /sign\.mutate|retry|setTimeout/i);
});

test("signature dialog never auto-submits or reuses evidence", () => {
  const dialog = read(SIGNATURE_DIALOG);

  assert.match(dialog, /if \(confirmingRef\.current \|\| signPending \|\| !signatureReady\) return;/);
  assert.match(dialog, /setSignature\(""\)/);
  assert.doesNotMatch(dialog, /useEffect\([^)]*onConfirm/);
});

test("Rapporteur finalization still drains autosave and sends its body version", () => {
  const report = read(REPORT_PANEL);

  const flush = report.indexOf("await controller.flushAndWait()");
  const freeze = report.indexOf("/collaboration/report/freeze");
  assert.ok(flush >= 0, "flushAndWait is present");
  assert.ok(freeze > flush, "freeze request follows the autosave drain");
  assert.match(report, /expectedBodyVersion: controller\.getServerVersion\(\)/);
  assert.match(report, /ReportAutosaveConflictError/);
  assert.doesNotMatch(report, /force/i);
});

test("FIX-1: finalization boundary locks the editor before drain/freeze", () => {
  const report = read(REPORT_PANEL);

  const boundary = report.indexOf("finalizingRef.current = true");
  const flush = report.indexOf("await controller.flushAndWait()");
  const freeze = report.indexOf("/collaboration/report/freeze");
  assert.ok(boundary >= 0, "synchronous finalizing boundary is set");
  assert.ok(flush > boundary, "drain starts after the edit boundary");
  assert.ok(freeze > flush, "freeze starts after the drain");
  assert.match(report, /editable=\{!finalizing\}/);
  assert.match(report, /if \(finalizingRef\.current\) return;/);
  assert.match(report, /finalizingRef\.current = false/);
});

test("FIX-1: drain failure restores editing and never reaches freeze", () => {
  const report = read(REPORT_PANEL);
  const handler = mutationSource(
    report,
    "const handleFinalizeReport = async () => {",
    "const conflict =",
  );

  assert.match(handler, /setFinalizing\(false\)/);
  assert.match(handler, /throw error/);

  const successStart = handler.indexOf("return await apiClientRequest");
  const successEnd = handler.indexOf("} catch (error)", successStart);
  const successPath = handler.slice(successStart, successEnd);
  assert.ok(successStart >= 0);
  assert.doesNotMatch(successPath, /setFinalizing\(false\)/);
});

test("FIX-1: Tiptap applies editable dynamically and disables inserts", () => {
  const editor = read(RICH_TEXT_EDITOR);

  assert.match(editor, /editor\.setEditable\(editable\)/);
  assert.match(
    editor,
    /if \(!editor \|\| !editable\) \{\s*registerInsert\(null\)/,
  );
  assert.match(editor, /\{editable && editor && <ReportEditorToolbar/);
});
