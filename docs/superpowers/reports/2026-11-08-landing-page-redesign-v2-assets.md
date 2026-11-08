# Public Site V2 — Asset Ledger

**Project:** EARIST Graduate School Information System (GS-IS)
**Date:** 2026-11-08
**Package:** V2 Tasks 1–3 — accepted masthead/Hero foundation, Landing body, and public information/contact design preview.
**Status:** Task 1 accepted by the owner for continuation; Task 2 treatments preserved. Task 3 is implemented for owner visual review. Temporary imagery, sample news, and source-review program/contact details are not final production content. Task 4 has not begun.
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
| Approval state | Task 1 masthead/Hero direction accepted by the owner for continuation. This image remains a fictional, non-institutional design placeholder; no institutional photography verification or production-content approval is claimed. |

The generated output was visually inspected: academic architecture, tropical trees, natural light, no visible identifying signage/logo, and a composition usable at desktop/mobile crops. It is a fictional illustration and must never be described as a photograph of EARIST. Its creation does not establish that it depicts a real place or that a third-party institution endorsed it.

### Generation prompt (verbatim)

```text
Use case: photorealistic-natural. Asset type: temporary photographic website Hero image for visual design QA, NOT documentary institutional photography. Create one photorealistic editorial architectural photograph of a completely fictional tropical academic building and landscaped courtyard. A dignified contemporary university building with warm ivory concrete, shaded open colonnades, tall vertical windows, subtle terracotta brick accents, mature green trees, tropical planting and a stone pedestrian courtyard. Welcoming late-afternoon natural daylight, realistic materials and light, credible lived-in academic environment rather than a glossy real-estate render. Composition: landscape 3:2, architecture dominant, eye-level slight upward perspective, useful central subject that also survives a near-square crop in the right half of a university homepage; visually substantial architecture without large empty sky. No foreground people needed. No text, lettering, signage, logos, emblems, flags, watermarks, typography or UI. Must not reproduce or identify any actual campus, landmark, university, EARIST building, person or event. This is an imaginary academic setting, not an image of EARIST. Natural colors, restrained warm contrast, no dramatic filters, no futuristic architecture.
```

## 2. Existing EARIST institutional seal

- Reused browser/repository asset: `frontend/public/images/landing/earist-logo.jpg` (141 × 141 pixels).
- Owner-supplied original and provenance: [official-form assets](../../../backend/assets/official-forms/README.md), `backend/assets/official-forms/earist-logo.jpg`.
- Both copies retain SHA-256 `7b6fd94291f63a0931c7979253548dd71a7a8a899f42ece9a01ceee1c76fdff8`; bytes, aspect ratio, and colors are unchanged.
- Masthead display after the accepted Task 1 refinements: 60 × 60 CSS pixels at desktop widths from 1200px; 64 × 64 at intermediate widths; 48 × 48 below 600px. Task 2 does not change the masthead. The existing Footer is deferred and unchanged.
- No new or recreated seal, background removal, tracing, recoloring, or backend asset/consumer changes were made. No Graduate School seal copy or later-section asset is introduced in Task 1.

## 3. Required production replacement and review

Replace the Hero preview with an owner-approved real institutional photograph before claiming production-content readiness. Record the photographer/source, permission or license, verified institutional subject, approved crop, dimensions, file size, and updated hash here. Review desktop, tablet, mobile, reflow, alternative text, and image contrast after replacement.

Keep the image caption and page-level notice visible until their replacement conditions are met. A production build or branch push does not remove preview status. Remove or revise the page-level notice only after every unapproved image/sample on that page is replaced or omitted and the owner approves the production content. No frontend environment check, backend endpoint, database field, CMS, or public-data contract is introduced for this gate.

Task 1 introduced the Hero image and reused the institutional seal. Task 2 added the Research/About images and provisional program snapshot below. Task 3 corrects program provenance, adds text-only sample News and Contact Us, and completes public navigation/Footer. It introduces no new images. Deeper-page redesigns remain later packages. This ledger is dedicated feature evidence; shared canonical documentation is unchanged.

## 4. Task 2 — Research review image

| Field | Recorded value |
| --- | --- |
| Repository / browser path | `frontend/public/images/landing/v2/research-preview.webp` / `/images/landing/v2/research-preview.webp` |
| Purpose | Supporting photograph-like image in the burgundy Graduate Research introduction; not a research record, publication preview, or documented EARIST facility. |
| Provenance | Built-in OpenAI `image_gen`, newly generated for Task 2. Original output `exec-68fa8a38-a327-4d1d-b8e5-2c348554999c.png` remains in the session's generated-images directory. No institutional reference image was supplied. |
| Subject | Fictional library reading room, unlabelled books, study table and closed notebook; no named research, people, event, logos, or readable publication metadata. |
| Dimensions / encoding | 1536 × 1024; opaque RGB; original PNG encoded as WebP quality 84 using existing Sharp, without resizing/content edits or a dependency addition. |
| Size / SHA-256 | 269,972 bytes / `25a533f819646a1886d1878b6f0df9bd1dcec337a19a593977891eef2ad2128c` |
| Display | Approximately 40% of the shared desktop frame beside copy, with a 5:4 crop; copy before image on narrow screens, where the crop is 16:9. Object-fit cover; lazy-loaded by Next Image. |
| Visible caption | **Design placeholder image — not EARIST photography** |
| Alternative text | **Generated illustration of a fictional library reading room with study tables and tropical greenery outside.** |
| Replacement requirement | Owner-approved real research/library/academic-setting photography with verified subject and permission/source record; recheck crop, alt text, and caption. No fabricated publication metadata may be added as a replacement. |

### Generation prompt (verbatim)

```text
Use case: photorealistic-natural. Asset type: temporary Graduate Research website feature image for design QA only, not documentary photography. Create an editorial architectural photograph of a completely fictional university library reading room. A welcoming wooden study table with a closed unlabelled notebook in the foreground, generous shelves of unlabelled books and large windows with green tropical trees in the background, natural side light, warm oak and neutral cream materials, credible calm academic environment. Landscape 3:2 composition, meaningful midground detail, suitable for a cropped 5:4 website feature. No people, no text or readable book titles, no manuscript pages, no research titles, no signage, logos, seals, branded devices, watermarks, UI or identifiable real institution. Must not reproduce EARIST or any actual campus. Natural realistic light and colors, no cinematic filters, no fantasy architecture.
```

## 5. Task 2 — About review image

| Field | Recorded value |
| --- | --- |
| Repository / browser path | `frontend/public/images/landing/v2/about-preview.webp` / `/images/landing/v2/about-preview.webp` |
| Purpose | Supporting institutional-context image for the About section; not a documented Graduate School room, class, or event. |
| Provenance | Built-in OpenAI `image_gen`, newly generated for Task 2. Original output `exec-46a3ebd8-667f-4879-a5f9-912f362cdb3d.png` remains in the session's generated-images directory. No institutional reference image was supplied. |
| Subject | Fictional empty seminar room with wooden tables, burgundy chairs and a blank board; no people, event, signs, seals, or institutional claim. |
| Dimensions / encoding | 1536 × 1024; opaque RGB; original PNG encoded as WebP quality 84 using existing Sharp, without resizing/content edits or a dependency addition. |
| Size / SHA-256 | 214,926 bytes / `85f0ac1fb58058f26bf1bd990b8f2971a50c04733bba7911bc5e551f0b08a61b` |
| Display | Approximately 43% of the desktop frame on the left, with a 5:4 crop; narrow screens place About copy before the 16:9 image. Lazy-loaded by Next Image. |
| Visible caption | **Design placeholder image — not EARIST photography** |
| Alternative text | **Generated illustration of a fictional seminar room with wooden tables, burgundy chairs, and a blank writing board.** |
| Replacement requirement | Owner-approved genuine Graduate School/institutional photograph with verified subject and permission/source record; review crop, alt text, and labels before production-content acceptance. |

### Generation prompt (verbatim)

```text
Use case: photorealistic-natural. Asset type: temporary institutional About section image for website visual QA only. Create a realistic editorial photograph of a completely fictional graduate seminar room, with a modest arrangement of wooden tables and chairs, a plain blank writing board, tall windows admitting soft daylight and views of leafy tropical trees, warm plaster walls and restrained burgundy upholstered seating. Academic, welcoming, practical, contemporary but not luxurious. Landscape 3:2 image with believable architectural proportions and balanced composition, suitable for a 5:4 crop. Empty room: no people, no staged event, no signage, no text, no seals, logos, awards, watermarks or UI. This is an invented academic setting and must not depict or impersonate EARIST, a real campus, or any official event. No dramatic filters.
```

## 6. Task 2 — Public content and execution boundaries

- Task 2 originally used eight provisional seed-derived program titles. The inherited correction before Task 3 replaces that provenance with the two official EARIST pages in section 7. The Home selection uses shared degree names only, corrects the doctoral wording, and omits disputed majors. Its visible notice now reads **Official EARIST references differ on majors and wording; client confirmation is pending.** Both official references are linked next to the notice, which still describes both degree groups through `aria-describedby`. The accepted Programs layout is preserved. No counts, department claims, residency limits, admissions availability, deadlines, or program-specific application actions are introduced.
- About copy is limited to existing institutional identity and public program/research/account pathways. No mission, vision, history, leadership, statistics, or outcomes are invented. No Graduate School seal copy is required by this package.
- Home FAQ content covers existing registration's Pinnacle Applicant ID prerequisite, Sign In, Programs, and public Repository discovery. Native disclosures are used; detailed academic-policy answers are not copied from the legacy FAQ.
- All four body sections share the accepted 1200px frame and 64px desktop / 44px mobile vertical padding. Masthead and Hero markup/styles are preserved; the existing Hero CTA's frontend URL changes to `/#programs`, with the old `graduate-study` anchor retained at that same section for compatibility.
- Research links to the existing `/repository` only. No publications, research statistics, new Home API reads, News, CMS, or backend integration are added. Public navigation destinations, Footer, deeper pages, authentication, authorization, chatbot, and shared canonical documents remain outside Task 2.
- Both Task 2 generated outputs were visually inspected as fictional academic-context illustrations. Their captions and the existing public-page preview notice remain visible, with no environment-based suppression. The production replacement gate in section 3 applies to both images and to unconfirmed program content. At the Task 2 handoff, Task 3 had not been initiated; the current Task 3 state is recorded in section 8.

## 7. Inherited Task 2 correction — official program references

Read on 2026-11-08 from the official [Graduate School reference 1](https://earist.edu.ph/graduate-school/) and [Graduate School reference 2](https://earist.edu.ph/graduate-school-2/). These are source-review references, not a client-reconciled current catalog. The unchanged two-column Home layout contains four selected master's degree names and four doctoral names common to both pages, with ordinary whitespace normalized only.

| Difference | Reference 1 | Reference 2 | Home treatment / confirmation required |
| --- | --- | --- | --- |
| Doctor of Education majors | Educational Management; Industrial Education Management | Educational Management | Show the shared degree name **Doctor of Education**, without a merged or selected major list. Confirm current majors with the client. |
| Industrial Education major | Hotel Management | Hotel and Restaurant Management | Not included in the curated Home subset. Client must confirm the current wording before a fuller directory uses it. |
| Master of Arts in Teaching majors | Longer major list | Shorter list (Electrical Technology, Electronics Technology, Mathematics, Science) | Not included in the Home subset. Do not treat the union as a current list. |
| Business/Public Administration doctorate wording | Doctor **of** Business Administration; Doctor **of** Public Administration | Same **of** wording | Replace the old seed-derived **in** wording with the shared official titles. |

The source-derived master's selection remains Mathematics, Industrial Psychology, Business Administration, and Public Administration. The Doctor of Philosophy in Industrial Psychology title is also shared. The official pages do not authorize inventing current admissions availability, residency limits, deadlines, or a total program count. Client confirmation remains visible; the deeper `/programs` route is a later package.

## 8. Task 3 — News, navigation, Contact Us, and Footer

### Scope and inherited correction

The package begins from verified local/live feature HEAD `eedfe2352a6a60f9bd82b6a082c7797251b33bf3`, preserving the intervening owner documentation commits. The inherited Programs content/provenance correction was committed first as `4a37f637ef19754f3ea3de5d06151aee7450f4e3`, before the new Task 3 source work. Its design/layout is preserved; section 7 records the official-source differences and unresolved client decisions.

News is a text-only editorial composition with one featured sample and two smaller entries. Every item visibly states **Sample content — design review only**; the section also states that these are layout samples, not official announcements. Dates, Read More/View All actions, article routes, official events, admissions claims, and new publishing/API behavior are absent. No new photography or generated asset was needed.

The Navbar now uses the final root-qualified Home anchors for Programs, News, About, and Contact, plus the dedicated `/repository` route. Sign In/Register retain their original routes. The institutional identity still links Home. `/faq` remains reachable through Home help and Footer. Accepted masthead geometry/identity, Hero, Research, About, and help treatments remain unchanged.

### Contact and platform provenance

Contact Us appears before Footer with visible status **Official-source contact details — client confirmation pending.** It distinguishes institutional details from the earlier Graduate School listing rather than silently presenting them as one current office record.

| Displayed reference | Source | Status / boundary |
| --- | --- | --- |
| Nagtahan St, Sampaloc, Manila, 1008 Metro Manila | [Graduate School reference 2](https://earist.edu.ph/graduate-school-2/) | Official-source institutional location; client confirmation remains pending. No map or location-service endpoint added. |
| `earistofficial1945@gmail.com`; `(02) 7738 5059` | [Graduate School reference 2](https://earist.edu.ph/graduate-school-2/) | Labelled campus/institutional contact, not asserted to be a separately verified Graduate School office line. Mail and telephone links reflect these exact details. |
| `(02) 7154914`; Facebook/Twitter handle `earistgraduateschool` | [Graduate School reference 1](https://earist.edu.ph/graduate-school/) | Separate earlier Graduate School listing, explicitly for confirmation. The handle is plain text; no Facebook/Twitter profile URL was guessed from it. |
| `https://earist.edu.ph/` | [Official EARIST website](https://earist.edu.ph/) | Canonical website used; the earlier page's `www.earist-edu.ph` string is not used as a destination. |
| `https://earistweb.pinnacle.com.ph/aims/applicants/` | Apply Online link in [official EARIST navigation](https://earist.edu.ph/) | Shown as Applicant Portal / Pinnacle Applicants Access Module. It is distinct from GS-IS Register and does not change the registration flow. |
| `https://www.facebook.com/mis.office.earist?mibextid=ZbWKwL` | Applicant's Inquiry link in [official EARIST navigation](https://earist.edu.ph/) | Shown as Applicant's Inquiry (Facebook), not mislabelled as the older Graduate School social handle. Exact source-linked URL retained. |

These outgoing URLs were read from the official pages on 2026-11-08. Automated target retrieval returned HTTP 403 for the Applicant Portal and a fetch/cache limitation for Facebook; the verified fact is their inclusion in official-site navigation, not successful authentication/service availability or a client endorsement. The current homepage also displays a different institutional phone from Graduate School reference 2; no additional phone from that page was introduced. The client must confirm current contact ownership/numbers and preferred social/platform destinations before production-content acceptance.

There is no contact form, submission endpoint, ticketing workflow, office-hours claim, new email, invented social destination, or contact-data API. External links use ordinary same-tab anchors; mail/tel links do not send messages automatically.

### Footer and verification boundary

The Footer has four visual groups: real EARIST seal/identity, Study & Information, Research & Updates, and Contact & Access. Detailed contact data stays in Contact Us; Footer uses links to Contact, public resources, the official website/applicant platform, and Sign In/Register. No unsupported privacy/terms destinations or social icons were introduced. A mobile-only copyright inset provides clearance from the unchanged chatbot launcher without increasing broad section padding or changing widget behavior.

Task 3 verification covers TypeScript, scoped ESLint, exact diff/whitespace, focused desktop/mobile Home review, section/anchor uniqueness, cross-route Navbar navigation from the four deeper public destinations, Footer/platform hrefs, mobile keyboard/disclosure/Escape/focus behavior, and mobile copyright clearance. Source/data checks keep the accepted Hero/Task 2 treatments and protected backend/auth/chatbot/deeper-page/canonical files intact. Browser/source checks and the owner approval decision remain separate; no hosted CI pass, production build rerun, production deployment, or final content approval is claimed.

Remaining client decisions: reconcile the official program majors/wording; confirm current institutional versus Graduate School contact details and social destinations; replace sample news with approved content; replace the existing fictional images with authorized institutional photographs. Task 4 is not initiated by this package.
