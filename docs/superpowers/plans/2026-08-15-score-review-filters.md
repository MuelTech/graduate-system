# Score Review Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a horizontal filter bar to the Score Review tab in the admin exam scores page, enabling filtering by search (name/ID), status, program, date range, and grader.

**Architecture:** Client-side filtering — fetch all scores once from existing API, add filter state and UI controls to the page component, filter in-browser using `useMemo`. No backend changes required.

**Tech Stack:** React, TypeScript, shadcn/ui (Input, Select, Button), Lucide icons (Search, X), existing Pagination component

## Global Constraints

- Follow existing admin page patterns (client-side pagination, shadcn/ui components)
- Page size: 10 items per page
- Use existing `ExamAppResponse` type from `frontend/src/types/index.ts`
- No backend API changes — all filtering is client-side
- Branch: `feature/score-review-filters`

---

## File Structure

| File | Change | Purpose |
|------|--------|---------|
| `frontend/src/app/(portal)/admin/exam/scores/page.tsx` | Modify | Add filter state, filter bar UI, filtering logic, unique values computation |

Single file change — the page component already has all the data fetching and table rendering. We're adding filter controls and filtering logic.

---

### Task 1: Add Filter State Variables

**Files:**
- Modify: `frontend/src/app/(portal)/admin/exam/scores/page.tsx` (add state variables after existing state)

**Interfaces:**
- Consumes: Existing `scores` state (array of `ExamAppResponse`)
- Produces: Filter state variables used by filter bar and filtering logic

- [ ] **Step 1: Add filter state variables**

Add these state variables after the existing `currentPage` state in `AdminExamScoresPage`:

```typescript
// Filter state
const [searchQuery, setSearchQuery] = useState("");
const [statusFilter, setStatusFilter] = useState("all");
const [programFilter, setProgramFilter] = useState("all");
const [dateFrom, setDateFrom] = useState("");
const [dateTo, setDateTo] = useState("");
const [gradedByFilter, setGradedByFilter] = useState("all");
```

- [ ] **Step 2: Verify the app still runs**

Run: `npm run dev` in the frontend directory
Expected: App starts without errors, Score Review tab still works (filters not yet visible)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/(portal)/admin/exam/scores/page.tsx
git commit -m "feat(scores): add filter state variables for Score Review tab"
```

---

### Task 2: Compute Unique Values for Dropdowns

**Files:**
- Modify: `frontend/src/app/(portal)/admin/exam/scores/page.tsx` (add useMemo hooks)

**Interfaces:**
- Consumes: `scores` state (array of `ExamAppResponse`)
- Produces: `uniquePrograms` and `uniqueGraders` arrays for dropdown options

- [ ] **Step 1: Add unique programs computation**

Add this `useMemo` after the filter state variables:

```typescript
const uniquePrograms = useMemo(() => {
  const programs = new Set(scores.map((s) => s.program.programName));
  return Array.from(programs).sort();
}, [scores]);
```

- [ ] **Step 2: Add unique graders computation**

Add this `useMemo` after the unique programs:

```typescript
const uniqueGraders = useMemo(() => {
  const graders = new Set(
    scores
      .filter((s) => s.score?.gradedBy)
      .map((s) => `${s.score!.gradedBy!.firstName} ${s.score!.gradedBy!.lastName}`)
  );
  return Array.from(graders).sort();
}, [scores]);
```

- [ ] **Step 3: Verify the app still runs**

Run: `npm run dev` in the frontend directory
Expected: App starts without errors, no visible changes yet

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/(portal)/admin/exam/scores/page.tsx
git commit -m "feat(scores): add unique values computation for filter dropdowns"
```

---

### Task 3: Add Filtering Logic

**Files:**
- Modify: `frontend/src/app/(portal)/admin/exam/scores/page.tsx` (add useMemo for filtered scores)

**Interfaces:**
- Consumes: `scores` state, all filter state variables
- Produces: `filteredScores` array used by the table

- [ ] **Step 1: Add filtered scores computation**

Add this `useMemo` after the unique values computations:

```typescript
const filteredScores = useMemo(() => {
  return scores.filter((score) => {
    // Search filter (name + Pinnacle ID)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const name = `${score.student.user.firstName} ${score.student.user.lastName}`.toLowerCase();
      const username = score.student.user.username?.toLowerCase() || "";
      if (!name.includes(query) && !username.includes(query)) return false;
    }
    // Status filter
    if (statusFilter !== "all" && score.score?.status !== statusFilter) return false;
    // Program filter
    if (programFilter !== "all" && score.program.programName !== programFilter) return false;
    // Date range filter
    if (dateFrom && new Date(score.createdAt) < new Date(dateFrom)) return false;
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999); // Include the entire "To" day
      if (new Date(score.createdAt) > to) return false;
    }
    // Graded By filter
    if (gradedByFilter !== "all") {
      const graderName = `${score.score?.gradedBy?.firstName} ${score.score?.gradedBy?.lastName}`;
      if (graderName !== gradedByFilter) return false;
    }
    return true;
  });
}, [scores, searchQuery, statusFilter, programFilter, dateFrom, dateTo, gradedByFilter]);
```

- [ ] **Step 2: Update table to use filteredScores**

Find the existing code that renders the Score Review table rows. It likely iterates over `scores` or a paginated subset. Change it to use `filteredScores` instead.

Look for code like:
```typescript
const paginatedScores = scores.slice(...)
```

Change to:
```typescript
const paginatedScores = filteredScores.slice(...)
```

Also update any `totalPages` calculation to use `filteredScores.length` instead of `scores.length`.

- [ ] **Step 3: Verify filtering works**

Run: `npm run dev` in the frontend directory
Expected: App starts. Filtering won't be testable yet (no UI controls), but the table should still render correctly using `filteredScores` (which defaults to all scores when no filters are active)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/(portal)/admin/exam/scores/page.tsx
git commit -m "feat(scores): add client-side filtering logic for Score Review"
```

---

### Task 4: Add Clear Filters Logic

**Files:**
- Modify: `frontend/src/app/(portal)/admin/exam/scores/page.tsx` (add clearFilters function and hasActiveFilters computed value)

**Interfaces:**
- Consumes: All filter state variables
- Produces: `hasActiveFilters` boolean, `clearFilters` function

- [ ] **Step 1: Add hasActiveFilters computation**

Add this `useMemo` after the filteredScores computation:

```typescript
const hasActiveFilters = useMemo(() => {
  return searchQuery !== "" || statusFilter !== "all" || programFilter !== "all"
    || dateFrom !== "" || dateTo !== "" || gradedByFilter !== "all";
}, [searchQuery, statusFilter, programFilter, dateFrom, dateTo, gradedByFilter]);
```

- [ ] **Step 2: Add clearFilters function**

Add this function after the `hasActiveFilters` computation:

```typescript
const clearFilters = () => {
  setSearchQuery("");
  setStatusFilter("all");
  setProgramFilter("all");
  setDateFrom("");
  setDateTo("");
  setGradedByFilter("all");
  setCurrentPage(1);
};
```

- [ ] **Step 3: Verify the app still runs**

Run: `npm run dev` in the frontend directory
Expected: App starts without errors, no visible changes yet

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/(portal)/admin/exam/scores/page.tsx
git commit -m "feat(scores): add clear filters logic and hasActiveFilters check"
```

---

### Task 5: Add Filter Bar UI

**Files:**
- Modify: `frontend/src/app/(portal)/admin/exam/scores/page.tsx` (add filter bar JSX)

**Interfaces:**
- Consumes: All filter state variables, `uniquePrograms`, `uniqueGraders`, `hasActiveFilters`, `clearFilters`
- Produces: Filter bar UI rendered above the Score Review table

- [ ] **Step 1: Add Search icon import**

At the top of the file, add the Search icon import (if not already present):

```typescript
import { Search, X } from "lucide-react";
```

Also ensure these shadcn/ui components are imported (add any missing ones):

```typescript
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
```

- [ ] **Step 2: Add filter bar JSX**

Find the Score Review tab content area (inside the `activeTab === "review"` conditional). Add this filter bar **above** the table, **after** the tab selector:

```tsx
{/* Filter Bar */}
<div className="flex items-center gap-3 mb-4">
  {/* Search input */}
  <div className="relative flex-1">
    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
    <Input
      placeholder="Search by name or ID..."
      className="pl-9"
      value={searchQuery}
      onChange={(e) => {
        setSearchQuery(e.target.value);
        setCurrentPage(1);
      }}
    />
  </div>

  {/* Status filter */}
  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
    <SelectTrigger className="w-[130px]">
      <SelectValue placeholder="Status" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All Status</SelectItem>
      <SelectItem value="PASSED">Passed</SelectItem>
      <SelectItem value="FAILED">Failed</SelectItem>
    </SelectContent>
  </Select>

  {/* Program filter */}
  <Select value={programFilter} onValueChange={(v) => { setProgramFilter(v); setCurrentPage(1); }}>
    <SelectTrigger className="w-[160px]">
      <SelectValue placeholder="Program" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All Programs</SelectItem>
      {uniquePrograms.map((prog) => (
        <SelectItem key={prog} value={prog}>{prog}</SelectItem>
      ))}
    </SelectContent>
  </Select>

  {/* Date From */}
  <Input
    type="date"
    className="w-[150px]"
    value={dateFrom}
    onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
  />

  {/* Date To */}
  <Input
    type="date"
    className="w-[150px]"
    value={dateTo}
    onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
  />

  {/* Graded By filter */}
  <Select value={gradedByFilter} onValueChange={(v) => { setGradedByFilter(v); setCurrentPage(1); }}>
    <SelectTrigger className="w-[150px]">
      <SelectValue placeholder="Graded By" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All Graders</SelectItem>
      {uniqueGraders.map((grader) => (
        <SelectItem key={grader} value={grader}>{grader}</SelectItem>
      ))}
    </SelectContent>
  </Select>

  {/* Clear button */}
  {hasActiveFilters && (
    <Button variant="ghost" size="sm" onClick={clearFilters}>
      <X className="h-4 w-4 mr-1" /> Clear
    </Button>
  )}
</div>
```

- [ ] **Step 3: Verify filter bar renders**

Run: `npm run dev` in the frontend directory
Expected: Filter bar appears above the Score Review table with all controls visible

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/(portal)/admin/exam/scores/page.tsx
git commit -m "feat(scores): add filter bar UI to Score Review tab"
```

---

### Task 6: Test All Filters End-to-End

**Files:**
- No file changes — manual testing only

**Interfaces:**
- Consumes: Complete filter implementation from Tasks 1-5
- Produces: Verified working filters

- [ ] **Step 1: Test search filter**

1. Open Score Review tab
2. Type a student's first name in the search box
3. Verify: Only matching scores appear
4. Type a student's last name
5. Verify: Only matching scores appear
6. Type a Pinnacle ID (username)
7. Verify: Only matching scores appear
8. Clear search
9. Verify: All scores reappear

- [ ] **Step 2: Test status filter**

1. Select "Passed" from Status dropdown
2. Verify: Only scores with green "Passed" badge appear
3. Select "Failed"
4. Verify: Only scores with red "Failed" badge appear
5. Select "All Status"
6. Verify: All scores reappear

- [ ] **Step 3: Test program filter**

1. Select a specific program from the Program dropdown
2. Verify: Only scores for that program appear
3. Select "All Programs"
4. Verify: All scores reappear

- [ ] **Step 4: Test date range filter**

1. Set a "From" date
2. Verify: Only scores graded on or after that date appear
3. Set a "To" date
4. Verify: Only scores graded on or before that date appear
5. Set both From and To
6. Verify: Only scores within the range appear
7. Clear both dates
8. Verify: All scores reappear

- [ ] **Step 5: Test Graded By filter**

1. Select a specific grader from the Graded By dropdown
2. Verify: Only scores graded by that person appear
3. Select "All Graders"
4. Verify: All scores reappear

- [ ] **Step 6: Test combined filters**

1. Set search + status + program filters simultaneously
2. Verify: Only scores matching ALL criteria appear
3. Click "Clear" button
4. Verify: All filters reset, all scores reappear

- [ ] **Step 7: Test pagination with filters**

1. Set a filter that returns > 10 results
2. Verify: Pagination appears and works correctly
3. Change filter to narrow results to < 10
4. Verify: Pagination disappears
5. Set filter to 0 results
6. Verify: Empty state message appears

- [ ] **Step 8: Commit test results (optional)**

If any bugs found, fix and commit. Otherwise, no commit needed for passing tests.
