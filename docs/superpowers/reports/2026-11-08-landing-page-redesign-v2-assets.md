# Public Site V2 — Asset Ledger

**Project:** EARIST Graduate School Information System (GS-IS)
**Date:** 2026-11-08
**Package:** V2 Task 1 only — public foundation, masthead, photographic Hero.
**Status:** Temporary visual-QA asset; not production-content approved. V2 Task 2 has not begun.
**Authority:** [V2 specification](../specs/2026-11-08-landing-page-redesign-v2-design.md) and [V2 implementation plan](../plans/2026-11-08-landing-page-redesign-v2.md).

## 1. Hero review image

| Field | Recorded value |
| --- | --- |
| Repository path | `frontend/public/images/landing/v2/hero-campus-preview.webp` |
| Browser path | `/images/landing/v2/hero-campus-preview.webp` |
| Purpose | One substantial image for the photographic Hero; Task 1's owner-requested balance refinement uses equal desktop columns within a centered 1200px frame, with the same asset on tablet/mobile. |
| Provenance | Newly generated using the built-in OpenAI `image_gen` tool during V2 Task 1. Not stock photography or a verified institutional asset. |
| Original output | `exec-76fbfbe9-4f7d-4877-9afe-e81a065e0231.png`, retained in the session's Codex generated-images directory; runtime uses only the repository WebP. |
| Subject | Fictional tropical academic building/courtyard. No institution, building, person, event, campus signage, or logo was supplied as an image reference. |
| Native / repository dimensions | 1536 × 1024 pixels; 3:2; opaque RGB. |
| Web encoding | Original generated PNG encoded as WebP, quality 86, using the existing installed Sharp package; no resizing or content alteration. No dependency added. |
| Repository file size | 512,744 bytes. |
| SHA-256 | `b032dee284a073092a95ef97611b53329c2212086b0d3407ab8e82d347388551` |
| Display behavior | After the Task 1 balance refinement, desktop uses equal copy/image columns with a 40px gap inside a centered frame capped at 1200px. The image is at most 580px wide with 3:2 framing; Hero height follows content (approximately 487px at 1440/1920px). Tablet/mobile stack copy then a 16:9 image. Object-fit cover and object-position 55% 50% remain; the visible preview caption is a quiet neutral line beneath the image. |
| Visible adjacent caption | **Design placeholder image — not EARIST photography** |
| Alternative text | **Generated illustration of a fictional academic courtyard with shaded walkways and tropical trees.** |
| Page-level notice | **Design preview — marked imagery and sample content are for review only.** Visible across the shared public layout; no environment flag suppresses it. |
| Approval state | Authorized for design QA only. No project-owner visual acceptance, institutional photography verification, or production-content approval is claimed. |

The generated output was visually inspected: academic architecture, tropical trees, natural light, no visible identifying signage/logo, and a composition usable at desktop/mobile crops. It is a fictional illustration and must never be described as a photograph of EARIST. Its creation does not establish that it depicts a real place or that a third-party institution endorsed it.

### Generation prompt (verbatim)

```text
Use case: photorealistic-natural. Asset type: temporary photographic website Hero image for visual design QA, NOT documentary institutional photography. Create one photorealistic editorial architectural photograph of a completely fictional tropical academic building and landscaped courtyard. A dignified contemporary university building with warm ivory concrete, shaded open colonnades, tall vertical windows, subtle terracotta brick accents, mature green trees, tropical planting and a stone pedestrian courtyard. Welcoming late-afternoon natural daylight, realistic materials and light, credible lived-in academic environment rather than a glossy real-estate render. Composition: landscape 3:2, architecture dominant, eye-level slight upward perspective, useful central subject that also survives a near-square crop in the right half of a university homepage; visually substantial architecture without large empty sky. No foreground people needed. No text, lettering, signage, logos, emblems, flags, watermarks, typography or UI. Must not reproduce or identify any actual campus, landmark, university, EARIST building, person or event. This is an imaginary academic setting, not an image of EARIST. Natural colors, restrained warm contrast, no dramatic filters, no futuristic architecture.
```

## 2. Existing EARIST institutional seal

- Reused browser/repository asset: `frontend/public/images/landing/earist-logo.jpg` (141 × 141 pixels).
- Owner-supplied original and provenance: [official-form assets](../../../backend/assets/official-forms/README.md), `backend/assets/official-forms/earist-logo.jpg`.
- Both copies retain SHA-256 `7b6fd94291f63a0931c7979253548dd71a7a8a899f42ece9a01ceee1c76fdff8`; bytes, aspect ratio, and colors are unchanged.
- Masthead display: 64 × 64 CSS pixels at wider widths; 48 × 48 below 600px. It replaces only the Navbar's generic graduation-cap identity. The existing Footer is deferred and unchanged.
- No new or recreated seal, background removal, tracing, recoloring, or backend asset/consumer changes were made. No Graduate School seal copy or later-section asset is introduced in Task 1.

## 3. Required production replacement and review

Replace the Hero preview with an owner-approved real institutional photograph before claiming production-content readiness. Record the photographer/source, permission or license, verified institutional subject, approved crop, dimensions, file size, and updated hash here. Review desktop, tablet, mobile, reflow, alternative text, and image contrast after replacement.

Keep the image caption and page-level notice visible until their replacement conditions are met. A production build or branch push does not remove preview status. Remove or revise the page-level notice only after every unapproved image/sample on that page is replaced or omitted and the owner approves the production content. No frontend environment check, backend endpoint, database field, CMS, or public-data contract is introduced for this gate.

Task 1 adds only this Hero image and reuses the institutional seal. Research, About, News, program snapshots, deeper pages, and final Footer assets/content remain later packages. This ledger is dedicated feature evidence; shared canonical documentation is unchanged.
