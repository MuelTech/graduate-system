# Landing Page Alignment, News Section, and Mobile Drawer Refinement Report

**Date:** 2026-11-12
**Branch:** `feat/landing-page-redesign`
**Status:** Owner-accepted, verified, and published

---

## 1. Summary of Owner-Approved Refinements

1. **Navigation & Masthead Alignment (`navbar.tsx`, `footer.tsx`, `public-site.css`)**
   - Renamed `"Research Repository"` to **`"Research"`** in the primary navigation and footer while preserving the `/repository` route destination.
   - Resolved the anchor collision between `Home` (`/`) and `News` (`/#news`): the opening full-width Hero Carousel is now `id="home"` (Graduate School Highlights), and `#news` is a dedicated **News & Announcements** section directly below the Hero.
   - Upgraded the Navbar identity lockup to a two-line hierarchy (**`Graduate School`** above **`Eulogio "Amang" Rodriguez Institute of Science and Technology`**) and styled **`Sign In`** (outlined button) and **`Create Account`** (solid burgundy button).
   - Replaced the full-width top mobile menu dropdown with a **Right-Side Slide-Over Drawer** (`public-masthead__panel`) with a blurred backdrop (`public-masthead__backdrop`), smooth slide-in animation (`public-drawer-slide-in`), and reduced-motion override.

2. **Opening Hero Carousel (`hero-section.tsx`, `announcements-section.tsx`, `public-site.css`)**
   - Removed the `#applicant-access` strip (`"For registered Pinnacle applicants"`) below the carousel per owner instruction.
   - Added a full-width academic examination hall illustration (`frontend/public/images/landing/v2/exam-preview.jpg`) for Slide 2 (`"Registered in Pinnacle?"`) so all three slides share a cohesive visual treatment.
   - Centered mobile CTA button labels/icons and aligned the mobile Previous arrow, centered pagination indicators, and Next arrow symmetrically on a single bottom control row.

3. **Standardized Admin-CMS-Ready News & Announcements Section (`news-section.tsx`, `public-site-content.ts`)**
   - Added the 3 official EARIST Graduate School announcements provided by the owner:
     - *Congratulations, Comprehensive Examination Passers!* (September 6, 2026 — 4 posters)
     - *Comprehensive Examination Rescheduled to September 6, 2026* (1 poster)
     - *Graduate School Enrollment Extended Until September 3, 2026* (1 poster)
   - Used a uniform 3-column card grid (`public-news__card`) with a standardized post schema (`id`, `category`, `publishedAt`, `title`, `content`, `images[]`) and an accessible modal reader (`public-news__modal`) supporting multi-photo carousel navigation and thumbnails.

4. **Cohesive Section Upgrades (`about-section.tsx`, `programs-section.tsx`, `repository-section.tsx`, `contact-section.tsx`, `inquiry-form.tsx`)**
   - **About (`#about`):** Added institutional mandate callout and a 3-column numbered grid of the 3 official Graduate School Goals.
   - **Programs (`#programs`):** Organized the 7 Master's programs, 4 Doctoral programs, and 9 majors into structured degree panels with `GraduationCap` header and degree count badges.
   - **Research (`#graduate-research`):** Added 3 feature highlight cards (`Theses & Dissertations`, `Abstracts & Citations`, `Institutional Full-Text Access`) and a gold primary CTA button.
   - **Contact (`#contact`):** Organized campus address, email, and telephone with icons inside structured card panels alongside official platform cards and the inquiry form card.

---

## 2. Runtime Image Asset Provenance

Per repository rules, `.gitignore` was not modified; the following intentional runtime image assets were staged explicitly via `git add -f`:

| Path | Dimensions | Provenance |
| --- | --- | --- |
| `frontend/public/images/landing/v2/exam-preview.jpg` | 1376x768 | Generated academic assessment hall illustration for Hero Slide 2 (`Registered in Pinnacle?`) |
| `frontend/public/images/landing/news/comprehensive-exam-passers-cover.jpg` | 671x951 | Owner-provided EARIST Graduate School official announcement poster (Sept 6, 2026 Passers Cover) |
| `frontend/public/images/landing/news/comprehensive-exam-passers-edd.jpg` | 663x953 | Owner-provided EARIST Graduate School official announcement poster (EdD Educational Management Passers) |
| `frontend/public/images/landing/news/comprehensive-exam-passers-phd-psych.jpg` | 664x955 | Owner-provided EARIST Graduate School official announcement poster (PhD Industrial Psychology Passers) |
| `frontend/public/images/landing/news/comprehensive-exam-passers-maed.jpg` | 669x954 | Owner-provided EARIST Graduate School official announcement poster (MAEd Administration & Supervision Passers) |
| `frontend/public/images/landing/news/comprehensive-exam-rescheduled.jpg` | 789x950 | Owner-provided EARIST Graduate School official announcement poster (Comprehensive Examination Rescheduled) |
| `frontend/public/images/landing/news/enrollment-extended-habagat.jpg` | 946x955 | Owner-provided EARIST Graduate School official announcement poster (Enrollment Extended Advisory) |

---

## 3. Verification Results

- `node node_modules/typescript/bin/tsc --noEmit` — **PASS (0 errors)**
- `node node_modules/eslint/bin/eslint.js ...` — **PASS (0 errors/warnings)**
- `node scripts/verify-landing-refinement.mjs` — **8/8 PASS** (`uncaughtErrors: []`, `mutatingRequests: []`)
- `git diff --check` — **PASS (0 whitespace issues)**
