import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PDFPage, StandardFonts } from "pdf-lib";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  STAGE_CHECK_THICKNESS,
  renderDefenseApplication,
  stageCheckSegments,
} from "../../../../src/documents/official-defense/defense-application/defense-application.renderer";
import type {
  DefenseApplicationRenderInput,
  DefenseApplicationType,
} from "../../../../src/documents/official-defense/defense-application/defense-application.types";

type Variant = "masters" | "doctoral";

const CAPACITY = {
  masters: { title: 5, proposal: 4, final: 4, blank: 5 },
  doctoral: { title: 6, proposal: 5, final: 5, blank: 6 },
} as const;

const CASES = [
  { variant: "masters", applicationType: "title", adviser: false },
  { variant: "masters", applicationType: "proposal", adviser: true },
  { variant: "masters", applicationType: "final", adviser: true },
  { variant: "doctoral", applicationType: "title", adviser: false },
  { variant: "doctoral", applicationType: "proposal", adviser: true },
  { variant: "doctoral", applicationType: "final", adviser: true },
] as const;

const SHORT_NAMES = [
  "Dr. One",
  "Dr. Two",
  "Dr. Three",
  "Dr. Four",
  "Dr. Five",
  "Dr. Six",
];
const LONG_NAMES = [
  "Dr. Maria Esperanza de la Cruz-Villanueva",
  "Dr. Juan Miguel de los Santos-Mendoza",
  "Dr. Alexandra Ysabel Santiago-Rodriguez",
  "Dr. Jose Antonio Garcia-de la Fuente",
  "Dr. Rafael Guillermo Navarro-Santiago",
  "Dr. Patricia Beatriz Mendoza-Fernandez",
];
const LONG_ADVISER = "Dr. Maria Andrea Fernandez-Villanueva";
const LONG_FACILITATOR = "Prof. Maria Consuelo Fernandez-Ramos";
const LONG_RAPPORTEUR = "Prof. Christopher Emmanuel del Rosario";

let logos: DefenseApplicationRenderInput["logos"];

beforeAll(async () => {
  const assets = path.resolve(__dirname, "../../../../assets/official-forms");
  logos = {
    earist: {
      mimeType: "image/jpeg",
      bytes: await readFile(path.join(assets, "earist-logo.jpg")),
    },
    graduateSchool: {
      mimeType: "image/jpeg",
      bytes: await readFile(path.join(assets, "graduate-school-logo.jpg")),
    },
  };
});

function showsAdviser(applicationType: DefenseApplicationType): boolean {
  return applicationType === "proposal" || applicationType === "final";
}

function inputFor(
  variant: Variant,
  applicationType: DefenseApplicationType,
  options: {
    blank?: boolean;
    long?: boolean;
    panelistCount?: number;
    includeAdviser?: boolean;
  } = {},
): DefenseApplicationRenderInput {
  const blank = options.blank ?? false;
  const long = options.long ?? false;
  const capacity = CAPACITY[variant][applicationType ?? "blank"];
  const panelistCount = options.panelistCount ?? (blank ? 0 : capacity);
  const includeAdviser =
    options.includeAdviser ?? (!blank && showsAdviser(applicationType));
  const panelistNames = blank
    ? []
    : (long ? LONG_NAMES : SHORT_NAMES).slice(0, panelistCount);
  const identity = blank
    ? {
        studentName: "",
        courseAndMajor: "",
        studentNumber: "",
        cellphoneNumber: "",
        applicantDateAndTime: "",
        amountPaid: "",
        officialReceiptNumber: "",
        dateOfApplication: "",
        personalGmail: "",
        defenseDate: "",
        defenseTime: "",
        defenseLink: "",
        deanName: "",
        vicePresidentName: "",
        presidentName: "",
      }
    : long
      ? {
          studentName: "Maria Alexandra de los Santos-Villanueva",
          courseAndMajor:
            variant === "masters"
              ? "Master of Arts in Education - Educational Management"
              : "Doctor of Education - Educational Leadership and Management",
          studentNumber: "GRAD-2026-000123456",
          cellphoneNumber: "+63 917 000 0123",
          applicantDateAndTime: "30 September 2026, 10:00 AM",
          amountPaid: "PHP 900.00 (display only)",
          officialReceiptNumber: "QA-OR-2026-00001234567890",
          dateOfApplication: "30 September 2026",
          personalGmail: "maria.villanueva.qa@gmail.com",
          defenseDate: "30 September 2026",
          defenseTime: "10:00-11:30 AM",
          defenseLink: "meet.test/qa",
          deanName: "Dr. Jose Emmanuel de los Santos-Cruz",
          vicePresidentName: "Dr. Maria Alexandra Fernandez-Villanueva",
          presidentName: "Dr. Juan Miguel Santiago-Rodriguez",
        }
      : {
          studentName: "Sample Candidate",
          courseAndMajor: variant === "masters" ? "MAEd" : "EdD",
          studentNumber: "STUDENT-00123",
          cellphoneNumber: "0917 000 0123",
          applicantDateAndTime: "22 Oct 2026, 9:00 AM",
          amountPaid: "123.45",
          officialReceiptNumber: "UNVERIFIED-QA-OR",
          dateOfApplication: "22 October 2026",
          personalGmail: "qa.gs@gmail.com",
          defenseDate: "30 October 2026",
          defenseTime: "11:00 AM",
          defenseLink: "GS Room 201",
          deanName: "Explicit Dean",
          vicePresidentName: "Explicit Vice President",
          presidentName: "Explicit President",
        };

  return {
    variant,
    logos,
    applicationType,
    ...identity,
    committee: {
      ...(includeAdviser
        ? { adviserName: long ? LONG_ADVISER : "Explicit Adviser" }
        : {}),
      panelistNames,
      facilitatorName: blank ? "" : long ? LONG_FACILITATOR : "Explicit Facilitator",
      rapporteurName: blank ? "" : long ? LONG_RAPPORTEUR : "Explicit Rapporteur",
    },
  };
}

interface TextItem {
  str: string;
  width: number;
  height: number;
  transform: number[];
}

async function inspect(bytes: Uint8Array): Promise<TextItem[]> {
  const specifier = "pdfjs-dist/legacy/build/pdf.mjs";
  const { getDocument } = await import(specifier);
  const task = getDocument({
    data: bytes.slice(),
    verbosity: 0,
    disableFontFace: true,
    useSystemFonts: true,
  });
  try {
    const pdf = await task.promise;
    expect(pdf.numPages).toBe(1);
    return (await (await pdf.getPage(1)).getTextContent()).items.filter(
      (item: unknown): item is TextItem =>
        typeof (item as TextItem).str === "string",
    );
  } finally {
    await task.destroy();
  }
}

const joined = (items: TextItem[]) => items.map((item) => item.str).join(" ");
const compact = (value: string) => value.replace(/\s/g, "");

/** Committee underlines share the 1.1 thickness; check segments are short. */
function isStageCheck(options: {
  thickness?: number;
  start: { x: number; y: number };
  end: { x: number; y: number };
}): boolean {
  if (options.thickness !== STAGE_CHECK_THICKNESS) return false;
  const dx = options.end.x - options.start.x;
  const dy = options.end.y - options.start.y;
  return Math.hypot(dx, dy) < 6;
}

function committeeLabels(items: TextItem[]): string[] {
  return items
    .filter((item) =>
      ["Adviser", "Panelist", "Facilitator", "Rapporteur"].includes(item.str),
    )
    .map((item) => item.str);
}

describe.each(CASES)(
  "TEMPLATE-3 $variant $applicationType committee structure",
  ({ variant, applicationType, adviser }) => {
    const capacity = CAPACITY[variant][applicationType];

    it("returns deterministic valid single-page A4 bytes without mutating explicit inputs", async () => {
      const input = inputFor(variant, applicationType);
      const before = JSON.stringify(input);
      const bytes = await renderDefenseApplication(input);
      expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");
      const doc = await PDFDocument.load(bytes);
      expect(doc.getPageCount()).toBe(1);
      expect(doc.getPage(0).getWidth()).toBeCloseTo(595.28, 2);
      expect(doc.getPage(0).getHeight()).toBeCloseTo(841.89, 2);
      expect(await renderDefenseApplication(input)).toEqual(bytes);
      expect(JSON.stringify(input)).toBe(before);
    });

    it("prints the stage-specific Adviser/Panelist capacity without a Chairman label", async () => {
      const items = await inspect(
        await renderDefenseApplication(
          inputFor(variant, applicationType, { blank: true }),
        ),
      );
      const labels = committeeLabels(items);
      expect(labels.filter((label) => label === "Panelist")).toHaveLength(
        capacity,
      );
      expect(labels.filter((label) => label === "Adviser")).toHaveLength(
        adviser ? 1 : 0,
      );
      expect(labels.filter((label) => label === "Facilitator")).toHaveLength(1);
      expect(labels.filter((label) => label === "Rapporteur")).toHaveLength(1);
      expect(labels).toHaveLength(variant === "masters" ? 7 : 8);
      if (adviser) expect(labels[0]).toBe("Adviser");
      expect(labels.at(-2)).toBe("Facilitator");
      expect(labels.at(-1)).toBe("Rapporteur");
      expect(joined(items)).not.toMatch(/\bChairman\b/);
      const captions = items.filter((item) =>
        ["Adviser", "Panelist", "Facilitator", "Rapporteur"].includes(item.str),
      );
      captions.slice(1).forEach((caption, index) =>
        expect(captions[index].transform[5] - caption.transform[5]).toBeCloseTo(
          26,
          2,
        ),
      );
    });

    it("does not infer roles from supplied names and leaves unused slots blank", async () => {
      const empty = inputFor(variant, applicationType, { blank: true });
      const partial = {
        ...empty,
        committee: {
          ...empty.committee,
          panelistNames: ["First Supplied", "Second Supplied"],
        },
      };
      const items = await inspect(await renderDefenseApplication(partial));
      const text = joined(items);
      expect(text).toContain("First Supplied");
      expect(text).toContain("Second Supplied");
      expect(text).not.toMatch(/Chairman/);
      expect(items.filter((item) => item.str === "Panelist")).toHaveLength(
        capacity,
      );
      const excessive = Array.from(
        { length: capacity + 1 },
        (_, index) => "Supplied " + index,
      );
      await expect(
        renderDefenseApplication({
          ...empty,
          committee: { ...empty.committee, panelistNames: excessive },
        }),
      ).rejects.toThrow(/printed Panelist slots/);
    });

    it("preserves explicit display values, fees, and exact form identity", async () => {
      const input = inputFor(variant, applicationType);
      const items = await inspect(await renderDefenseApplication(input));
      const text = joined(items);
      for (const value of [
        input.studentName,
        input.courseAndMajor,
        input.studentNumber,
        input.cellphoneNumber,
        input.applicantDateAndTime,
        input.amountPaid,
        input.officialReceiptNumber,
        input.dateOfApplication,
        input.personalGmail,
        input.defenseDate,
        input.defenseTime,
        input.defenseLink,
        input.deanName,
        input.vicePresidentName,
        input.presidentName,
        ...input.committee.panelistNames,
        input.committee.facilitatorName,
        input.committee.rapporteurName,
        ...(input.committee.adviserName ? [input.committee.adviserName] : []),
      ])
        expect(compact(text)).toContain(compact(value));
      expect(items.filter((item) => item.str === "300")).toHaveLength(6);
      expect(items.filter((item) => item.str === "P 900.00")).toHaveLength(2);
      // FORM-INT-4 FIX-3: the visible form code/revision is intentionally omitted.
      expect(text).not.toContain("EARIST-QSF-GS-006");
      expect(text).not.toContain("EARIST-QSF-GS-007");
      expect(text).not.toMatch(/Rev\.\s*01|06\.20\.25/);
      expect(text).toContain(
        variant === "masters" ? "MASTERS PROGRAM" : "DOCTORAL PROGRAM",
      );
      // System-generated application: the paper-only handwriting instruction is omitted.
      expect(text).not.toContain("Note: Please write legibly");
      expect(text).not.toMatch(/\bVERIFIED\b|PAID IN FULL|PASSED|REDEFENSE|APPROVED BY/);
    });

    it("keeps long values complete and inside the one-page print-safe bounds", async () => {
      const long = inputFor(variant, applicationType, { long: true });
      const items = await inspect(await renderDefenseApplication(long));
      const fullText = compact(joined(items));
      for (const value of [
        long.studentName,
        long.courseAndMajor,
        long.personalGmail,
        long.studentNumber,
        long.amountPaid,
        long.officialReceiptNumber,
        long.dateOfApplication,
        long.applicantDateAndTime,
        long.defenseDate,
        long.defenseTime,
        long.defenseLink,
        ...long.committee.panelistNames,
        long.deanName,
        long.vicePresidentName,
        long.presidentName,
        long.committee.facilitatorName,
        long.committee.rapporteurName,
        ...(long.committee.adviserName ? [long.committee.adviserName] : []),
      ])
        expect(fullText).toContain(compact(value));
      for (const item of items.filter((item) => item.str.trim())) {
        expect(item.transform[4]).toBeGreaterThanOrEqual(36);
        expect(item.transform[4] + item.width).toBeLessThanOrEqual(559.28);
        expect(item.transform[5]).toBeGreaterThanOrEqual(36);
        expect(item.transform[5] + item.height).toBeLessThanOrEqual(823.89);
      }
      expect(fullText).not.toContain("EARIST-QSF-GS-");
      expect(fullText).not.toMatch(/Rev\.\s*01|06\.20\.25/);
      for (const name of long.committee.panelistNames) {
        const item = items.find((candidate) => candidate.str.includes(name));
        expect(item, name).toBeDefined();
        expect(item!.transform[4]).toBeGreaterThan(74);
        expect(item!.transform[4] + item!.width).toBeLessThan(450);
      }
      const scheduleItems = items.filter((item) =>
        ["10:00-11:30 AM", "meet.test/qa"].includes(item.str),
      );
      expect(scheduleItems).toHaveLength(2);
      for (const item of scheduleItems) {
        expect(item.transform[4] + item.width).toBeLessThanOrEqual(538 - 3);
      }
    });
  },
);

const LONG_PHYSICAL_VENUE = "Graduate School Conference Room, Nudas Building";
const GOOGLE_MEET_URL = "https://meet.google.com/abc-defg-hij";
const TEAMS_URL =
  "https://teams.microsoft.com/l/meetup-join/19%3ameeting_MTc0ZjQ2YjItOWQ4ZS00N2M5LThhYjgtZjY0ZTk2N2Q4YjIx%40thread.v2/0?context=%7b%22Tid%22%3a%228b3f5c2a-1d4e-4f6a-9c7b-2e1d0a9f8c6b%22%2c%22Oid%22%3a%224c2e6f1a-7b3d-4a8e-9f5c-1d2b3a4c5d6e%22%7d";

const LINK_CASES = [
  { variant: "masters", applicationType: "title", link: "Room 101, GS Building" },
  { variant: "doctoral", applicationType: "title", link: "Room 101, GS Building" },
  { variant: "masters", applicationType: "title", link: LONG_PHYSICAL_VENUE },
  { variant: "masters", applicationType: "proposal", link: GOOGLE_MEET_URL },
  { variant: "doctoral", applicationType: "proposal", link: TEAMS_URL },
] as const;

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function boxOf(item: TextItem): Box {
  return {
    left: item.transform[4],
    right: item.transform[4] + item.width,
    top: item.transform[5] + item.height,
    bottom: item.transform[5],
  };
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.bottom < b.top && b.bottom < a.top;
}

describe("TEMPLATE-3 schedule link/venue capacity", () => {
  it.each(LINK_CASES)(
    "$variant $applicationType renders the complete link text: $link",
    async ({ variant, applicationType, link }) => {
      const input = { ...inputFor(variant, applicationType), defenseLink: link };
      const bytes = await renderDefenseApplication(input);
      expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");

      const doc = await PDFDocument.load(bytes);
      expect(doc.getPageCount()).toBe(1);
      expect(doc.getPage(0).getWidth()).toBeCloseTo(595.28, 2);
      expect(doc.getPage(0).getHeight()).toBeCloseTo(841.89, 2);

      const items = await inspect(bytes);
      expect(compact(joined(items))).toContain(compact(link));

      for (const item of items.filter((candidate) => candidate.str.trim())) {
        expect(item.transform[4]).toBeGreaterThanOrEqual(36);
        expect(item.transform[4] + item.width).toBeLessThanOrEqual(559.28);
        expect(item.transform[5]).toBeGreaterThanOrEqual(36);
        expect(item.transform[5] + item.height).toBeLessThanOrEqual(823.89);
      }

      expect(compact(joined(items))).not.toContain("EARIST-QSF-GS-");
      expect(compact(joined(items))).not.toMatch(/Rev\.01|06\.20\.25/);
    },
  );

  it("keeps schedule fields separate and above the committee heading for a long Teams URL", async () => {
    const input = {
      ...inputFor("doctoral", "proposal"),
      defenseLink: TEAMS_URL,
    };
    const items = await inspect(await renderDefenseApplication(input));

    const dateLabel = items.find((item) => item.str === "Date of Defense:")!;
    const dateValue = items.find((item) => item.str === "30 October 2026")!;
    const timeLabel = items.find((item) => item.str === "Time:")!;
    const timeValue = items.find((item) => item.str === "11:00 AM")!;
    const linkLabel = items.find((item) => item.str === "Link:")!;
    const heading = items.find((item) => item.str === "EXAMINATION COMMITTEE:")!;
    expect(dateLabel && dateValue && timeLabel && timeValue && linkLabel && heading).toBeTruthy();

    // Date and Time share the first schedule line; Link is on its own line below.
    expect(dateLabel.transform[5]).toBeCloseTo(timeLabel.transform[5], 2);
    expect(dateLabel.transform[4]).toBeLessThan(timeLabel.transform[4]);
    expect(linkLabel.transform[5]).toBeLessThan(dateLabel.transform[5]);

    // Every rendered line/fragment of the URL sits below the Link label and
    // above the committee heading, inside the table's horizontal bounds.
    const linkFragments = items.filter(
      (item) =>
        item.str.trim() &&
        item.transform[4] >= linkLabel.transform[4] + linkLabel.width &&
        item.transform[5] <= linkLabel.transform[5] &&
        item.transform[5] > heading.transform[5] + heading.height,
    );
    expect(linkFragments.length).toBeGreaterThan(1);
    for (const fragment of linkFragments) {
      expect(fragment.transform[4]).toBeGreaterThanOrEqual(96);
      expect(fragment.transform[4] + fragment.width).toBeLessThanOrEqual(538);
      expect(fragment.transform[5]).toBeGreaterThan(
        heading.transform[5] + heading.height,
      );
    }

    // Schedule labels/values must not overlap each other or the URL fragments.
    const scheduleBoxes = [
      dateLabel,
      dateValue,
      timeLabel,
      timeValue,
      linkLabel,
      ...linkFragments,
    ].map(boxOf);
    for (let i = 0; i < scheduleBoxes.length; i += 1) {
      for (let j = i + 1; j < scheduleBoxes.length; j += 1) {
        expect(overlaps(scheduleBoxes[i], scheduleBoxes[j])).toBe(false);
      }
    }

    // Committee table and lower approval structure remain intact.
    const labels = committeeLabels(items);
    expect(labels.filter((label) => label === "Panelist")).toHaveLength(5);
    expect(labels.filter((label) => label === "Adviser")).toHaveLength(1);
    expect(labels.filter((label) => label === "Facilitator")).toHaveLength(1);
    expect(labels.filter((label) => label === "Rapporteur")).toHaveLength(1);

    const order = [
      "Prepared by:",
      "Dean, Graduate School",
      "Recommending Approval:",
      "Vice President for Academic Affairs",
      "Approved:",
      "President",
    ];
    const positions = order.map(
      (text) => items.find((item) => item.str === text)!.transform[5],
    );
    for (let i = 0; i < positions.length - 1; i += 1) {
      expect(positions[i]).toBeGreaterThan(positions[i + 1]);
    }
    expect(compact(joined(items))).not.toContain("EARIST-QSF-GS-");
  });

  it("keeps the existing short link rendering unchanged semantically", async () => {
    const input = { ...inputFor("masters", "title"), defenseLink: "GS Room 201" };
    const items = await inspect(await renderDefenseApplication(input));
    expect(compact(joined(items))).toContain("GSRoom201");
    expect(items.filter((item) => item.str === "Link:")).toHaveLength(1);
  });

  it("still fails explicitly for an extreme value beyond bounded capacity", async () => {
    await expect(
      renderDefenseApplication({
        ...inputFor("masters", "title"),
        defenseLink: "https://example.com/" + "a".repeat(600),
      }),
    ).rejects.toThrow(/Defense link exceeds/);
  });
});

describe("TEMPLATE-3 null application type", () => {
  it.each(["masters", "doctoral"] as const)(
    "%s uses the neutral maximum blank layout without a stage marker or Adviser",
    async (variant) => {
      const input = inputFor(variant, null, { blank: true });
      const spy = vi.spyOn(PDFPage.prototype, "drawLine");
      try {
        const items = await inspect(await renderDefenseApplication(input));
        const labels = committeeLabels(items);
        expect(labels.filter((label) => label === "Panelist")).toHaveLength(
          CAPACITY[variant].blank,
        );
        expect(labels.filter((label) => label === "Adviser")).toHaveLength(0);
        expect(labels).toHaveLength(variant === "masters" ? 7 : 8);
        expect(items.some((item) => item.str === "X")).toBe(false);
        expect(items.some((item) => item.str.includes("✓"))).toBe(false);
        expect(
          spy.mock.calls
            .map(([options]) => options as any)
            .filter(isStageCheck),
        ).toHaveLength(0);
        const doc = await PDFDocument.load(await renderDefenseApplication(input));
        expect(doc.getPageCount()).toBe(1);
      } finally {
        spy.mockRestore();
      }
    },
  );

  it.each([
    { variant: "masters", applicationType: "title" },
    { variant: "masters", applicationType: null },
    { variant: "doctoral", applicationType: "title" },
    { variant: "doctoral", applicationType: null },
  ] as const)(
    "rejects a supplied Adviser when $variant/$applicationType has no printed row",
    async ({ variant, applicationType }) => {
      await expect(
        renderDefenseApplication(
          inputFor(variant, applicationType, { includeAdviser: true }),
        ),
      ).rejects.toThrow(/printed Adviser row/);
    },
  );
});

describe("TEMPLATE-3 presentation boundary", () => {
  it("draws exactly one vector stage check mark inside the selected parentheses", async () => {
    const measure = await PDFDocument.create(),
      font = await measure.embedFont(StandardFonts.TimesRomanBoldItalic);
    const selection = "(   ) Title / (   ) Proposal / (   ) Final Defense",
      size = 10.5;
    const start = 303 - font.widthOfTextAtSize(selection, size) / 2;
    const prefixes = {
      title: "",
      proposal: "(   ) Title / ",
      final: "(   ) Title / (   ) Proposal / ",
    } as const;

    for (const variant of ["masters", "doctoral"] as const) {
      for (const applicationType of ["title", "proposal", "final"] as const) {
        const spy = vi.spyOn(PDFPage.prototype, "drawLine");
        let segments: any[] = [];
        let items: TextItem[] = [];
        try {
          const bytes = await renderDefenseApplication(
            inputFor(variant, applicationType, { blank: true }),
          );
          segments = spy.mock.calls
            .map(([options]) => options as any)
            .filter(isStageCheck);
          items = await inspect(bytes);
        } finally {
          spy.mockRestore();
        }

        expect(segments).toHaveLength(2);
        expect(segments[0].end).toEqual(segments[1].start);
        const xs = [segments[0].start.x, segments[0].end.x, segments[1].end.x];
        const ys = [segments[0].start.y, segments[0].end.y, segments[1].end.y];
        const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
        const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
        const left = start + font.widthOfTextAtSize(prefixes[applicationType] + "(", size);
        const right = left + font.widthOfTextAtSize("   ", size);

        expect(centerX).toBeGreaterThan(left + 0.5);
        expect(centerX).toBeLessThan(right - 0.5);
        expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(right - left - 1);
        const line = items.find((item) => item.str.includes("Title /"))!;
        expect(centerY).toBeGreaterThan(line.transform[5] + 1);
        expect(centerY).toBeLessThan(line.transform[5] + 7);
        expect(items.some((item) => item.str === "X")).toBe(false);
        expect(items.some((item) => item.str.includes("✓"))).toBe(false);
      }
    }
  });

  it("keeps the stage check mark centered and clear of the parentheses", () => {
    const centerX = 300;
    const centerY = 170;
    const [first, second] = stageCheckSegments(centerX, centerY);
    const xs = [first.start.x, first.end.x, second.end.x];
    const ys = [first.start.y, first.end.y, second.end.y];
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    // Parenthesis interior is roughly 7.9 pt wide and 7.5 pt tall at 10.5 pt.
    expect(first.end).toEqual(second.start);
    expect((minX + maxX) / 2).toBeCloseTo(centerX, 5);
    expect((minY + maxY) / 2).toBeCloseTo(centerY, 5);
    expect(minX - (centerX - 7.875 / 2)).toBeGreaterThan(0.5);
    expect(centerX + 7.875 / 2 - maxX).toBeGreaterThan(0.5);
    expect(minY - (centerY - 7.5 / 2)).toBeGreaterThan(0.5);
    expect(centerY + 7.5 / 2 - maxY).toBeGreaterThan(0.5);
  });

  it("rejects unknown presentation variants and application types", async () => {
    await expect(
      renderDefenseApplication({
        ...inputFor("masters", "proposal"),
        variant: "unknown",
      } as unknown as DefenseApplicationRenderInput),
    ).rejects.toThrow(/variant must be masters or doctoral/);
    await expect(
      renderDefenseApplication({
        ...inputFor("masters", "proposal"),
        applicationType: "unknown",
      } as unknown as DefenseApplicationRenderInput),
    ).rejects.toThrow(/explicit title, proposal, final, or null/);
  });

  it("keeps production imports limited to pdf-lib and accepted shared/form-specific modules", async () => {
    const directory = path.resolve(
      __dirname,
      "../../../../src/documents/official-defense/defense-application",
    );
    const allowed = new Set([
      "pdf-lib",
      "../shared/institutional-header",
      "../shared/pdf-layout",
      "../shared/pdf-text",
      "./defense-application.types",
    ]);
    for (const file of [
      "defense-application.renderer.ts",
      "defense-application.types.ts",
    ]) {
      const source = await readFile(path.join(directory, file), "utf8");
      for (const match of source.matchAll(/from\s+["']([^"']+)["']/g))
        expect(allowed.has(match[1]), match[1]).toBe(true);
      expect(source).not.toMatch(/\b(?:require|import)\s*\(/);
    }
  });
});
