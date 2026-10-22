# TEMPLATE-3: Defense Application (GS-006 / GS-007)

Status: **IMPLEMENTED / AWAITING PROJECT-OWNER VISUAL REVIEW** (2026-10-22).
Branch: `feat/official-defense-document-forms`.
Verified starting local/remote HEAD: `8ddb390980cd8537c30014c4e90c8dc0cb2d794d`.

`renderDefenseApplication(input): Promise<Uint8Array>` draws one A4 portrait PDF using
`pdf-lib`. One discriminated input and one renderer implement this bounded form family.
There is no application bootstrap, filesystem/network access, database/repository lookup,
HTTP/auth concern, workflow/eligibility decision, payment verification, signature retrieval,
or latest-record fallback.

Both actual reference photographs were inspected before authoring:

- `backend/.temp/official-form-inputs/template-3/gs-006-masters-defense-application.jpg`
- `backend/.temp/official-form-inputs/template-3/gs-007-doctoral-defense-application.jpg`

Photographs are never embedded. Only the existing clean production logo JPEGs are embedded.

## Controlled institutional variants

| Printed detail | Master's GS-006 | Doctoral GS-007 |
| --- | --- | --- |
| Program heading | `MASTERS PROGRAM` | `DOCTORAL PROGRAM` |
| Adviser slots | 1, before the Panelist rows | None |
| Panelist slots | 4 | 6 |
| Facilitator slots | 1 | 1 |
| Rapporteur slots | 1 | 1 |
| Total printed committee rows | 7 | 8 |
| Printed Chairman label | None | None |
| Masthead/application section | Lower placement | 14 pt higher, following the photograph |
| Approval blocks | More vertical separation | More compact arrangement |
| Footer | `EARIST-QSF-GS-006 Rev. 01 (06.20.25)` | `EARIST-QSF-GS-007 Rev. 01 (06.20.25)` |

The capacities describe physical printed slots, not GS-IS committee membership or evaluator policy.
No Chairman is inferred from the first Panelist row. Facilitator/Rapporteur display slots are
independent of Panelist names. The Master's Adviser row is preserved for all explicit
application selections, including Title; later integration owns mapping workflow context.
The Doctoral input excludes Adviser because its photograph has no such slot. An untyped caller
supplying a nonblank Doctoral Adviser receives an error rather than losing that value.

Both photographs have the same printed fee table: Proposal and Final columns each show
`300` for Defense Fee, Administrative and Technical Fee, and Energy and Venue Fee, followed
by `P 900.00`. These are literal printed strings, not calculated fees or an amount-paid rule.
The total row's first cell remains blank as photographed; no new Total label is added.
The unlabelled right committee column stays blank for the printed signing area.

## Explicit typed input

`DefenseApplicationRenderInput` uses `variant: "masters" | "doctoral"` and contains only:

- logo bytes/MIME types;
- `applicationType: "title" | "proposal" | "final" | null`;
- `studentName`, `courseAndMajor`, `studentNumber`, `cellphoneNumber`;
- upper `applicantDateAndTime`, independent of the lower defense schedule fields;
- `amountPaid`, `officialReceiptNumber`, `dateOfApplication`, `personalGmail`;
- `defenseDate`, `defenseTime`, `defenseLink`;
- explicit committee display values: Master's `adviserName`, bounded `panelistNames`
  in physical row order, `facilitatorName`, and `rapporteurName`;
- explicit `deanName`, `vicePresidentName`, and `presidentName`.

Empty strings and absent Panelist names leave printed slots blank.
No missing identity is fabricated. More than four/six Panelist names fails explicitly.
All dates, amounts, O.R. identifiers, contact values, and schedule values are rendered as supplied.
There is no O.R./Gmail validation, course specialization inference, approval state, scoring,
payment-state determination, signature image, or automatic signing.

Selection marks only the explicit input. `QA_APPLICATION_MARKER` isolates the current dummy
`X`; neither blank reference establishes an official X/check/circle convention.
The marker is presentation only and can be changed after institutional confirmation.

## Layout and bounded text

Accepted helpers are reused without modifying them:

- `pdf-layout.ts`: A4, rules, and image containment used by the masthead;
- `pdf-text.ts`: measured wrapping, bounded font reduction, and field-specific overflow errors;
- `institutional-header.ts`: accepted two-logo institutional masthead.

Variant-specific placement is applied with a page graphics translation, leaving accepted
TEMPLATE-1/TEMPLATE-2 outputs unchanged. The nearest Doctoral logo box is 22 pt from the top;
Master's is 36 pt. Footer text has more than 36 pt of bottom clearance.

Identity fields first try 12 pt single-line boxes at 10-8 pt text sizes. Genuine wrapping gets
a bounded 20 pt region, up to 24 pt of additional space across the identity section. The
table and Prepared by position follow this extra height; approval spacing remains bounded.
Excess individual or combined content throws a field-specific `RangeError`.
Table geometry always retains every printed row. Committee names fit one bounded line above
their rule; captions remain below it. Approval names have a bounded two-line region.
Schedule cells have their own bounded widths. Nothing is ellipsized, silently truncated,
allowed to overlap, or continued onto another page.

The measured static selection line is drawn with intentional spaces preserved inside its
parentheses; the shared wrapping helper normally normalizes repeated whitespace.
No shared helper was changed for this form-specific presentation.

Standard PDF Times and Helvetica follow the reference's serif heading and sans-serif body.
WinAnsi supports common Latin names, including accented Latin letters; unsupported scripts
fail explicitly and would need a separately approved embedded-font decision.

## Development samples

From `backend/`:

```powershell
npm run forms:sample:application
npm run forms:sample:application -- --rasterize
npm test -- tests/unit/documents/official-defense/defense-application.renderer.test.ts tests/unit/documents/official-defense/oral-exam-summary.renderer.test.ts tests/unit/documents/official-defense/oral-exam-criteria.renderer.test.ts
npm run build
```

Optional `--rasterize` invokes local Poppler `pdftoppm` at 150 dpi; set `PDFTOPPM_PATH`
if it is not on PATH. Poppler is development QA tooling only.
The script reads production logos without reference photographs or application bootstrap.
Metadata dates are fixed at the Unix epoch for reproducible PDF bytes.

Ignored outputs under `backend/.tmp/official-form-samples/`:

| Variant | PDF | PNG |
| --- | --- | --- |
| Master's blank | `defense-application-gs006-blank.pdf` | `defense-application-gs006-blank.png` |
| Master's filled | `defense-application-gs006.pdf` | `defense-application-gs006.png` |
| Master's long | `defense-application-gs006-long.pdf` | `defense-application-gs006-long.png` |
| Doctoral blank | `defense-application-gs007-blank.pdf` | `defense-application-gs007-blank.png` |
| Doctoral filled | `defense-application-gs007.pdf` | `defense-application-gs007.png` |
| Doctoral long | `defense-application-gs007-long.pdf` | `defense-application-gs007-long.png` |

Filled examples use `MAEd` / `EdD` with fictitious identities. The Doctoral filled example
leaves two Panelist slots blank; its long-value stress example explicitly supplies six
distinct fictitious Panelist identities. Facilitator/Rapporteur remain separate identities.
The stress examples use long course, email, O.R., schedule, committee, and approval-name values.
None of the dummy values defines an academic, payment, or signature rule.

## Visual QA checkpoint (2026-10-22)

Three PDF-generation/raster-review passes inspected all six variants against the photographs:

1. Checked printed text, fees, fixed committee capacity, table proportions, identity rules,
   approval blocks, and footer. Found an X placement issue caused by normalized spaces,
   a tight Doctoral heading gap, and insufficient footer bottom clearance.
2. Preserved measured selection spaces, placed the marker within the correct parentheses,
   raised the Doctoral masthead/application section, and moved both footers upward.
   Reviewed every variant; the normal email still reserved an unnecessary second line.
3. Rebalanced only the Email label/value widths, regenerated all six PDFs/PNGs, and inspected
   them again. Normal fields are compact; long course/email/approval names remain bounded.
   No clipping, text/line overlap, or missing footer was observed. Printed committee signing
   lines, unused slots, and lower-page whitespace are preserved.

Fifteen TEMPLATE-3 tests pass, plus all eight TEMPLATE-2 and nine TEMPLATE-1 tests (32 total).
Coverage includes deterministic valid one-page A4 bytes for both forms, exact labels/codes,
physical slot counts and blank slots, literal fee text independent of payment values, explicit
selection-marker position, unchanged display values, no inferred identities/approval/payment,
long-value bounds, overflow rejection, and the production import boundary.
Backend TypeScript build and `git diff --check` pass.

Accepted TEMPLATE-1/TEMPLATE-2 files, shared helpers, sample scripts/tests, and all retained
PDF/PNG samples were checked against pre-implementation hashes and remain unchanged.
No new assets/dependencies, API/UI, schema, extraction/storage, waiver, scoring, or workflow
changes are included.

Fidelity limits: exact original fonts and millimeter measurements cannot be recovered from
perspective photographs. Standard fonts replace the photographed condensed body typography.
Color logos retain their supplied colors and existing 141/207 px resolution limits. Clean
vector geometry removes paper holes, skew, grain, shadows, and scan artifacts. Footer placement
is slightly higher to retain a safe print margin. No photographed background is embedded.

This completes implementation of the approved static-template family only.
Project-owner visual acceptance remains pending.
Do not start GS-IS integration, GS Form No. 22, or another package.
