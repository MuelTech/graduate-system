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
  assert.match(source, /processSelection\(\)/);
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
