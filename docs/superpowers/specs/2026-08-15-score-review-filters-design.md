# Score Review Filters — Design Spec

**Date:** 2026-08-15
**Feature:** Add filtering capabilities to the Score Review tab in the admin exam scores page
**Author:** MiMoCode + User (brainstorming session)

---

## 1. Problem Statement

The Score Management page (`/admin/exam/scores`) currently has **zero filtering or search capabilities**. The Score Review tab displays all graded scores in a flat table with only client-side pagination (10 items/page). As the number of graded scores grows, finding specific applicants or reviewing results by program/status/date becomes impractical.

**Goal:** Add a horizontal filter bar above the Score Review table that allows admins to quickly find and narrow down scores by applicant name/ID, pass/fail status, program, date range, and grader.

---

## 2. Scope

**In scope:**
- Filter bar on the Score Review tab only (not the Essay Grading Queue)
- 5 filter controls: Search, Status, Program, Date Range, Graded By
- Client-side filtering (fetch all once, filter in browser)
- Clear button to reset all filters

**Out of scope:**
- Server-side filtering
- Filters on the Essay Grading Queue tab
- Sorting controls (already exists or can be added later)
- Export/filter-to-CSV functionality

---

## 3. Design

### 3.1 Filter Bar Layout

A single horizontal bar positioned between the tab selector and the table:

```
[🔍 Search by name or ID...] [Status ▾] [Program ▾] [From Date] [To Date] [Graded By ▾] [Clear]
```

**Controls (left to right):**

| Control | Type | Width | Default |
|---------|------|-------|---------|
| Search | Text input with search icon | flex-1 (takes remaining space) | Empty |
| Status | Select dropdown | w-[130px] | "All" |
| Program | Select dropdown | w-[160px] | "All" |
| Date From | Date input | w-[150px] | Empty |
| Date To | Date input | w-[150px] | Empty |
| Graded By | Select dropdown | w-[150px] | "All" |
| Clear | Button (ghost) | auto | Hidden (shown when filters active) |

### 3.2 Filter Behavior

**Search (Name + Pinnacle ID):**
- Filters as you type with 300ms debounce
- Case-insensitive match on `firstName`, `lastName`, or `username` (Pinnacle ID)
- Example: typing "juan" shows all scores for applicants named "Juan"

**Status Dropdown:**
- Options: All, Passed, Failed
- Default: All
- Filters on `score.status` field (ExamResult enum: PASSED, FAILED, PENDING)

**Program Dropdown:**
- Options: All + unique programs from fetched data
- Default: All
- Filters on `program.programName`

**Date Range:**
- Two date inputs: "From" and "To"
- Filters on `createdAt` (the date the score was graded)
- If only "From" set: shows scores from that date onward
- If only "To" set: shows scores up to that date
- If both set: shows scores within the range

**Graded By Dropdown:**
- Options: All + unique graders from fetched data
- Default: All
- Filters on `score.gradedBy.firstName + lastName`

**Clear Button:**
- Only visible when any filter is non-default
- Resets all filters to default (All / empty)
- Resets pagination to page 1

### 3.3 UI Components

All components from shadcn/ui:

- `Input` — search bar, date inputs
- `Select` — Status, Program, Graded By dropdowns
- `Button` — Clear filter button
- Native `<input type="date">` — date range pickers
- Lucide icons: `Search`, `X`

### 3.4 Layout Structure

```tsx
<div className="flex items-center gap-3 mb-4">
  {/* Search input - takes remaining space */}
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
    placeholder="From"
    className="w-[150px]"
    value={dateFrom}
    onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
  />

  {/* Date To */}
  <Input
    type="date"
    placeholder="To"
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

  {/* Clear button - conditionally rendered */}
  {hasActiveFilters && (
    <Button variant="ghost" size="sm" onClick={clearFilters}>
      <X className="h-4 w-4 mr-1" /> Clear
    </Button>
  )}
</div>
```

### 3.5 State Management

**State variables:**
```typescript
const [searchQuery, setSearchQuery] = useState("");
const [statusFilter, setStatusFilter] = useState("all");
const [programFilter, setProgramFilter] = useState("all");
const [dateFrom, setDateFrom] = useState("");
const [dateTo, setDateTo] = useState("");
const [gradedByFilter, setGradedByFilter] = useState("all");
const [currentPage, setCurrentPage] = useState(1);
```

**Derived values:**
```typescript
const hasActiveFilters = searchQuery !== "" || statusFilter !== "all" || programFilter !== "all"
  || dateFrom !== "" || dateTo !== "" || gradedByFilter !== "all";

const uniquePrograms = useMemo(() => {
  const programs = new Set(scores.map((s) => s.program.programName));
  return Array.from(programs).sort();
}, [scores]);

const uniqueGraders = useMemo(() => {
  const graders = new Set(
    scores
      .filter((s) => s.score?.gradedBy)
      .map((s) => `${s.score!.gradedBy!.firstName} ${s.score!.gradedBy!.lastName}`)
  );
  return Array.from(graders).sort();
}, [scores]);
```

**Filtering logic:**
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

**Clear filters:**
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

### 3.6 Pagination

- Reset to page 1 when any filter changes (already shown in each filter's `onChange`)
- Uses existing shadcn/ui `Pagination` component
- Page size: 10 (same as current)
- Only renders when `totalPages > 1`

---

## 4. Files to Modify

| File | Change |
|------|--------|
| `frontend/src/app/(portal)/admin/exam/scores/page.tsx` | Add filter state, filter bar UI, filtering logic, unique values computation |

**No backend changes required** — all filtering is client-side.

---

## 5. Testing Checklist

- [ ] Search filters by applicant name (first name, last name)
- [ ] Search filters by Pinnacle ID (username)
- [ ] Search is case-insensitive
- [ ] Status filter shows correct results for Passed/Failed/All
- [ ] Program filter shows only programs present in the data
- [ ] Date range filter works correctly (From only, To only, both)
- [ ] "To" date includes the entire day (not just midnight)
- [ ] Graded By filter shows only graders present in the data
- [ ] Clear button resets all filters
- [ ] Clear button only appears when filters are active
- [ ] Pagination resets to page 1 when filters change
- [ ] Empty state shows when no results match filters
- [ ] Responsive layout works on smaller screens

---

## 6. Open Questions

None — all design decisions resolved during brainstorming.
