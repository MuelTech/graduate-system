# Document Viewer — Design Spec

**Date:** 2026-09-06
**Feature:** Secure inline document viewer for admin COR validation, thesis applications, and panelist pages
**Author:** MiMoCode + User (brainstorming session)

---

## 1. Problem Statement

Currently, **every page** that shows uploaded documents (COR uploads, thesis documents, RAP reports) uses the same pattern: `window.open()` or `<a target="_blank">` to open files in a new browser tab. This has several problems:

1. **No inline preview** — Admins lose page context when reviewing documents. They must switch back and forth between tabs.
2. **No authentication on file access** — Files are served via `express.static("/uploads")` with zero auth. Anyone with the URL can download any file.
3. **No reusable viewer component** — Each page independently constructs file URLs with duplicated logic.
4. **No path traversal protection** — Static serving doesn't validate that the requested path stays within the uploads directory.

**Goal:** Build a secure, reusable document viewer that works as an inline modal across all pages that display uploaded files — COR validation, thesis applications, panelist materials/scoring, and future pages.

---

## 2. Scope

**In scope:**
- Single generic backend endpoint: `GET /api/documents/:modelType/:id/file`
- Reusable frontend `DocumentViewer` component (modal with PDF/image rendering)
- Model registry mapping modelType strings to Prisma models + permission rules
- Security: JWT auth, role-based access, path traversal prevention
- Remove/disable unauthenticated static file serving
- Update 4 existing pages to use the new viewer

**Out of scope:**
- File upload changes (multer middleware unchanged)
- PDF.js or any rendering library (using native browser rendering)
- Signed URLs or time-limited tokens
- File download button (can be added later)
- Mobile-specific viewer optimizations
- File annotation or markup tools

---

## 3. Design

### 3.1 Backend: Generic File Endpoint

**Route:** `GET /api/documents/:modelType/:id/file`

**Model Registry:**

A configuration map that resolves `modelType` to the correct Prisma model, file field, and permission logic:

```typescript
const MODEL_REGISTRY: Record<string, {
  model: string;          // Prisma model name
  fileField: string;      // field containing the file path
  getOwner: (record: any) => string | null;  // extract owner user ID
  getAuthorizedRoles: () => string[];         // roles that can always access
}> = {
  "cor-upload": {
    model: "corUpload",
    fileField: "filePath",
    getOwner: (r) => r.userId,
    getAuthorizedRoles: () => ["ADMIN"],
  },
  "thesis-document": {
    model: "thesisDocument",
    fileField: "filePath",
    getOwner: (r) => r.thesisRecord?.student?.userId ?? null,
    getAuthorizedRoles: () => ["ADMIN"],
  },
  "rap-report": {
    model: "rapReport",
    fileField: "filePath",
    getOwner: null,  // no single owner — check panel assignment
    getAuthorizedRoles: () => ["ADMIN"],
  },
  "student-requirement": {
    model: "studentRequirement",
    fileField: "filePath",
    getOwner: (r) => r.student?.userId ?? null,
    getAuthorizedRoles: () => ["ADMIN"],
  },
  "plagiarism-result": {
    model: "plagiarismResult",
    fileField: "filePath",
    getOwner: (r) => r.student?.userId ?? null,
    getAuthorizedRoles: () => ["ADMIN"],
  },
};
```

**Controller Flow:**

```
1. Extract modelType + id from req.params
2. Look up modelType in MODEL_REGISTRY
   → 400 "Unknown document type" if not found
3. Fetch record by ID with necessary includes for permission check
   → 404 "Document not found" if missing
4. Permission check:
   a. If user role is in getAuthorizedRoles() → allowed
   b. If record belongs to the requesting user (getOwner matches JWT userId) → allowed
   c. Otherwise → 403 "Not authorized to view this document"
5. Extract filePath from record
6. Validate path: path.relative(PRIVATE_UPLOAD_ROOT, resolvedPath) must not start with ".."
   → 403 "Access denied" if path traversal detected
7. Check file exists on disk
   → 404 "File not found" if missing
8. Detect MIME type from file extension:
   - .pdf → application/pdf
   - .jpg/.jpeg → image/jpeg
   - .png → image/png
   - else → application/octet-stream
9. Set headers:
   - Content-Type: detected MIME type
   - Content-Disposition: inline; filename="original-filename.pdf"
   - Cache-Control: private, no-store
10. Stream file via fs.createReadStream().pipe(res)
```

**Panelist permission for thesis documents:** Panelists assigned to a defense can view that defense's thesis documents. The controller checks `PanelAssignment` records linking the JWT userId to the thesis record's defense schedule.

### 3.2 Frontend: DocumentViewer Component

**Props:**

```typescript
interface DocumentViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fetchUrl: string;       // e.g. "/api/documents/cor-upload/abc123/file"
  title?: string;         // display name in modal header
}
```

**Component behavior:**

1. When `open` becomes `true`, fetch the file via `fetch(fetchUrl, { headers: { Authorization: Bearer token } })`
2. Read response as Blob, extract Content-Type from response headers
3. Create a Blob URL via `URL.createObjectURL(blob)`
4. Render based on MIME type:
   - **PDF** (`application/pdf`): `<iframe src={blobUrl} className="w-full h-full" />`
   - **Image** (`image/jpeg`, `image/png`): `<img src={blobUrl} className="max-h-[70vh] mx-auto" style={{ transform: `scale(${zoom})` }} />` with zoom controls
   - **Other**: Show file info text + "File type not supported for preview" message
5. On close / unmount: revoke Blob URL via `URL.revokeObjectURL(blobUrl)` using a ref
6. Use `AbortController` to cancel fetch if modal closes before fetch completes

**Zoom controls (images only):**
- Zoom in (+), Zoom out (-), Reset (100%) buttons
- Range: 50% to 200%, step 25%
- Default: 100%

**Modal:**
- shadcn Dialog component
- Max width: `max-w-5xl` (~80vw)
- Height: `h-[80vh]` with overflow hidden (iframe/img fills the space)
- Header: Document title + close button
- Loading state: Spinner with "Loading document..." text
- Error state: Alert with error message

**Usage example:**

```tsx
<DocumentViewer
  open={viewerOpen}
  onOpenChange={setViewerOpen}
  fetchUrl={`/api/documents/cor-upload/${selectedCor.id}/file`}
  title={`${selectedCor.student.user.firstName} ${selectedCor.student.user.lastName} — COR`}
/>
```

### 3.3 Security Changes

**Disable unauthenticated static serving:**

Replace the current open static route:
```typescript
// BEFORE (insecure)
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
```

With a restricted version that blocks direct access:
```typescript
// AFTER — block direct access, files only served through /api/documents
app.use("/uploads", (req, res) => {
  res.status(403).json({ error: "Direct file access is not allowed. Use the documents API." });
});
```

**CORS headers:** Add `Content-Disposition` to `exposedHeaders` in the CORS config so the browser can read the inline disposition header.

### 3.4 Pages to Update

| Page | Current Pattern | New Pattern |
|------|----------------|-------------|
| `admin/exam/cor/page.tsx` | `window.open(\`${BACKEND_URL}/${filePath}\`)` | `<DocumentViewer fetchUrl={\`/api/documents/cor-upload/${id}/file\`} />` |
| `admin/thesis/applications/page.tsx` | `<a href={\`${apiUrl}/${path}\`} target="_blank">` | `<DocumentViewer fetchUrl={\`/api/documents/thesis-document/${docId}/file\`} />` |
| `panelist/materials/page.tsx` | `window.open(url)` | `<DocumentViewer fetchUrl={\`/api/documents/thesis-document/${docId}/file\`} />` |
| `panelist/scoring/[id]/page.tsx` | `<a href={url} target="_blank">` | `<DocumentViewer fetchUrl={\`/api/documents/thesis-document/${docId}/file\`} />` |

Each page replaces its file-opening logic with:
1. State: `const [viewerOpen, setViewerOpen] = useState(false)` + `const [selectedDoc, setSelectedDoc] = useState<{url: string, title: string} | null>(null)`
2. On click: `setSelectedDoc({ url: "/api/documents/...", title: "..." }); setViewerOpen(true)`
3. JSX: `<DocumentViewer open={viewerOpen} onOpenChange={setViewerOpen} fetchUrl={selectedDoc?.url || ""} title={selectedDoc?.title} />`

### 3.5 Files Removed from API Responses

To prevent file paths from leaking in list/detail API responses, remove `filePath` from:

- `CorUpload` responses (already removed in previous work — verify)
- `ThesisDocument` responses in thesis defense endpoints
- `RapReport` responses
- Other models as encountered

This requires updating repository methods to use `select` instead of returning all fields, or adding field exclusion in service/controller layer.

---

## 4. Files to Create/Modify

**New files:**

| File | Purpose |
|------|---------|
| `backend/src/routes/document.routes.ts` | Generic document file-serving route |
| `backend/src/controllers/document.controller.ts` | Model registry, auth check, file streaming |
| `backend/src/services/document.service.ts` | File resolution, path validation, MIME detection |
| `frontend/src/components/ui/document-viewer.tsx` | Reusable modal viewer component |

**Modified files:**

| File | Change |
|------|--------|
| `backend/src/index.ts` | Register `/api/documents` route, restrict static `/uploads` |
| `backend/src/index.ts` | Add `Content-Disposition` to CORS `exposedHeaders` |
| `frontend/src/app/(portal)/admin/exam/cor/page.tsx` | Replace `window.open()` with DocumentViewer |
| `frontend/src/app/(portal)/admin/thesis/applications/page.tsx` | Replace `<a target="_blank">` with DocumentViewer |
| `frontend/src/app/(portal)/panelist/materials/page.tsx` | Replace `window.open()` with DocumentViewer |
| `frontend/src/app/(portal)/panelist/scoring/[id]/page.tsx` | Replace `<a target="_blank">` with DocumentViewer |

---

## 5. Testing Checklist

- [ ] COR Validation: "View Document" opens inline modal with PDF
- [ ] COR Validation: Image CORs display with zoom controls
- [ ] Thesis Applications: "View File" for concept paper opens modal
- [ ] Thesis Applications: "View File" for COR opens modal
- [ ] Thesis Applications: "View File" for receipt opens modal
- [ ] Thesis Applications: "View File" for manuscript opens modal
- [ ] Panelist Materials: document opens in modal
- [ ] Panelist Scoring: document opens in modal
- [ ] Unauthenticated request returns 401
- [ ] Unauthorized role returns 403
- [ ] Direct `/uploads/` access returns 403
- [ ] Path traversal attempt (`../`) returns 403
- [ ] Non-existent record returns 404
- [ ] Non-existent file on disk returns 404
- [ ] Modal closes cleanly (Blob URL revoked, fetch aborted)
- [ ] Loading state shows spinner while fetching
- [ ] Error state shows message on fetch failure
- [ ] Image zoom in/out/reset works correctly
- [ ] PDF renders with native browser controls
- [ ] Responsive layout works on smaller screens

---

## 6. Open Questions

None — all design decisions resolved during brainstorming.
