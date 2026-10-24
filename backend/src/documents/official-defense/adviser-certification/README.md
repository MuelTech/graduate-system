# GS-017 Adviser Certification (PREDEF-1A)

Pure presentation package for **EARIST-QSF-GS-017 Rev. 01 (06.20.25)**,
reconstructed from the project-owner-supplied photograph. It draws a single A4
page with text, rules, the two institutional logos, and one vector stage check.
The photograph is never embedded as a background.

`renderAdviserCertification(input): Promise<Uint8Array>` consumes only the
`AdviserCertificationRenderInput` display contract:

- logo PNG/JPEG bytes;
- manuscript title, Student display name, and program display name;
- explicit `proposal` or `final` stage (Title and other values fail at runtime);
- separate issued-day and issued-month/year display strings;
- Adviser printed name and optional PNG/JPEG signature bytes.

Empty display strings leave their fields blank. The stage remains required even
for an otherwise blank sample. The Student display name is printed again on the
official request continuation; there is no separate requester identity to infer.
Dates are printed verbatim, with no current-date, locale, or ordinal calculation.
Signature omission leaves the signature area blank without hiding the printed
name or caption. Invalid image bytes fail rather than silently losing a signature.

Text uses measured boxes and readable 10-point minimum dynamic type (10.5 for
the title). The title has four ruled lines. Student/program fields can wrap to
two lines; subsequent body blocks shift together while the footer stays fixed.
Unbounded content throws a field-specific `RangeError`, never truncates. The
request continuation rule extends for longer names. The Adviser name may wrap
below the contained signature image without overlap.

The package reuses the accepted shared masthead, text/image/layout helpers and
the exported GS-006/007 `drawStageCheck` presentation helper. No accepted renderer
or shared helper was modified. It contains no file/network I/O, domain lookups,
Prisma, services, authorization, HTTP, or workflow integration.

From `backend/`:

```sh
npm test -- tests/unit/documents/official-defense/adviser-certification.renderer.test.ts
npm run forms:check
npm run build
npm run forms:sample:certification -- --rasterize
```

The optional rasterization step requires `pdftoppm` on PATH, or `PDFTOPPM_PATH`.
Omit `--rasterize` to generate PDFs alone. Outputs are ignored local QA artifacts
in `backend/.tmp/official-form-samples/`, never production assets:

- `adviser-certification-proposal.pdf` (blank signature);
- `adviser-certification-final.pdf` (synthetic geometric signature strokes);
- `adviser-certification-long.pdf` (title/name/program stress);
- `adviser-certification-blank.pdf` (empty display fields, Proposal selection).

Rasterization writes matching `.png` previews. All sample data is fictitious.
The renderer and contract await project-owner visual acceptance before becoming
the frozen baseline for separately authorized PREDEF-1B/1C integration.
