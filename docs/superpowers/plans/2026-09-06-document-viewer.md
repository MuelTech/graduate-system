# Document Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a secure, reusable inline document viewer modal with a generic backend file-serving endpoint, replacing all `window.open()` / `<a target="_blank">` patterns across admin and panelist pages.

**Architecture:** Single generic backend route `GET /api/documents/:modelType/:id/file` with a model registry for permission resolution. Frontend `DocumentViewer` component accepts a `fetchUrl` prop and renders PDFs via iframe and images via img with zoom. Pages swap their file-opening logic to use the modal.

**Tech Stack:** Express.js, Prisma, Next.js, shadcn/ui Dialog, native browser PDF/image rendering (no external libraries)

## Global Constraints

- Follow 3-layer architecture: Route → Controller → Service → Repository
- Use `AppError` class for errors
- Use `--earist-*` CSS variables for styling
- File naming: `kebab-case` for backend files, `kebab-case.tsx` for components
- Prisma models use UUID primary keys with `@map()` for snake_case columns
- `authenticateJWT` must be applied to all new routes
- Express 5 middleware error handling
- Allowed file types: PDF, JPEG, PNG (already enforced by multer)

---

## File Structure

**New files:**

| File | Responsibility |
|------|---------------|
| `backend/src/routes/document.routes.ts` | Route definition for `/api/documents/:modelType/:id/file` |
| `backend/src/controllers/document.controller.ts` | Model registry, auth + permission check, file streaming |
| `backend/src/services/document.service.ts` | File path resolution, path traversal validation, MIME detection |
| `frontend/src/components/ui/document-viewer.tsx` | Reusable modal: fetch blob → render PDF/image based on MIME type |

**Modified files:**

| File | Change |
|------|--------|
| `backend/src/index.ts` | Register document routes, restrict static `/uploads`, add CORS header |
| `backend/src/routes/index.ts` | Import and mount document routes |
| `frontend/src/app/(portal)/admin/exam/cor/page.tsx` | Replace `window.open()` with DocumentViewer |
| `frontend/src/app/(portal)/admin/thesis/applications/page.tsx` | Replace `<a target="_blank">` with DocumentViewer |
| `frontend/src/app/(portal)/panelist/materials/page.tsx` | Replace `window.open()` with DocumentViewer |
| `frontend/src/app/(portal)/panelist/scoring/[id]/page.tsx` | Replace `<a target="_blank">` with DocumentViewer |

---

### Task 1: Backend — Document Service (file resolution + security)

**Files:**
- Create: `backend/src/services/document.service.ts`

**Interfaces:**
- Consumes: Prisma client, `PRIVATE_UPLOAD_ROOT` from `utils/file.utils.ts`
- Produces: `resolveDocument(modelType, id)` → `{ filePath, mimeType, originalFilename }` or throws AppError

- [ ] **Step 1: Create the document service with model registry and file resolution**

```typescript
// backend/src/services/document.service.ts
import path from "path";
import fs from "fs/promises";
import prisma from "../config/database";
import { AppError } from "../utils/AppError";
import { PRIVATE_UPLOAD_ROOT } from "../utils/file.utils";

interface ModelConfig {
  prismaModel: string;
  fileField: string;
  include?: Record<string, any>;
  getOwnerId: (record: any) => string | null;
  getExtraAuthCheck?: (record: any, userId: string, userRole: string) => boolean;
}

const MODEL_REGISTRY: Record<string, ModelConfig> = {
  "cor-upload": {
    prismaModel: "corUpload",
    fileField: "filePath",
    include: {},
    getOwnerId: (r) => r.userId,
  },
  "thesis-document": {
    prismaModel: "thesisDocument",
    fileField: "filePath",
    include: {
      thesisRecord: {
        include: {
          student: { include: { user: true } },
          defenseSchedules: {
            include: {
              panelAssignments: true,
            },
          },
        },
      },
    },
    getOwnerId: (r) => r.thesisRecord?.student?.userId ?? null,
    getExtraAuthCheck: (record, userId, userRole) => {
      if (userRole === "PANELIST") {
        return record.thesisRecord?.defenseSchedules?.some((ds: any) =>
          ds.panelAssignments?.some((pa: any) => pa.userId === userId)
        ) ?? false;
      }
      return false;
    },
  },
  "rap-report": {
    prismaModel: "rapReport",
    fileField: "filePath",
    include: {},
    getOwnerId: () => null,
  },
  "student-requirement": {
    prismaModel: "studentRequirement",
    fileField: "filePath",
    include: { student: { include: { user: true } } },
    getOwnerId: (r) => r.student?.userId ?? null,
  },
  "plagiarism-result": {
    prismaModel: "plagiarismResult",
    fileField: "filePath",
    include: { student: { include: { user: true } } },
    getOwnerId: (r) => r.student?.userId ?? null,
  },
};

const MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

export class DocumentService {
  async resolveDocument(
    modelType: string,
    id: string,
    userId: string,
    userRole: string
  ): Promise<{ filePath: string; mimeType: string; originalFilename: string }> {
    const config = MODEL_REGISTRY[modelType];
    if (!config) {
      throw new AppError("Unknown document type", 400);
    }

    // Fetch record using raw prisma query to support dynamic model access
    const record = await (prisma as any)[config.prismaModel].findUnique({
      where: { id },
      include: config.include,
    });

    if (!record) {
      throw new AppError("Document not found", 404);
    }

    // Permission check: owner or authorized role
    const isOwner = config.getOwnerId(record) === userId;
    const isAdmin = userRole === "ADMIN";
    const hasExtraAuth = config.getExtraAuthCheck?.(record, userId, userRole) ?? false;

    if (!isOwner && !isAdmin && !hasExtraAuth) {
      throw new AppError("Not authorized to view this document", 403);
    }

    // Extract file path
    const relativePath = record[config.fileField];
    if (!relativePath) {
      throw new AppError("No file attached to this document", 404);
    }

    // Resolve and validate path
    const resolvedPath = path.resolve(relativePath);
    const relative = path.relative(PRIVATE_UPLOAD_ROOT, resolvedPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new AppError("Access denied", 403);
    }

    // Check file exists
    try {
      await fs.access(resolvedPath);
    } catch {
      throw new AppError("File not found on disk", 404);
    }

    // Detect MIME type
    const ext = path.extname(resolvedPath).toLowerCase();
    const mimeType = MIME_MAP[ext] || "application/octet-stream";

    // Original filename from record or fallback
    const originalFilename = record.originalFilename || record.filename || path.basename(resolvedPath);

    return { filePath: resolvedPath, mimeType, originalFilename };
  }
}
```

- [ ] **Step 2: Verify the service compiles**

Run from backend directory: `npx tsc --noEmit --pretty`
Expected: No errors (or only pre-existing errors unrelated to this file)

---

### Task 2: Backend — Document Controller (streaming + auth)

**Files:**
- Create: `backend/src/controllers/document.controller.ts`

**Interfaces:**
- Consumes: `DocumentService` from Task 1, `AuthenticatedRequest` type
- Produces: `getFile` Express handler

- [ ] **Step 1: Create the document controller**

```typescript
// backend/src/controllers/document.controller.ts
import { Response } from "express";
import fs from "fs";
import { DocumentService } from "../services/document.service";
import { AuthenticatedRequest } from "../interfaces/auth.interfaces";
import { AppError } from "../utils/AppError";

export class DocumentController {
  private documentService = new DocumentService();

  getFile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { modelType, id } = req.params;
      const userId = req.user?.userId;
      const userRole = req.user?.role;

      if (!userId || !userRole) {
        throw new AppError("Unauthorized", 401);
      }

      const { filePath, mimeType, originalFilename } =
        await this.documentService.resolveDocument(modelType, id, userId, userRole);

      res.setHeader("Content-Type", mimeType);
      res.setHeader("Content-Disposition", `inline; filename="${originalFilename}"`);
      res.setHeader("Cache-Control", "private, no-store");

      const stream = fs.createReadStream(filePath);
      stream.on("error", (err) => {
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to read file" });
        }
      });
      stream.pipe(res);
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "An unexpected error occurred." });
      }
    }
  };
}
```

- [ ] **Step 2: Verify the controller compiles**

Run from backend directory: `npx tsc --noEmit --pretty`
Expected: No errors related to this new file

---

### Task 3: Backend — Document Route + Registration

**Files:**
- Create: `backend/src/routes/document.routes.ts`
- Modify: `backend/src/routes/index.ts` — add import and mount

**Interfaces:**
- Consumes: `DocumentController` from Task 2
- Produces: Mounted route at `/api/documents`

- [ ] **Step 1: Create the document route**

```typescript
// backend/src/routes/document.routes.ts
import { Router } from "express";
import { DocumentController } from "../controllers/document.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";

const router = Router();
const documentController = new DocumentController();

router.use(authenticateJWT);

router.get("/:modelType/:id/file", documentController.getFile);

export default router;
```

- [ ] **Step 2: Read `backend/src/routes/index.ts` to find where to add the new route**

Read the file and identify the pattern for mounting routes.

- [ ] **Step 3: Add the document route to the index**

Add the import and mount line. Follow the existing pattern. Example:

```typescript
import documentRoutes from "./document.routes";
// ... in the router mounting section:
app.use("/api/documents", documentRoutes);
```

- [ ] **Step 4: Restrict static file serving in `backend/src/index.ts`**

Find the line `app.use("/uploads", express.static(...))` and replace it:

```typescript
// BEFORE
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// AFTER — block direct access, files only served through /api/documents
app.use("/uploads", (_req, res) => {
  res.status(403).json({ error: "Direct file access is not allowed. Use the documents API." });
});
```

- [ ] **Step 5: Add `Content-Disposition` to CORS exposedHeaders in `backend/src/index.ts`**

Find the CORS config and add `Content-Disposition` to `exposedHeaders` if not already present.

- [ ] **Step 6: Restart backend and verify the route exists**

```bash
cd backend && npm run dev
```

Test with curl/PowerShell:
```powershell
Invoke-WebRequest -Uri "http://localhost:5000/api/documents/cor-upload/test-id/file" -Headers @{Authorization="Bearer <token>"} -Method GET
```
Expected: 400 "Unknown document type" (confirms route is registered and reachable)

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/document.service.ts backend/src/controllers/document.controller.ts backend/src/routes/document.routes.ts backend/src/routes/index.ts backend/src/index.ts
git commit -m "feat: add generic document file-serving endpoint with auth"
```

---

### Task 4: Frontend — DocumentViewer Component

**Files:**
- Create: `frontend/src/components/ui/document-viewer.tsx`

**Interfaces:**
- Consumes: shadcn Dialog, session token for auth
- Produces: `<DocumentViewer open onOpenChange fetchUrl title />` component

- [ ] **Step 1: Check if shadcn Dialog is installed**

Read `frontend/src/components/ui/dialog.tsx`. If it doesn't exist, install:
```bash
cd frontend && npx shadcn@latest add dialog
```

- [ ] **Step 2: Create the DocumentViewer component**

```tsx
// frontend/src/components/ui/document-viewer.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw, Loader2, AlertCircle } from "lucide-react";

interface DocumentViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fetchUrl: string;
  title?: string;
}

type LoadState = "idle" | "loading" | "loaded" | "error";

export function DocumentViewer({
  open,
  onOpenChange,
  fetchUrl,
  title,
}: DocumentViewerProps) {
  const { data: session } = useSession();
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("");
  const [zoom, setZoom] = useState(100);
  const [errorMessage, setErrorMessage] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const blobRef = useRef<string | null>(null);

  const cleanup = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (blobRef.current) {
      URL.revokeObjectURL(blobRef.current);
      blobRef.current = null;
      setBlobUrl(null);
    }
  };

  useEffect(() => {
    if (!open || !fetchUrl) {
      cleanup();
      setLoadState("idle");
      setMimeType("");
      setZoom(100);
      setErrorMessage("");
      return;
    }

    const fetchDocument = async () => {
      cleanup();
      setLoadState("loading");
      setZoom(100);
      setErrorMessage("");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const token = (session as any)?.user?.accessToken;
        const headers: Record<string, string> = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const response = await fetch(fetchUrl, {
          headers,
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.error || `Failed to load document (${response.status})`);
        }

        const ct = response.headers.get("Content-Type") || "";
        setMimeType(ct);

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        blobRef.current = url;
        setBlobUrl(url);
        setLoadState("loaded");
      } catch (err: any) {
        if (err.name === "AbortError") return;
        setLoadState("error");
        setErrorMessage(err.message || "Failed to load document");
      }
    };

    fetchDocument();

    return cleanup;
  }, [open, fetchUrl, session]);

  const isPdf = mimeType.includes("application/pdf");
  const isImage = mimeType.includes("image/jpeg") || mimeType.includes("image/png");

  const handleZoomIn = () => setZoom((z) => Math.min(z + 25, 200));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 25, 50));
  const handleZoomReset = () => setZoom(100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="flex flex-row items-center justify-between border-b px-6 py-4">
          <DialogTitle className="text-lg font-semibold truncate pr-4">
            {title || "Document"}
          </DialogTitle>
          {isImage && loadState === "loaded" && (
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleZoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground w-12 text-center">{zoom}%</span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleZoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleZoomReset}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {loadState === "loading" && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-(--earist-primary)" />
              <span className="ml-3 text-sm text-muted-foreground">Loading document...</span>
            </div>
          )}

          {loadState === "error" && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <AlertCircle className="h-10 w-10 text-red-500" />
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
            </div>
          )}

          {loadState === "loaded" && isPdf && blobUrl && (
            <iframe
              src={blobUrl}
              className="w-full h-full border-0"
              title={title || "Document"}
            />
          )}

          {loadState === "loaded" && isImage && blobUrl && (
            <div className="w-full h-full overflow-auto flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
              <img
                src={blobUrl}
                alt={title || "Document"}
                className="max-w-full transition-transform duration-200"
                style={{ transform: `scale(${zoom / 100})`, transformOrigin: "center center" }}
              />
            </div>
          )}

          {loadState === "loaded" && !isPdf && !isImage && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <p className="text-sm text-muted-foreground">
                File type not supported for preview.
              </p>
              <p className="text-xs text-muted-foreground">Content-Type: {mimeType}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Verify the component compiles**

Run from frontend directory: `npx tsc --noEmit --pretty`
Expected: No errors related to the new component

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ui/document-viewer.tsx frontend/src/components/ui/dialog.tsx
git commit -m "feat: add reusable DocumentViewer modal component"
```

---

### Task 5: Update Admin COR Validation Page

**Files:**
- Modify: `frontend/src/app/(portal)/admin/exam/cor/page.tsx`

**Interfaces:**
- Consumes: `DocumentViewer` from Task 4
- Produces: Updated COR page with inline document viewing

- [ ] **Step 1: Read the current COR validation page**

Read `frontend/src/app/(portal)/admin/exam/cor/page.tsx` fully to understand the current structure.

- [ ] **Step 2: Add DocumentViewer import and state**

Add at the top of the component:
```typescript
import { DocumentViewer } from "@/components/ui/document-viewer";
```

Add state for the viewer:
```typescript
const [viewerOpen, setViewerOpen] = useState(false);
const [selectedDoc, setSelectedDoc] = useState<{ url: string; title: string } | null>(null);
```

- [ ] **Step 3: Replace `window.open()` with DocumentViewer trigger**

Find the `window.open()` call and replace with:
```typescript
const token = (session as any)?.user?.accessToken;
setSelectedDoc({
  url: `/api/documents/cor-upload/${selectedCorData.id}/file`,
  title: `${selectedCorData.student.user.firstName} ${selectedCorData.student.user.lastName} — COR`,
});
setViewerOpen(true);
```

- [ ] **Step 4: Add DocumentViewer component to JSX**

Add before the closing `</div>` or `</PageShell>`:
```tsx
{selectedDoc && (
  <DocumentViewer
    open={viewerOpen}
    onOpenChange={setViewerOpen}
    fetchUrl={selectedDoc.url}
    title={selectedDoc.title}
  />
)}
```

- [ ] **Step 5: Verify compilation**

Run from frontend directory: `npx tsc --noEmit --pretty`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/\(portal\)/admin/exam/cor/page.tsx
git commit -m "feat: replace COR validation window.open with DocumentViewer modal"
```

---

### Task 6: Update Admin Thesis Applications Page

**Files:**
- Modify: `frontend/src/app/(portal)/admin/thesis/applications/page.tsx`

**Interfaces:**
- Consumes: `DocumentViewer` from Task 4
- Produces: Updated thesis applications page with inline document viewing

- [ ] **Step 1: Read the current thesis applications page**

Read `frontend/src/app/(portal)/admin/thesis/applications/page.tsx` fully.

- [ ] **Step 2: Add DocumentViewer import and state**

Add at the top:
```typescript
import { DocumentViewer } from "@/components/ui/document-viewer";
```

Add state:
```typescript
const [viewerOpen, setViewerOpen] = useState(false);
const [selectedDoc, setSelectedDoc] = useState<{ url: string; title: string } | null>(null);
```

- [ ] **Step 3: Replace `<a target="_blank">` "View File" links**

Find each `<a href={...} target="_blank">View File</a>` and replace with a button:
```tsx
<Button
  variant="outline"
  size="sm"
  onClick={() => {
    setSelectedDoc({
      url: `/api/documents/thesis-document/${docId}/file`,
      title: `${docName}`,
    });
    setViewerOpen(true);
  }}
>
  <Eye className="mr-1 h-3 w-3" />
  View File
</Button>
```

- [ ] **Step 4: Add DocumentViewer component to JSX**

Add before closing tag:
```tsx
{selectedDoc && (
  <DocumentViewer
    open={viewerOpen}
    onOpenChange={setViewerOpen}
    fetchUrl={selectedDoc.url}
    title={selectedDoc.title}
  />
)}
```

- [ ] **Step 5: Verify compilation**

Run from frontend directory: `npx tsc --noEmit --pretty`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/\(portal\)/admin/thesis/applications/page.tsx
git commit -m "feat: replace thesis applications View File links with DocumentViewer modal"
```

---

### Task 7: Update Panelist Materials and Scoring Pages

**Files:**
- Modify: `frontend/src/app/(portal)/panelist/materials/page.tsx`
- Modify: `frontend/src/app/(portal)/panelist/scoring/[id]/page.tsx`

**Interfaces:**
- Consumes: `DocumentViewer` from Task 4
- Produces: Updated panelist pages with inline document viewing

- [ ] **Step 1: Read both panelist pages**

Read `frontend/src/app/(portal)/panelist/materials/page.tsx` and `frontend/src/app/(portal)/panelist/scoring/[id]/page.tsx`.

- [ ] **Step 2: Update panelist materials page**

Same pattern as Task 5/6:
1. Import DocumentViewer
2. Add state for `viewerOpen` + `selectedDoc`
3. Replace `window.open()` or `<a target="_blank">` with DocumentViewer trigger
4. Add `<DocumentViewer>` component to JSX

- [ ] **Step 3: Update panelist scoring page**

Same pattern:
1. Import DocumentViewer
2. Add state for `viewerOpen` + `selectedDoc`
3. Replace `<a target="_blank">` links with DocumentViewer trigger
4. Add `<DocumentViewer>` component to JSX

- [ ] **Step 4: Verify compilation**

Run from frontend directory: `npx tsc --noEmit --pretty`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/\(portal\)/panelist/materials/page.tsx frontend/src/app/\(portal\)/panelist/scoring/\[id\]/page.tsx
git commit -m "feat: replace panelist document viewing with DocumentViewer modal"
```

---

### Task 8: End-to-End Verification

**Files:** None (verification only)

- [ ] **Step 1: Start backend and verify the document endpoint**

```bash
cd backend && npm run dev
```

Test unauthenticated:
```powershell
Invoke-WebRequest -Uri "http://localhost:5000/api/documents/cor-upload/test/file" -Method GET
```
Expected: 401 Unauthorized

Test direct uploads access:
```powershell
Invoke-WebRequest -Uri "http://localhost:5000/uploads/test.pdf" -Method GET
```
Expected: 403 "Direct file access is not allowed"

- [ ] **Step 2: Start frontend and verify it compiles**

```bash
cd frontend && npm run dev
```
Expected: No compilation errors, dev server starts clean.

- [ ] **Step 3: Manual browser test — COR Validation**

1. Log in as admin
2. Navigate to `/admin/exam/cor`
3. Select a pending COR upload
4. Click "View Document"
5. Verify: Modal opens, PDF/image renders inline
6. Verify: Zoom controls work for images
7. Verify: Closing modal cleans up (no memory leak)

- [ ] **Step 4: Manual browser test — Thesis Applications**

1. Navigate to `/admin/thesis/applications`
2. Click "View" on an application
3. Click "View File" for a document
4. Verify: Modal opens with the correct document

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues from end-to-end verification"
```
