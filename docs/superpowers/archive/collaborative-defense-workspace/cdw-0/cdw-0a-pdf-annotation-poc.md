# CDW-0A — PDF annotation proof of concept (findings)

**Package:** CDW-0 (technical spike), part A
**Date:** 2026-10-16
**Branch:** `refactor/collaborative-defense-workspace`
**Baseline:** `origin/main` @ `68f58b9`
**Status:** POC proven at the deterministic + build level; runtime visual QA is USER-OWNED (steps below)

---

## 1. Question this spike answers

Can the Defense Workspace render an authenticated thesis PDF under an
application-controlled layer, let a committee member select text and create a
highlight, serialize enough anchor data to restore it after reload, and keep the
highlight correctly positioned across zoom — without mutating the source PDF and
without weakening the existing secure document path?

**Answer: yes.** The controlled pdf.js route is viable on the current stack
(Next 16.3.8 / React 19.2.4), the serialized anchor is zoom-independent, and the
production build emits the pdf.js worker as an asset.

## 2. Scope and non-goals

In scope: an isolated POC (throwaway) proving rendering, selection, highlight,
serialization, restore, and zoom invariance.

Out of scope (do NOT treat as delivered): the production Student Document
collaboration UI (CDW-2/CDW-3), persistence (no DB/migration), Socket.IO,
multi-user sync, OCR anchoring, comment threads.

## 3. What was built

| File | Responsibility |
|---|---|
| `frontend/src/lib/pdf-annotation/anchors.ts` | Framework-free anchor model: normalization, serialize/deserialize, validation |
| `frontend/src/components/poc/pdf-annotation-poc.tsx` | Isolated viewer: authenticated load, canvas + text layer, selection → highlight, zoom, restore |
| `frontend/src/components/poc/pdf-annotation-poc.css` | Scoped (`.cdw0*`) pdf.js text-layer CSS |
| `frontend/src/app/poc/pdf-annotation/page.tsx` | Isolated route `/poc/pdf-annotation?documentId=<uuid>` |
| `frontend/scripts/verify-pdf-anchors.mjs` | Deterministic Node verification of the anchor module |
| `frontend/package.json` | Added `pdfjs-dist` (6.4.299) |

Nothing under the production Defense Workspace, the DocumentViewer, or the
backend was modified.

## 4. Authenticated PDF loading (proven by construction)

The POC does **not** invent an access path. It fetches the PDF through the
existing secure proxy:

```
GET /api/documents/thesis-document/<documentId>/file
```

- The route resolves the NextAuth session (`auth()`), attaches the bearer token,
  and proxies to the backend (`route.ts:22-48`).
- The POC calls it with `credentials: "include"`, `cache: "no-store"`, then feeds
  the bytes to `pdfjs.getDocument({ data })`.
- No public/raw upload path is exposed; no filesystem path is referenced by the
  client; the source PDF is never written.

An unauthenticated or unauthorized request returns the backend's non-2xx status,
which the POC surfaces as an explicit error.

## 5. Rendering approach

- pdf.js `getDocument` from bytes → `page.getViewport({ scale })`.
- Canvas rendered at `devicePixelRatio` (crisp on HiDPI), CSS size = viewport size.
- Text layer: `new pdfjs.TextLayer({ textContentSource, container, viewport })`,
  with `--total-scale-factor` set to the viewport scale for font sizing.
- Worker: `GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)`.
- Highlights render as an absolute overlay `div` per normalized rect, positioned
  in **percentages** of the page box (this is what makes zoom-independence fall out
  for free).

## 6. Anchor format (versioned)

```jsonc
{
  "anchorVersion": 1,
  "pageNumber": 3,
  "selectedText": "depth and comprehensiveness of treatment",
  "rects": [ { "x": 0.10, "y": 0.10, "width": 0.20, "height": 0.02 } ],
  "prefix": "",   // reserved for text-fallback resilience
  "suffix": ""
}
```

- `pageNumber` is 1-based.
- `rects` are **normalized to the page box** (0..1, top-left origin) and clamped;
  zero-area rects are dropped.
- `anchorVersion` lets a future viewer refuse (fail closed) an anchor it cannot
  interpret, rather than mis-restore it.
- The geometry is stored per line/quad, matching what `Selection.getRangeAt().getClientRects()` yields.

`deserializeAnchor` rejects invalid JSON, structurally invalid payloads, and any
unsupported `anchorVersion`.

## 7. Deterministic verification (Node)

```
node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
  --test scripts/verify-pdf-anchors.mjs
```

Result: **10/10 pass.** Covered: px→normalized mapping, out-of-page clamping,
normalize/denormalize inverse, anchor assembly (page/text/geometry/prefix/suffix/version),
serialize↔deserialize round-trip, rejection of malformed + unknown-version
payloads, and zoom invariance (a highlight at 100% maps to 2× geometry at 200%
while the stored normalized anchor is unchanged).

## 8. Next.js / React build proof

`npm run build` (Next 16.3.8, React 19.2.4) → **exit 0**. The route
`/poc/pdf-annotation` is emitted, and the pdf.js worker is bundled as a static
asset:

```
.next/static/media/pdf.worker.min.0zcq5mj7t-qsr.mjs   (1,264,342 bytes)
```

and referenced from the client chunks. This confirms worker/bundling works with
the current bundler (no `workerSrc` 404, no ESM/SSR breakage).

## 9. Library evaluation (evidence from live npm metadata)

| Candidate | Version | License | Last modified | React/peer fit | Notes |
|---|---|---|---|---|---|
| **pdfjs-dist** (chosen base) | 6.4.299 | Apache-2.0 | 2026-10-03 | framework-free | Already used by the backend (`^6.3.289`); full control; worker verified here |
| @recogito/pdf-annotator | 4.3.7 | BSD-3-Clause | 2026-10-12 | framework-free (mount in a div) | Actively maintained; W3C Web Annotation selectors; supports custom rendering — **strongest "don't own the layer" fallback** |
| react-pdf-highlighter | 8.0.0-rc.0 | MIT | 2024-09-14 | peer `react >=18` | ~2 yrs stale; ships its own viewer on react-pdf/pdf.js → React 19/Next 16 integration risk |
| react-pdf-highlighter-extended | 8.1.0 | MIT | 2024-07-05 | peer `react ^18.3.1` | Peer **excludes** React 19 |
| react-pdf | 11.0.0 | MIT | 2026-09-10 | peer `react ^19` | Rendering only; no selection/highlight/annotation layer |
| @react-pdf-viewer/core | 3.12.0 | custom | 2023-03-21 | needs `pdfjs-dist ^2 || ^3` | Incompatible with pdfjs 6; stale |
| pdf-annotate.js | 1.0.0 | MIT | 2022-06-23 | — | Stale |

**Decision:** build on **pdfjs-dist directly** (aligns with the backend version,
maximum control for EARIST-native rendering, no stale React-18-only dependency).
Keep `@recogito/pdf-annotator` documented as the maintained alternative if CDW-2
prefers a library-owned selection/annotation engine.

## 10. Scanned / image-only PDF limitations (reported, not hidden)

- The anchor relies on the pdf.js **text layer**. Image-only/scanned PDFs produce
  an empty text layer, so text selection and text-anchored highlights are
  unavailable — the POC would simply show no selectable text.
- No OCR anchoring was added (explicit non-goal).
- CDW-2 must detect "no extractable text" and fall back to area/region highlights
  (or disable highlighting with a clear message) rather than silently failing.

## 11. Security / integrity posture

- No raw upload or filesystem path exposed; loading stays on the authenticated proxy.
- The source PDF is never mutated; highlights are a separate overlay.
- No database migration; anchors persisted only to `localStorage` for the POC.
- Because highlight writes are client-local here, **CDW-3 must re-implement them as
  server-authorized writes** (see CDW-0C) — client-local storage is a POC shortcut,
  not a security model.

## 12. Recommendation for CDW-2

1. Adopt pdf.js text-layer rendering behind an EARIST-native viewer shell (no
   browser-native PDF chrome), loading through the existing secure proxy.
2. Adopt the CDW-0A anchor model (`pageNumber` + `selectedText` + normalized
   `rects` + `prefix`/`suffix` + `anchorVersion`) as the persisted anchor shape.
3. Bind the viewer to the **exact attempt `thesisDocumentId`** (no thesis-global
   "latest document" fallback).
4. Add scanned-PDF detection and an explicit fallback path.
5. Keep the generic `DocumentViewer` untouched; the collaborative viewer is a
   separate component.

## 13. Manual QA steps (USER-OWNED)

1. Run backend + frontend; sign in as an authorized committee member.
2. Open `/poc/pdf-annotation?documentId=<thesis-document-uuid>` for a defense-stage PDF.
3. Confirm the PDF renders with selectable text.
4. Drag-select a sentence → a highlight appears immediately.
5. Click **Reload from storage** (or refresh the browser) → the highlight returns.
6. Move the **Zoom** slider to 200% → the highlight stays on the same text.
7. Page 1 highlight should not appear on page 2.
8. Inspect **Serialized anchor JSON** to see the stored format.
