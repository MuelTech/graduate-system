// CDW-9E FIX-2 — mobile anchored manuscript-comment selection.
//
// Run: node --test scripts/verify-cdw9e-fix2-mobile-selection.mjs
//
// Focused source-contract verifier. Real phone selection QA is separate.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const PAGE = "src/components/defense-workspace/manuscript-page.tsx";
const HIGHLIGHT_LAYER =
  "src/components/defense-workspace/manuscript-highlight-layer.tsx";
const VIEWER_CSS = "src/components/defense-workspace/manuscript-viewer.css";
const VIEWER = "src/components/defense-workspace/collaborative-manuscript-viewer.tsx";
const COLLABORATION =
  "src/components/defense-workspace/student-document-collaboration.tsx";
const WORKSPACE = "src/components/defense-workspace/workspace-shell.tsx";

test("desktop mouse selection still uses the shared anchor builder", () => {
  const source = read(PAGE);

  assert.match(source, /const processSelection = useCallback/);
  assert.match(source, /onMouseUp=\{handleMouseUp\}/);
  assert.match(source, /if \(processSelection\(\)\) return;/);
  assert.match(source, /buildAnchor\(/);
  assert.equal(
    (source.match(/buildAnchor\(/g) ?? []).length,
    1,
    "anchor geometry is built in exactly one shared path",
  );
});

test("touch/pointer selection schedules the same anchor builder after settling", () => {
  const source = read(PAGE);

  assert.match(source, /onPointerDown=\{/);
  assert.match(source, /onPointerUp=\{/);
  assert.match(source, /event\.pointerType === "touch"/);
  assert.match(source, /document\.addEventListener\("selectionchange", onSelectionChange\)/);
  assert.match(source, /scheduleTouchSelection\(\)/);
  assert.match(source, /touchSelectionTimerRef/);
  assert.match(source, /setTimeout\(\(\) => \{/);
  assert.match(source, /processSelection\(false\)/);
  assert.match(source, /180\)/);
  assert.match(source, /document\.removeEventListener\("selectionchange", onSelectionChange\)/);
  assert.match(source, /clearTimeout\(touchSelectionTimerRef\.current\)/);
});

test("FIX-3: pointercancel preserves the native mobile selection session", () => {
  const source = read(PAGE);

  assert.match(source, /const armTouchSelectionSession = useCallback/);
  assert.match(source, /touchSessionTimeoutRef/);
  assert.match(
    source,
    /onPointerCancel=\{\(event\) => \{[\s\S]*?if \(event\.pointerType === "touch"\) armTouchSelectionSession\(\);/,
  );
  assert.doesNotMatch(
    source,
    /onPointerCancel=\{[\s\S]{0,400}?touchSelectingRef\.current = false/,
  );
  assert.match(source, /if \(!touchSelectingRef\.current\) return;[\s\S]*?scheduleTouchSelection\(\)/);
  assert.match(source, /}, 5000\);/);
});

test("read-only selection and copy remain untouched", () => {
  const source = read(PAGE);

  assert.match(source, /if \(!callbacksRef\.current\.onTextSelection\) return false;/);
  assert.match(source, /selection\.removeAllRanges\(\)/);
});

test("one completed selection cannot create duplicate candidate anchors", () => {
  const source = read(PAGE);
  const processStart = source.indexOf("const processSelection = useCallback");
  const processEnd = source.indexOf("const scheduleTouchSelection", processStart);
  const process = source.slice(processStart, processEnd);

  assert.ok(processStart >= 0 && processEnd > processStart);
  assert.match(process, /clearTouchTimers\(\)/);
  assert.match(process, /touchSelectingRef\.current = false;/);
  assert.match(process, /selection\.removeAllRanges\(\)/);
  assert.match(process, /return true;/);
});

test("collapsed highlight hit-testing remains in the mouse path", () => {
  const source = read(PAGE);
  const mouseStart = source.indexOf("const handleMouseUp = useCallback");
  const mouseEnd = source.indexOf("return (", mouseStart);
  const mouseHandler = source.slice(mouseStart, mouseEnd);

  assert.match(mouseHandler, /denormalizeRects/);
  assert.match(mouseHandler, /onAnnotationSelect\(hit\.id\)/);
  assert.match(mouseHandler, /annotations\.find/);
});

test("FIX-4: pending anchor renders a presentation-only draft highlight", () => {
  const page = read(PAGE);
  const layer = read(HIGHLIGHT_LAYER);
  const css = read(VIEWER_CSS);

  assert.match(page, /pendingAnchor=\{pendingAnchorForPage\}/);
  assert.match(layer, /pendingAnchor/);
  assert.match(layer, /mwHighlightRect--pending/);
  assert.match(css, /\.mwHighlightRect--pending/);
  assert.match(layer, /rectsForAnchorOnPage\(pendingAnchor, pageSize\)/);
  assert.doesNotMatch(page, /apiClientRequest|fetch\(/);
});

test("FIX-4: contextual Add comment reuses the existing Comments drawer", () => {
  const page = read(PAGE);
  const collaboration = read(COLLABORATION);
  const workspace = read(WORKSPACE);

  assert.match(page, /aria-label="Add comment to selected text"/);
  assert.match(page, /onOpenPendingComments/);
  assert.match(page, /lg:hidden/);
  assert.match(page, /event\.stopPropagation\(\)/);
  assert.doesNotMatch(page, /WorkspaceDrawer|openDrawer/);

  assert.match(collaboration, /onOpenPendingComments/);
  assert.match(collaboration, /setRailView\("selected"\)/);
  assert.match(workspace, /onRequestComments=\{\(\) => \{/);
  assert.match(workspace, /setOpenDrawer\("right"\)/);
  assert.match(workspace, /returnFocusTo=\{drawerReturnFocus\}/);
});

test("FIX-4: pending lifecycle clears the draft action on submit/cancel", () => {
  const collaboration = read(COLLABORATION);

  assert.match(collaboration, /if \(!canAnnotate\) return;/);
  assert.match(collaboration, /setPendingAnchor\(anchor\)/);
  assert.match(collaboration, /setPendingAnchor\(null\)/);
  assert.match(collaboration, /resetCreate\(\);\s*setPendingAnchor\(null\)/);
  assert.match(collaboration, /submitNewComment/);
  assert.match(collaboration, /cancelNewComment/);
});


test("FIX-5: mobile selection remains adjustable until explicit Add comment", () => {
  const page = read(PAGE);
  const viewer = read(VIEWER);
  const collaboration = read(COLLABORATION);

  assert.match(page, /const processSelection = useCallback\(\(consumeSelection = true\)/);
  assert.match(page, /processSelection\(false\)/);
  assert.match(page, /touchHasPreviewRef\.current = true/);
  assert.match(
    page,
    /if \(consumeSelection\) \{[\s\S]*?selection\.removeAllRanges\(\);[\s\S]*?\} else \{/,
  );
  assert.match(
    page,
    /touchSelectingRef\.current && selection && !selection\.isCollapsed\) return;/,
  );
  assert.match(page, /const finalizePendingSelection = useCallback/);
  assert.match(
    page,
    /finalizePendingSelection\(\);[\s\S]*?onOpenPendingComments\(\)/,
  );
  assert.match(
    page,
    /if \(!selection \|\| selection\.rangeCount === 0 \|\| selection\.isCollapsed\) \{[\s\S]*?onCancelPendingSelection/,
  );
  assert.match(viewer, /onCancelPendingSelection=\{onCancelPendingSelection\}/);
  assert.match(collaboration, /onCancelPendingSelection=\{c\.cancelNewComment\}/);
});


test("FIX-7: mobile Add comment stays contextual with a safe gap from native toolbar", () => {
  const page = read(PAGE);

  assert.match(page, /const pendingActionPosition =/);
  assert.match(page, /lastPendingRect\.top \+ lastPendingRect\.height \+ 64/);
  assert.match(page, /firstPendingRect\.top - 108/);
  assert.match(
    page,
    /className="absolute z-\[4\] -translate-x-1\/2 shadow-md lg:hidden"/,
  );
  assert.match(page, /left: `\$\{pendingActionPosition\.left\}px`/);
  assert.match(page, /top: `\$\{pendingActionPosition\.top\}px`/);
  assert.doesNotMatch(
    page,
    /fixed bottom-\[calc\(env\(safe-area-inset-bottom\)\+1rem\)\]/,
  );
});


test("FIX-8: desktop left-click dismisses a pending selection draft", () => {
  const source = read(PAGE);
  const mouseStart = source.indexOf("const handleMouseUp = useCallback");
  const mouseEnd = source.indexOf("const finalizePendingSelection", mouseStart);
  const mouseHandler = source.slice(mouseStart, mouseEnd);

  assert.match(mouseHandler, /button: number/);
  assert.match(mouseHandler, /if \(event\.button !== 0\) return;/);
  assert.match(mouseHandler, /if \(processSelection\(\)\) return;/);
  assert.match(
    mouseHandler,
    /if \(pendingAnchor\) \{\s*callbacksRef\.current\.onCancelPendingSelection\?\.\(\);\s*\}/,
  );
  assert.match(mouseHandler, /denormalizeRects/);
  assert.match(mouseHandler, /onAnnotationSelect\(hit\.id\)/);
});
