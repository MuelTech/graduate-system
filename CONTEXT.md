# Project Context: EARIST Graduate School Information System

> **Agent Instruction**: Always read this file FIRST before implementing any feature. This ensures consistency with the existing codebase patterns.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                    │
│                    http://localhost:3000                  │
├─────────────────────────────────────────────────────────┤
│  App Router │ shadcn/ui │ TanStack Query │ NextAuth v5  │
└─────────────────────────────────────────────────────────┘
                           │
                    Bearer Token (JWT)
                           │
┌─────────────────────────────────────────────────────────┐
│                    BACKEND (Express.js)                  │
│                    http://localhost:5000/api              │
├─────────────────────────────────────────────────────────┤
│  Controller → Service → Repository → Prisma ORM         │
└─────────────────────────────────────────────────────────┘
                           │
                    MySQL (MariaDB)
```

---

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | Next.js (App Router) | 16.x |
| Language | TypeScript | 5.x |
| UI Library | shadcn/ui | v4 (base-nova style) |
| Styling | Tailwind CSS | v4 |
| State Management | TanStack Query (React Query) | v5 |
| Authentication | NextAuth.js | v5 (beta) |
| Backend | Express.js | 5.x |
| ORM | Prisma | v7 |
| Database | MariaDB (MySQL-compatible) | - |
| Auth Tokens | JWT (jsonwebtoken) | - |
| Password Hashing | bcryptjs | - |
| File Upload | Multer | v2 |
| File Type Detection | file-type | v22 |
| PDF Generation | pdf-lib | - |
| AI Chatbot | Qwen + LangChain RAG | - |
| AI Runtime | Ollama (local) | - |
| Vector Store | ChromaDB | - |
| OCR | Tesseract.js | - |
| Plagiarism Check | STRIKE API | - |
| Data Visualization | Chart.js | - |
| Deployment | PM2 + Nginx | - |

---

## System Workflow (12 Phases)

| Phase | Description |
|-------|-------------|
| Phase 1 | System Users & Access Levels (Admin, Panelist, Applicant/Student, Custom Roles) |
| Phase 2 | Entrance Examination (Pinnacle registration → Alignment Check → Exam → COR Upload) |
| Phase 3 | Comprehensive Examination (Manual/Admin-Verified, face-to-face paper-based) |
| Phase 4 | Student Portal Features (Dashboard, Profile, Curriculum, AI Chatbot, Notifications) |
| Phase 5 | Panelist Portal (Defense participation, Scoring, E-Signatures) |
| Phase 6 | Thesis/Dissertation Workflow Overview (3 sequential defense stages) |
| Phase 7 | Title Defense (Student proposes 3 titles → Panel selects 1) |
| Phase 8 | Proposal Defense (Chapters 1-3 defense) |
| Phase 9 | Final Defense (Complete manuscript defense + STRIKE plagiarism check) |
| Phase 10 | Research Databank & Repository (Digital storage, public access) |
| Phase 11 | Additional Processes (Expert Evaluation, E-Signatures, Adviser Management, Analytics, Settings) |
| Phase 12 | Master Workflow Summary (Complete journey from admission to completion) |

---

## AI & RAG Architecture (Planned)

```
Student asks chatbot
        ↓
Retriever finds related content (ChromaDB)
        ↓
Qwen generates contextual response via LangChain
```

| Component | Technology | Purpose |
|-----------|------------|---------|
| LLM | Qwen2.5:7B | Generate responses |
| AI Runtime | Ollama | Local model hosting |
| RAG Framework | LangChain | Query processing pipeline |
| Vector Store | ChromaDB | Store document embeddings |
| OCR | Tesseract.js | Extract text from COR documents |

---

## Folder Structure

```
graduate-system/
├── frontend/
│   └── src/
│       ├── app/                    # Next.js App Router
│       │   ├── (auth)/            # Login, Register (no layout wrapper)
│       │   ├── (public)/          # Landing, Programs, Repository, FAQ, About
│       │   ├── (portal)/          # Role-based dashboards
│       │   │   ├── admin/         # Admin portal pages
│       │   │   ├── student/       # Student portal pages
│       │   │   ├── applicant/     # Applicant portal pages
│       │   │   └── panelist/      # Panelist portal pages
│       │   ├── api/auth/          # NextAuth catch-all route
│       │   └── api/documents/     # Document proxy to backend
│       ├── components/
│       │   ├── ui/                # shadcn/ui primitives
│       │   ├── landing/           # Landing page components
│       │   ├── layout/            # NotificationBell
│       │   ├── providers/         # SessionProvider, QueryProvider
│       │   └── chatbot/           # AI chatbot widget
│       ├── lib/
│       │   ├── api.client.ts      # Client-side API helper
│       │   ├── api.server.ts      # Server-side API helper
│       │   └── utils.ts           # cn() utility
│       ├── types/
│       │   └── index.ts           # Shared TypeScript interfaces
│       ├── auth.ts                # NextAuth config
│       └── middleware.ts          # Route protection
│
├── backend/
│   └── src/
│       ├── controllers/           # Request handlers
│       ├── services/              # Business logic
│       ├── repositories/          # Data access (Prisma)
│       ├── routes/                # Express route definitions
│       ├── middlewares/           # auth, upload
│       ├── interfaces/            # TypeScript interfaces
│       ├── config/                # database.ts (PrismaClient)
│       └── utils/                 # AppError, file.utils (PRIVATE_UPLOAD_ROOT), email mock
│   └── prisma/
│       ├── schema.prisma          # Database schema (40+ models)
│       └── seed.ts                # Test data seeder
```

---

## Coding Conventions

### File Naming
| Location | Convention | Example |
|----------|------------|---------|
| Backend files | kebab-case | `auth.controller.ts`, `thesis.service.ts` |
| Frontend components | kebab-case | `chatbot-widget.tsx`, `notification-bell.tsx` |
| Next.js pages | page.tsx | `dashboard/page.tsx` |
| Types/Interfaces | PascalCase exports | `PanelistAssignmentData` |

### Database
| Element | Convention | Example |
|---------|------------|---------|
| Table names | snake_case | `thesis_records`, `oral_exam_scores` |
| Column names | snake_case with `@map()` | `userId` → `user_id` |
| Model names | PascalCase | `ThesisRecord`, `OralExamScore` |
| Enums | SCREAMING_SNAKE | `UserRole.ADMIN`, `ThesisStage.TITLE` |

### API Routes
| Rule | Example |
|------|---------|
| Lowercase | `/api/panelists` |
| Plural nouns | `/api/memos`, `/api/notifications` |
| Nested resources | `/api/thesis/defense/title` |
| Action verbs | `/api/thesis/defense/:id/status` |

---

## Backend Patterns

### 3-Layer Architecture
```
Route → Controller → Service → Repository → Prisma
```

### Controller Pattern
```typescript
import { Request, Response } from "express";
import { SomeService } from "../services/some.service";
import { AppError } from "../utils/AppError";

export class SomeController {
    private someService = new SomeService();

    methodName = async (req: Request, res: Response): Promise<void> => {
        try {
            const result = await this.someService.methodName(req.body);
            res.status(200).json(result);
        } catch (error: unknown) {
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

### Service Pattern
```typescript
import { SomeRepository } from '../repositories/some.repository';
import { AppError } from '../utils/AppError';

export class SomeService {
    private someRepository = new SomeRepository();

    async methodName(data: InputType): Promise<OutputType> {
        // 1. Validate
        if (!data.field) {
            throw new AppError("Field is required!", 400);
        }

        // 2. Business logic
        const result = await this.someRepository.findSomething(data.field);
        if (!result) {
            throw new AppError("Not found!", 404);
        }

        // 3. Return
        return result;
    }
}
```

### Repository Pattern
```typescript
import prisma from '../config/database';
import { Prisma } from '@prisma/client';

export class SomeRepository {
    async findSomething(id: string) {
        return prisma.someModel.findUnique({
            where: { id },
            include: { relatedModel: true }
        });
    }

    async createSomething(data: Prisma.SomeModelCreateInput) {
        return prisma.someModel.create({ data });
    }

    // Atomic transactions
    async complexOperation(data1: any, data2: any) {
        return prisma.$transaction(async (tx) => {
            const result1 = await tx.model1.create({ data: data1 });
            const result2 = await tx.model2.create({ 
                data: { ...data2, model1: { connect: { id: result1.id } } }
            });
            return result1;
        });
    }
}
```

### Pagination & Filtering Pattern (Hybrid)

Use **server-side** pagination and filtering for read-only data tables where the user browses, searches, and filters records. Use **client-side** pagination and filtering for small bounded datasets or pages where all data is needed for interactive workflows (e.g., selecting an item to act on it).

| Approach | When to use | Example |
|----------|-------------|---------|
| **Server-side** | Read-only list/table, dataset grows over time, user searches/filters across many records | Score Review, Applicants, Students |
| **Client-side** | Small bounded dataset, all data needed for interaction, dataset won't grow significantly | Exam Slots, Grading Queue (needs all items for essay grading form) |

#### Server-Side Pattern

Admin list endpoints that are read-only and grow over time MUST accept `page`, `pageSize`, and `search` query params and return `{ data, total, page, pageSize }`.

```typescript
// Repository: accept params, return [data, total]
async findManyPaginated(params: {
    page: number;
    pageSize: number;
    search?: string;
    [filterKey: string]: unknown;
}) {
    const { page, pageSize, search, ...filters } = params;
    const where = buildWhereClause(filters, search);

    const [data, total] = await prisma.$transaction([
        prisma.model.findMany({
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
            include: { /* relations */ },
            orderBy: { createdAt: 'desc' },
        }),
        prisma.model.count({ where }),
    ]);

    return { data, total, page, pageSize };
}
```

```typescript
// Controller: parse query params, pass to service
const { page = 1, pageSize = 10, search, ...filters } = req.query;
const result = await this.service.findManyPaginated({
    page: Number(page),
    pageSize: Number(pageSize),
    search: search as string,
    ...filters,
});
res.status(200).json(result);
```

### Route Pattern
```typescript
import { Router } from "express";
import { SomeController } from "../controllers/some.controller";
import { authenticateJWT, requireRole } from "../middlewares/auth.middleware";
import { upload } from "../middlewares/upload.middleware";

const router = Router();
const someController = new SomeController();

// Public route
router.get("/public", someController.getPublicData);

// Authenticated route
router.get("/protected", authenticateJWT, someController.getProtectedData);

// Role-restricted route
router.post("/admin-only", authenticateJWT, requireRole(["ADMIN"]), someController.adminAction);

// File upload route
router.post("/upload", authenticateJWT, requireRole(["STUDENT"]), 
    upload.single("file"), someController.uploadFile);

// Multiple file upload
router.post("/multi-upload", authenticateJWT, 
    upload.fields([
        { name: "document", maxCount: 1 },
        { name: "cor", maxCount: 1 },
    ]),
    someController.multiUpload
);

export default router;
```

### Error Handling
```typescript
import { AppError } from "../utils/AppError";

// Custom error class
export class AppError extends Error {
    constructor(
        public message: string,
        public statusCode: number,
        public isOperational = true
    ) {
        super(message);
    }
}

// Usage in services
throw new AppError("Email is already registered!", 409);
throw new AppError("Not found!", 404);
throw new AppError("Unauthorized!", 401);
```

---

## Frontend Patterns

### API Client Usage
```typescript
// Client-side (in "use client" components)
import { apiClientRequest } from "@/lib/api.client";

const data = await apiClientRequest("/endpoint");
const result = await apiClientRequest("/endpoint", {
    method: "POST",
    body: JSON.stringify(payload)
});
```

### TanStack Query Pattern
```typescript
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";

export default function SomePage() {
    const queryClient = useQueryClient();

    // Fetch data
    const { data, isLoading, error } = useQuery({
        queryKey: ["dataKey"],
        queryFn: async () => {
            const res = await apiClientRequest("/endpoint");
            return Array.isArray(res) ? res : [];
        },
    });

    // Mutation
    const mutation = useMutation({
        mutationFn: async (payload: PayloadType) => {
            return await apiClientRequest("/endpoint", {
                method: "POST",
                body: JSON.stringify(payload)
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["dataKey"] });
        }
    });

    // Trigger mutation
    mutation.mutate(payload);
}
```

### Server Component Pattern
```typescript
import { auth } from "@/auth";

export default async function SomePage() {
    const session = await auth();
    const apiUrl = process.env.BACKEND_API_URL || "http://localhost:5000";
    
    const res = await fetch(`${apiUrl}/api/endpoint`, {
        headers: { Authorization: `Bearer ${session?.user?.accessToken}` },
        cache: "no-store",
    });
    
    const data = await res.json();
    return <div>...</div>;
}
```

### Component Pattern
```typescript
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SomeIcon } from "lucide-react";

export default function SomeComponent() {
    return (
        <Card className="overflow-hidden transition-all hover:shadow-md">
            <div className="h-1.5 w-full bg-(--earist-primary)"></div>
            <CardContent className="p-5">
                <Badge className="bg-purple-100 text-purple-700">Status</Badge>
                <Button className="bg-(--earist-primary) hover:bg-(--earist-primary)/90">
                    Action
                </Button>
            </CardContent>
        </Card>
    );
}
```

### Data Table Filter & Pagination Pattern

Never implement filter state, filter logic, or pagination UI inline in a page. Always use `DataTableFilter` for the filter bar. Use server-side pagination for read-only tables that grow over time; client-side is acceptable for small bounded datasets (see Pagination & Filtering Pattern).

```typescript
// components/admin/data-table-filter.tsx
// Shared filter component — use on ALL admin list pages
// Props: search config, filter dropdowns, callbacks
// Handles: search input with icon, Select dropdowns, clear button, page reset

<DataTableFilter
    search={{ placeholder: "Search by name or ID..." }}
    filters={[
        { key: "status", label: "Status", value: statusFilter, options: ["PASSED", "FAILED"], onChange: setStatusFilter },
        { key: "program", label: "Program", value: programFilter, options: uniquePrograms, onChange: setProgramFilter },
    ]}
    onClear={clearFilters}
/>
```

```typescript
// TanStack Query: include filter + pagination params in queryKey
const { data, isLoading } = useQuery({
    queryKey: ["scoreReview", page, searchQuery, statusFilter, programFilter],
    queryFn: async () => {
        const params = new URLSearchParams({
            page: page.toString(),
            pageSize: "10",
            search: searchQuery,
            status: statusFilter,
            program: programFilter,
        });
        return apiClientRequest(`/exam/scores/review?${params.toString()}`);
    },
});

// Use server response for pagination
const items = data?.data || [];
const total = data?.total || 0;
const totalPages = Math.ceil(total / 10);
```

### Styling with EARIST Brand Colors
```tsx
// Use CSS variables for brand colors
<div className="text-(--earist-primary)">Primary text</div>
<div className="bg-(--earist-accent)">Gold background</div>
<Button className="bg-(--earist-primary) hover:bg-(--earist-primary)/90">

// Available brand colors:
// --earist-primary: #8B1A1A (deep red/maroon)
// --earist-secondary: #A83240 (lighter red)
// --earist-accent: #D4A843 (gold)
// --earist-body-text: body text color
// --earist-border-gray: border color
```

---

## Document Upload & Viewing System

### Architecture

```
Browser (localhost:3000)
  │
  ├─ DocumentViewer component ──fetch──→ /api/documents/[...path] (Next.js proxy)
  │                                         │
  │                                    auth() session token
  │                                         │
  │                                    ──→ Backend /api/documents/:modelType/:id/file
  │                                              │
  │                                     authenticateJWT → DocumentService
  │                                              │
  │                                     ModelRegistry lookup → ownership check → stream file
  │
  └─ Applicant upload ──fetch (FormData)──→ /api/cor/upload (Backend directly)
```

### File Upload Pattern

**Upload middleware** (`backend/src/middlewares/upload.middleware.ts`):
- Uses `crypto.randomBytes(24)` for filenames — never derives from user input
- Uses `PRIVATE_UPLOAD_ROOT` from `file.utils.ts` as the destination
- No client-trusting MIME filter — actual validation happens in the service layer via `file-type` magic bytes
- File size limit from `MAX_FILE_SIZE` env var (default 5MB)

**Service-level file validation** (e.g., `cor.service.ts`):
1. Validate student exists and has passed entrance exam
2. Check for duplicate active uploads (prevent orphaned files)
3. Validate file contents via `file-type` (`fileTypeFromFile`) — reject if not PDF/JPEG/PNG
4. Rename file to correct extension based on detected MIME type
5. Store `detectedMimeType` in the database
6. **Cleanup on any error**: delete the file if DB insert fails, validation fails, or any business rule is violated

```typescript
// Correct pattern for file upload with validation
import { fileTypeFromFile } from "file-type";

async uploadCor(userId: string, file: Express.Multer.File) {
    // 1. Business validation
    const student = await this.repo.findStudentByUserId(userId);
    if (!student) { await this.safeDeleteFile(file.path); throw new AppError("...", 404); }

    // 2. Magic-byte validation (do NOT trust client MIME)
    const detected = await fileTypeFromFile(file.path);
    if (!detected?.mime || !ALLOWED_MIME_TYPES.includes(detected.mime)) {
        await this.safeDeleteFile(file.path);
        throw new AppError("Invalid file content.", 400);
    }

    // 3. Rename to correct extension
    const correctExt = EXTENSION_MAP[detected.mime];
    if (correctExt && !file.path.endsWith(correctExt)) {
        const newPath = file.path + correctExt;
        await fs.rename(file.path, newPath);
        file.path = newPath;
    }

    // 4. DB insert with cleanup on failure
    try {
        return await this.repo.createUpload({ ... });
    } catch (error) {
        await this.safeDeleteFile(file.path);
        throw error;
    }
}
```

### Document Viewing Pattern

**Document proxy** (`frontend/src/app/api/documents/[...path]/route.ts`):
- Server-side only: uses `auth()` session token, never trusts browser Authorization header
- Streams `response.body` directly (no `arrayBuffer()` buffering)
- Validates path: exactly `[modelType, id, "file"]`
- Model type allowlist: `cor-upload`, `thesis-document`, `rap-report`, `student-requirement`, `plagiarism-result`
- Non-2xx responses passed through as-is (JSON errors from backend)
- Document headers (`Cache-Control`, `Content-Disposition`, `X-Content-Type-Options`) only on 2xx

**Document service** (`backend/src/services/document.service.ts`):
- `MODEL_REGISTRY` maps model types to Prisma models, file fields, includes, and owner resolution
- **Ownership check**: owner (student's userId), admin, or authorized panelist
- **Path traversal prevention**: `path.basename()` strips directory components, `path.relative()` validates within `PRIVATE_UPLOAD_ROOT`
- **Symlink prevention**: `fs.realpath()` resolves symlinks before path check
- **Active user check**: disabled users cannot view documents
- **Audit logging**: successful views and denied access attempts are logged
- **MIME detection**: from file extension via `MIME_MAP`

**DocumentViewer component** (`frontend/src/components/ui/document-viewer.tsx`):
- Only accepts relative `/api/` paths (prevents JWT exfiltration)
- Uses typed NextAuth session for token (no `as any`)
- Streams response as blob, creates object URL for PDF iframe or image
- Abort controller cleanup on unmount/close
- Blob URL revocation on cleanup
- `react-hooks/set-state-in-effect` compliant: loading state set via open/URL change transition effect, not synchronous in fetch effect

### File Path Resolution

The `filePath` stored in the database can be:
- Absolute: `D:\...\backend\uploads\abc123.pdf` (from multer)
- Relative: `uploads/abc123.pdf` (from older uploads)

Resolution logic:
```typescript
// document.service.ts
let resolvedPath = path.isAbsolute(storedPath)
    ? storedPath
    : path.join(PRIVATE_UPLOAD_ROOT, path.basename(storedPath));

// Resolve symlinks
resolvedPath = await fs.realpath(resolvedPath);

// Validate within upload root
const realUploadRoot = await fs.realpath(PRIVATE_UPLOAD_ROOT);
const relative = path.relative(realUploadRoot, resolvedPath);
if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new AppError("Access denied", 403);
}
```

### Security Rules for Document Features

1. **Never trust client MIME types** — use `file-type` magic-byte validation
2. **Never use `file.originalname` for physical filenames** — use `crypto.randomBytes`
3. **Always clean up files on error** — delete the uploaded file if any validation or DB operation fails
4. **Never expose `filePath` in API responses** — use safe field selection in repository queries
5. **Sanitize filenames in Content-Disposition headers** — strip to `[a-zA-Z0-9._-]`, max 255 chars
6. **Validate file paths with `fs.realpath()`** — prevents symlink escapes
7. **Check user `isActive` status** — disabled users cannot view documents
8. **Log audit events** — upload, verify, reject, view, denied access
9. **Prevent duplicate active uploads** — check for existing PENDING uploads before allowing new ones
10. **Stream responses** — use `response.body` streaming, not `arrayBuffer()` buffering

### COR Upload Status Lifecycle

```
Applicant uploads COR → PENDING
  │
  ├─ Admin verifies → VERIFIED (student promoted to ENROLLED)
  │
  └─ Admin rejects → REJECTED (applicant can re-upload)
```

### Future: Thesis Document & Panelist Document Interaction

The document system is designed to extend to the thesis journey and panelist workflows:

| Feature | Model Type | Owner | Extra Auth |
|---------|-----------|-------|------------|
| COR upload/view | `cor-upload` | Student (via userId) | Admin |
| Thesis documents | `thesis-document` | Student (via thesis→student) | Panelist (if assigned to defense) |
| RAP report | `rap-report` | Admin only | — |
| Student requirements | `student-requirement` | Student (via userId) | Admin |
| Plagiarism results | `plagiarism-result` | Student (via thesis→student) | Admin |

**Planned thesis document features**:
- Students upload thesis chapters during proposal/final defense stages
- Panelists view and download thesis documents during defense
- Panelists score and annotate documents
- E-signatures on thesis approval forms
- STRIKE plagiarism check results as viewable documents

**To add a new document type**:
1. Add model to `MODEL_REGISTRY` in `document.service.ts`
2. Add model type to `ALLOWED_MODEL_TYPES` in the Next.js proxy route
3. Add ownership resolution logic (`getOwnerId`, `getExtraAuthCheck`)
4. Store files using the same upload middleware pattern
5. Use `safeDeleteFile()` cleanup pattern on all error paths

---

## Authentication Flow

### Login Flow
```
1. Frontend: signIn("credentials", { email, password })
2. NextAuth: authorize() → POST /api/auth/login
3. Backend: Find user → bcrypt.compare() → jwt.sign()
4. NextAuth: Store JWT in session → Redirect to /{role}/dashboard
```

### Multi-Role Login
| Role | Login Fields |
|------|--------------|
| Applicant | Applicant ID + Password |
| Student | Student ID + Birthdate + Password |
| Admin/Panelist | Email + Password |

### Route Protection (middleware.ts)
```typescript
// Checks session + role, redirects unauthorized users
if (path.startsWith("/applicant") && role !== "applicant") {
    return NextResponse.redirect(new URL(`/${role}/dashboard`, req.url));
}
```

---

## Database Schema Reference

### Key Models (40+)
| Model | Purpose |
|-------|---------|
| User | Central identity (email, password, role) |
| Student | Student profile linked to User |
| Panelist | Panelist profile linked to User |
| Program | Graduate programs |
| UndergraduateProgram | Undergraduate programs |
| ThesisRecord | Core thesis pipeline entity |
| DefenseSchedule | Defense scheduling |
| PanelAssignment | Panelist assignments |
| OralExamScore | Defense grading |
| RapReport | RAP Report generation |
| RapReportSignature | E-signatures |
| EntranceExamApplication | Exam applications |
| ExamSlot | Exam scheduling |
| CorUpload | COR uploads (with status: PENDING/VERIFIED/REJECTED) |
| CorRecord | COR verification |
| ApplicantBridgingWaiver | Program alignment waivers |
| Notification | In-app notifications |
| Memo | Announcements |
| SystemSetting | System configuration |
| AuditLog | Admin action tracking |

### Key Enums
| Enum | Values |
|------|--------|
| UserRole | ADMIN, STUDENT, PANELIST, CUSTOM, APPLICANT |
| AdmissionStatus | APPLICANT, PENDING_WAIVER, CLEARED, ENROLLED, etc. |
| ThesisStage | TITLE, PROPOSAL, FINAL |
| ThesisStatus | PENDING, SCHEDULED, PASSED, FAILED, REVISION |
| DefenseType | TITLE_DEFENSE, PROPOSAL_DEFENSE, FINAL_DEFENSE |
| AlignmentStatus | ALIGNED, PENDING_WAIVER, CLEARED |
| CorUploadStatus | PENDING, VERIFIED, REJECTED |

---

## Existing Components to Reuse

### shadcn/ui Primitives
- Alert, Badge, Button, Card, Input, Label, Select, Separator, Tabs, Textarea, Sonner (toasts)

### Custom Components
- `ChatbotWidget` - AI chatbot (currently keyword-based)
- `NotificationBell` - Real-time notifications with polling
- `DataTableFilter` - Reusable search + dropdown filter bar for admin list pages

### Layout Components
- Sidebar navigation (collapsible)
- Role-based portal layouts
- Dashboard bento grid layout

### Landing Page Components (11)
- Navbar, HeroSection, ProgramsSection, HowItWorksSection
- RepositorySection, AnnouncementsSection, CtaSection
- FeaturesSection, PortalSection, Footer

### Portal Page Routes

| Portal | Routes |
|--------|--------|
| **Applicant** | `/applicant/dashboard`, `/applicant/profile`, `/applicant/alignment`, `/applicant/schedule`, `/applicant/exam`, `/applicant/results`, `/applicant/cor-upload`, `/applicant/notifications` |
| **Student** | `/student/dashboard`, `/student/profile`, `/student/curriculum`, `/student/journey`, `/student/thesis/*`, `/student/plagiarism`, `/student/repository`, `/student/notifications` |
| **Panelist** | `/panelist/dashboard`, `/panelist/profile`, `/panelist/defenses`, `/panelist/materials`, `/panelist/scoring/[id]`, `/panelist/signatures`, `/panelist/repository`, `/panelist/notifications` |
| **Admin** | `/admin/dashboard`, `/admin/users/*`, `/admin/exam/*`, `/admin/thesis/*`, `/admin/repository`, `/admin/memos`, `/admin/calendar`, `/admin/analytics`, `/admin/settings`, `/admin/notifications` |

### Email Notification Triggers

| Trigger | Template Key | Recipient |
|---------|--------------|-----------|
| Exam slot confirmed | `exam_slot_confirmed` | Applicant |
| Exam results released | `ecat_result_pass` / `ecat_result_fail` | Applicant |
| COR verified | `cor_verified_promotion` | Applicant → Student |
| Defense scheduled | `defense_scheduled` | Student + Panelists |
| RAP Report distributed | `rap_distributed` | All Panelists |
| STRIKE result | `strike_result` | Student |
| Adviser assigned | `adviser_assigned` | Student + Adviser |
| Memo broadcast | `memo_broadcast` | Targeted audience |

### Key Status Flows

| Status | Badge Color | Trigger |
|--------|-------------|---------|
| `applicant` | Gray | Initial registration |
| `pending_waiver` | Amber | Program misaligned, waiver required |
| `cleared` | Blue | Waiver validated, scheduling unlocked |
| `Exam Scheduled` | Blue | Slot selected and locked |
| `Exam Passed` | Green | MCQ + essay graded |
| `COR Pending` | Gold | COR uploaded, awaiting verification |
| `enrolled` | Green | COR verified, full Student access |

---

## Development Workflow

### Adding a New Feature
1. **Backend**: Create route → controller → service → repository
2. **Frontend**: Create page in appropriate portal folder
3. **Filters**: If the page has a data table, use `DataTableFilter` component + server-side pagination (see Frontend Patterns)
4. **Types**: Add interfaces to `src/types/index.ts`
5. **Schema**: Add model to `prisma/schema.prisma` if needed
6. **File uploads** (if applicable): Use upload middleware + `file-type` validation + `safeDeleteFile` cleanup pattern (see Document Upload & Viewing System)
7. **Document viewing** (if applicable): Add model to `MODEL_REGISTRY` + proxy allowlist + ownership check (see Document Upload & Viewing System)
8. **Audit logging** (if applicable): Log security events via repository `createAuditLog()` method

### Testing
- Backend: `npm run dev` (port 5000)
- Frontend: `npm run dev` (port 3000)
- Database: MariaDB on port 3306

### Common Commands
```bash
# Backend
cd backend && npm run dev

# Frontend
cd frontend && npm run dev

# Database migrations
cd backend && npx prisma migrate dev

# Seed database
cd backend && npx prisma db seed
```

### Deployment Setup
```bash
# Backend (PM2)
pm2 start dist/index.js --name "graduate-backend"

# Frontend (PM2)
pm2 start npm --name "graduate-frontend" -- run start

# Nginx config
# Proxy / → localhost:3000 (Frontend)
# Proxy /api → localhost:5000 (Backend)
```

---

## Important Notes

1. **Never modify existing patterns** - Follow the 3-layer architecture exactly
2. **Use existing components** - Check `components/ui/` before creating new ones
3. **Follow naming conventions** - kebab-case files, PascalCase components
4. **Use brand colors** - Always use `--earist-*` CSS variables
5. **Handle errors consistently** - Use AppError class with proper status codes
6. **Validate at boundaries** - User input validation in controllers/services
7. **Atomic operations** - Use Prisma transactions for multi-table operations
8. **Pagination & filtering approach** - Use server-side pagination for read-only data tables that grow over time. Use client-side pagination for small bounded datasets or interactive workflows. See Pagination & Filtering Pattern (Hybrid).
9. **Reuse DataTableFilter** - Never implement filter state or UI inline. Use the shared DataTableFilter component on all admin list pages.
10. **File upload security** - Never trust client MIME types. Use `file-type` magic-byte validation. Use `crypto.randomBytes` for filenames. Always clean up files on error. See Document Upload & Viewing System section.
11. **Document viewing security** - Never expose `filePath` in API responses. Validate paths with `fs.realpath()`. Check `isActive` on users. Use the document proxy for same-origin requests. See Document Upload & Viewing System section.
12. **Audit logging** - Log security-relevant events (uploads, views, verifications, denials) using the existing `AuditLog` model via repository `createAuditLog()` methods.

---

*Last updated: September 2026 — Document upload/viewing security hardening, COR status lifecycle, file-type validation, audit logging, future thesis/panelist document plans*
