# GS-020 Adviser Request (GS020-1A)

Pure presentation package for **EARIST-QSF-GS-020 Rev. 00 (06.20.25)**,
reconstructed programmatically from the project-owner-supplied photograph.
`renderAdviserRequest(input): Promise<Uint8Array>` returns one deterministic A4
page drawn from text, rules, the accepted clean logos, and an optional signature.
The photograph is not embedded or used as a source for cropped logos.

`AdviserRequestRenderInput` receives only:

- `logos`: explicit EARIST and Graduate School PNG/JPEG bytes;
- `requestDate`: a display-ready string, without parsing or locale inference;
- `requestedAdviserName`: the single display authority reused in the request
  statement and the CONFORME area;
- `reason`: the supplied request content, retaining explicit paragraph breaks;
- `studentName`, `studentNumber`, and `programName`: explicit display values;
- optional `studentSignature`: explicit PNG/JPEG bytes, contained above the name.

Empty strings leave fields blank. Signature omission leaves the signature region
blank while retaining the Student printed name and captions. Invalid or unsupported
signature images fail explicitly. The geometric sample signature is dummy QA data.
Neither authentication nor a printed name becomes a signature image.

The Dean name/signature area always remains blank: the contract deliberately has
no Dean identity/signature input. Adviser CONFORME has no separate signature-image
requirement. There is no title, stage, verdict, score, response-date, or approval-date
field. Supplying display data does not establish workflow completion or eligibility.

Dynamic text uses measured bounds with an 11-point preferred size and 10-point
minimum. Adviser/Student names and Student Number can wrap to two lines. Program
uses one to three lines only as needed, keeping the lower left CONFORME, Approved,
and footer regions fixed. Reason text occupies four unequal ruled lines: the first
follows the printed sentence and the fourth is shorter. Explicit empty paragraphs
consume a line. Long unbroken identifiers can wrap without losing characters.
Horizontal whitespace follows the accepted shared text convention (normalized
between words); all supplied words/characters are retained. Oversized fields throw
a field-specific `RangeError`; there is no silent truncation or clipping.

Only `pdf-lib`, package-local types, and accepted shared presentation helpers are
dependencies. No shared helper or earlier renderer was changed. There is no
filesystem/network lookup, database, Prisma, eligibility, authorization, HTTP,
workflow, signature persistence, immutable snapshot, or UI integration.

From `backend/`:

```sh
npm test -- tests/unit/documents/official-defense/adviser-request.renderer.test.ts
npm run forms:check
npm run build
npm run forms:sample:adviser-request -- --rasterize
```

Optional rasterization requires `pdftoppm` on PATH or `PDFTOPPM_PATH`. Omit
`--rasterize` to generate PDFs alone. The development-only generator writes these
ignored local artifacts under `backend/.tmp/official-form-samples/`:

- `adviser-request-normal.pdf`: realistic fictitious values, blank Student signature;
- `adviser-request-long.pdf`: long Adviser, Student, Program, Number, and reason;
- `adviser-request-signed.pdf`: synthetic geometric Student signature;
- `adviser-request-blank.pdf`: all display fields empty.

Each has a matching `.png` when rasterized. Every sample leaves the Dean identity
and signature blank. Generated PDF/PNG files must not be committed or used as
permanent production storage.

Fidelity limits: photograph perspective and the original condensed print font
cannot be reproduced exactly with standard PDF fonts. The clean logo assets have
the same resolution limits documented in `backend/assets/official-forms/README.md`.
Bounded wrapping reserves extra space for long identities while retaining the
form's intentional whitespace and lower signature regions. Project-owner visual
QA was completed and accepted on 2026-10-25 after comparison with the supplied
official reference photograph. The accepted implementation baseline is
`76bdd3c4f3c4525e528679009a1a93e123b81d26`. GS020-1B is not implemented here.
