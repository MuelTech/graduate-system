import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { beforeAll, describe, expect, it } from "vitest";
import { renderDefenseApplication } from "../../../../src/documents/official-defense/defense-application/defense-application.renderer";
import type { DefenseApplicationRenderInput } from "../../../../src/documents/official-defense/defense-application/defense-application.types";

let base: DefenseApplicationRenderInput;
beforeAll(async () => {
  const assets = path.resolve(__dirname, "../../../../assets/official-forms");
  base = {
    variant: "masters",
    logos: {
      earist: { mimeType: "image/jpeg", bytes: await readFile(path.join(assets, "earist-logo.jpg")) },
      graduateSchool: { mimeType: "image/jpeg", bytes: await readFile(path.join(assets, "graduate-school-logo.jpg")) },
    },
    applicationType: "title", studentName: "Sample Candidate", courseAndMajor: "MAEd",
    studentNumber: "STUDENT-00123", cellphoneNumber: "0917 000 0123",
    applicantDateAndTime: "22 Oct 2026, 9:00 AM", amountPaid: "123.45",
    officialReceiptNumber: "UNVERIFIED-QA-OR", dateOfApplication: "22 October 2026", personalGmail: "qa.gs@gmail.com",
    defenseDate: "30 October 2026", defenseTime: "11:00 AM", defenseLink: "GS Room 201",
    committee: { adviserName: "Explicit Adviser", panelistNames: ["Explicit Panel One"], facilitatorName: "Explicit Facilitator", rapporteurName: "Explicit Rapporteur" },
    deanName: "Explicit Dean", vicePresidentName: "Explicit Vice President", presidentName: "Explicit President",
  };
});
function example(variant: "masters" | "doctoral"): DefenseApplicationRenderInput {
  return variant === "masters" ? base : {
    ...base, variant, courseAndMajor: "EdD",
    committee: { panelistNames: base.committee.panelistNames, facilitatorName: base.committee.facilitatorName, rapporteurName: base.committee.rapporteurName },
  };
}
function blank(input: DefenseApplicationRenderInput): DefenseApplicationRenderInput {
  const common = {
    ...input, applicationType: null, studentName: "", courseAndMajor: "", studentNumber: "", cellphoneNumber: "",
    applicantDateAndTime: "", amountPaid: "", officialReceiptNumber: "", dateOfApplication: "", personalGmail: "",
    defenseDate: "", defenseTime: "", defenseLink: "", deanName: "", vicePresidentName: "", presidentName: "",
  } as const;
  return input.variant === "masters"
    ? { ...common, variant: "masters", committee: { adviserName: "", panelistNames: [], facilitatorName: "", rapporteurName: "" } }
    : { ...common, variant: "doctoral", committee: { panelistNames: [], facilitatorName: "", rapporteurName: "" } };
}
interface TextItem { str: string; width: number; height: number; transform: number[] }
async function inspect(bytes: Uint8Array): Promise<TextItem[]> {
  const specifier = "pdfjs-dist/legacy/build/pdf.mjs";
  const { getDocument } = await import(specifier);
  const task = getDocument({ data: bytes.slice(), verbosity: 0, disableFontFace: true, useSystemFonts: true });
  try {
    const pdf = await task.promise;
    expect(pdf.numPages).toBe(1);
    return (await (await pdf.getPage(1)).getTextContent()).items.filter((item: unknown): item is TextItem =>
      typeof (item as TextItem).str === "string");
  } finally {
    await task.destroy();
  }
}
const joined = (items: TextItem[]) => items.map(item => item.str).join(" ");
const compact = (value: string) => value.replace(/\s/g, "");

describe.each(["masters", "doctoral"] as const)("TEMPLATE-3 %s controlled variant", variant => {
  const panelistCapacity = variant === "masters" ? 4 : 6;
  const formCode = "EARIST-QSF-GS-" + (variant === "masters" ? "006" : "007") + " Rev. 01 (06.20.25)";

  it("returns deterministic valid single-page A4 bytes without mutating explicit inputs", async () => {
    const input = example(variant);
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

  it("preserves institutional labels, program heading, fees, and its own exact form identity", async () => {
    const items = await inspect(await renderDefenseApplication(blank(example(variant))));
    const text = joined(items);
    for (const label of [
      "Republic of the Philippines", 'EULOGIO "AMANG" RODRIGUEZ', "INSTITUTE OF SCIENCE AND TECHNOLOGY",
      "Nagtahan, Sampaloc, Manila", "GRADUATE SCHOOL", "Application for", "Title", "Proposal", "Final Defense",
      variant === "masters" ? "MASTERS PROGRAM" : "DOCTORAL PROGRAM",
      "Name:", "Course & Major:", "Student No.:", "Cellphone No.:", "Date and Time.:", "Amount Paid:", "O.R. No.:",
      "Date of Application:", "Email: (Personal Gmail Only)", "Note: Please write legibly",
      "(Do not fill-out beyond this line)", "(Pay to Cashier's Office)", "PROPOSAL DEFENSE", "FINAL DEFENSE",
      "Defense Fee", "Administrative and Technical Fee", "Energy and Venue Fee",
      "Date of Defense:", "Time:", "Link:", "EXAMINATION COMMITTEE:",
      "Prepared by:", "Dean, Graduate School", "Recommending Approval:", "Vice President for Academic Affairs",
      "Approved:", "President", formCode,
    ]) expect(text).toContain(label);
    expect(text).not.toContain(variant === "masters" ? "GS-007" : "GS-006");
    expect(items.filter(item => item.str === "300")).toHaveLength(6);
    expect(items.filter(item => item.str === "P 900.00")).toHaveLength(2);
    expect(text).not.toContain("GS-011");
    expect(items.some(item => item.str === "X")).toBe(false);
  });

  it("retains the photographed slot capacity and empty spaces without fabricating names or a Chairman", async () => {
    const empty = blank(example(variant));
    const items = await inspect(await renderDefenseApplication(empty));
    const text = joined(items);
    expect(items.filter(item => item.str === "Panelist")).toHaveLength(panelistCapacity);
    expect(items.filter(item => item.str === "Adviser")).toHaveLength(variant === "masters" ? 1 : 0);
    expect(items.filter(item => item.str === "Facilitator")).toHaveLength(1);
    expect(items.filter(item => item.str === "Rapporteur")).toHaveLength(1);
    const captions = items.filter(item => ["Adviser", "Panelist", "Facilitator", "Rapporteur"].includes(item.str));
    expect(captions).toHaveLength(variant === "masters" ? 7 : 8);
    captions.slice(1).forEach((caption, index) =>
      expect(captions[index].transform[5] - caption.transform[5]).toBeCloseTo(26, 2));
    expect(text).not.toMatch(/Explicit|Sample Candidate|Chairman/);
    const partial = joined(await inspect(await renderDefenseApplication({
      ...empty, committee: { ...empty.committee, panelistNames: ["Only supplied panelist"] },
    } as DefenseApplicationRenderInput)));
    expect(partial.match(/Only supplied panelist/g)).toHaveLength(1);
    expect(partial).not.toMatch(/Explicit|Chairman/);
    const excessive = Array.from({ length: panelistCapacity + 1 }, (_, i) => "Supplied " + i);
    await expect(renderDefenseApplication({
      ...empty, committee: { ...empty.committee, panelistNames: excessive },
    } as DefenseApplicationRenderInput)).rejects.toThrow(/printed Panelist slots/);
  });

  it("preserves display-ready payment, schedule, course and names independently of the selection", async () => {
    const input = { ...example(variant), personalGmail: "not-an-email" };
    const items = await inspect(await renderDefenseApplication(input));
    const text = compact(joined(items));
    for (const value of [
      input.studentName, input.courseAndMajor, input.studentNumber, input.cellphoneNumber,
      input.applicantDateAndTime, input.amountPaid, input.officialReceiptNumber, input.dateOfApplication,
      input.personalGmail, input.defenseDate, input.defenseTime, input.defenseLink,
      input.deanName, input.vicePresidentName, input.presidentName,
      ...input.committee.panelistNames, input.committee.facilitatorName, input.committee.rapporteurName,
      ...(input.variant === "masters" ? [input.committee.adviserName] : []),
    ]) expect(text).toContain(compact(value));
    // 123.45 does not change the pre-printed 300/900 fee text or establish a payment/approval state.
    expect(items.filter(item => item.str === "300")).toHaveLength(6);
    expect(items.filter(item => item.str === "P 900.00")).toHaveLength(2);
    expect(joined(items)).not.toMatch(/\bVERIFIED\b|PAID IN FULL|PASSED|REDEFENSE|APPROVED BY/);
    const noNames = joined(await inspect(await renderDefenseApplication({
      ...blank(input), studentName: "Identity supplied alone", applicationType: "final",
    })));
    expect(noNames).toContain("Identity supplied alone");
    expect(noNames).not.toContain("Explicit");
  });

  it("keeps normal fields compact while fitting complete long values inside page and printed cells", async () => {
    const input = example(variant);
    const normal = await inspect(await renderDefenseApplication(input));
    const find = (items: TextItem[], value: string) => {
      const item = items.find(item => item.str.includes(value));
      expect(item, value).toBeDefined();
      return item!;
    };
    expect(Math.abs(find(normal, "Name:").transform[5] - find(normal, input.studentName).transform[5])).toBeLessThan(0.5);
    const empty = await inspect(await renderDefenseApplication(blank(input)));
    expect(find(normal, "EXAMINATION COMMITTEE:").transform[5]).toBeCloseTo(find(empty, "EXAMINATION COMMITTEE:").transform[5], 2);
    const longNames = [
      "Dr. Maria Esperanza de la Cruz-Villanueva", "Dr. Juan Miguel de los Santos-Mendoza",
      "Dr. Alexandra Ysabel Santiago-Rodriguez", "Dr. Jose Antonio Garcia-de la Fuente",
      "Dr. Rafael Guillermo Navarro-Santiago", "Dr. Patricia Beatriz Mendoza-Fernandez",
    ].slice(0, panelistCapacity);
    const long: DefenseApplicationRenderInput = {
      ...input, studentName: "Maria Alexandra de los Santos-Villanueva",
      courseAndMajor: variant === "masters" ? "Master of Arts in Education - Educational Management"
        : "Doctor of Education - Educational Leadership and Management",
      personalGmail: "maria.villanueva.qa@gmail.com", studentNumber: "GRAD-2026-000123456",
      amountPaid: "PHP 900.00 (display only)", officialReceiptNumber: "QA-OR-2026-00001234567890",
      dateOfApplication: "30 September 2026", applicantDateAndTime: "30 September 2026, 10:00 AM",
      defenseDate: "30 September 2026", defenseTime: "10:00-11:30 AM", defenseLink: "meet.test/qa",
      committee: { ...input.committee, panelistNames: longNames,
        facilitatorName: "Prof. Maria Consuelo Fernandez-Ramos", rapporteurName: "Prof. Christopher Emmanuel del Rosario" },
      deanName: "Dr. Jose Emmanuel de los Santos-Cruz",
      vicePresidentName: "Dr. Maria Alexandra Fernandez-Villanueva", presidentName: "Dr. Juan Miguel Santiago-Rodriguez",
    } as DefenseApplicationRenderInput;
    const items = await inspect(await renderDefenseApplication(long));
    const fullText = compact(joined(items));
    for (const value of [
      long.studentName, long.courseAndMajor, long.personalGmail, long.studentNumber, long.amountPaid,
      long.officialReceiptNumber, long.dateOfApplication, long.applicantDateAndTime, long.defenseDate,
      long.defenseTime, long.defenseLink, ...longNames, long.deanName, long.vicePresidentName, long.presidentName,
      long.committee.facilitatorName, long.committee.rapporteurName,
    ]) expect(fullText).toContain(compact(value));
    for (const item of items.filter(item => item.str.trim())) {
      expect(item.transform[4]).toBeGreaterThanOrEqual(36);
      expect(item.transform[4] + item.width).toBeLessThanOrEqual(559.28);
      expect(item.transform[5]).toBeGreaterThanOrEqual(36);
      expect(item.transform[5] + item.height).toBeLessThanOrEqual(823.89);
    }
    const footer = find(items, formCode);
    expect(footer.transform[5]).toBeGreaterThanOrEqual(36);
    for (const name of longNames) {
      const item = find(items, name);
      expect(item.transform[4]).toBeGreaterThan(74);
      expect(item.transform[4] + item.width).toBeLessThan(450);
    }
    const scheduleItems = items.filter(item => ["10:00-11:30 AM", "meet.test/qa"].includes(item.str));
    expect(scheduleItems).toHaveLength(2);
    for (const item of scheduleItems) {
      const rightEdge = item.str === "meet.test/qa" ? 538 : 428;
      expect(item.transform[4] + item.width).toBeLessThanOrEqual(rightEdge - 3);
    }
  });

  it("fails explicitly for overflowing fields instead of clipping, dropping values, or adding a page", async () => {
    const input = example(variant), oversized = "Oversized supplied value ".repeat(100);
    for (const [changed, message] of [
      [{ ...input, courseAndMajor: oversized }, /Course & Major exceeds/],
      [{ ...input, personalGmail: oversized }, /Personal Gmail exceeds/],
      [{ ...input, amountPaid: oversized }, /Amount paid exceeds/],
      [{ ...input, defenseLink: oversized }, /Defense link exceeds/],
      [{ ...input, committee: { ...input.committee, panelistNames: [oversized] } }, /Panelist 1 name exceeds/],
      [{ ...input, presidentName: oversized }, /President name exceeds/],
    ] as const) await expect(renderDefenseApplication(changed as DefenseApplicationRenderInput)).rejects.toThrow(message);
    const twice = "First line\nSecond line";
    await expect(renderDefenseApplication({
      ...input, studentName: twice, courseAndMajor: twice, studentNumber: twice, cellphoneNumber: twice,
    })).rejects.toThrow(/Cellphone number exceeds the combined application-field space/);
  });
});

describe("TEMPLATE-3 presentation boundary", () => {
  it("places only the explicit unconfirmed QA selection marker inside the corresponding parentheses", async () => {
    const measure = await PDFDocument.create(), font = await measure.embedFont(StandardFonts.TimesRomanBoldItalic);
    const selection = "(   ) Title / (   ) Proposal / (   ) Final Defense", size = 10.5;
    const start = 303 - font.widthOfTextAtSize(selection, size) / 2;
    for (const variant of ["masters", "doctoral"] as const) {
      for (const [applicationType, prefix] of [
        ["title", ""], ["proposal", "(   ) Title / "], ["final", "(   ) Title / (   ) Proposal / "],
      ] as const) {
        const items = await inspect(await renderDefenseApplication({ ...blank(example(variant)), applicationType }));
        const markers = items.filter(item => item.str === "X");
        expect(markers).toHaveLength(1);
        const left = start + font.widthOfTextAtSize(prefix + "(", size);
        expect(markers[0].transform[4]).toBeGreaterThan(left);
        expect(markers[0].transform[4] + markers[0].width).toBeLessThan(left + font.widthOfTextAtSize("   ", size));
        const line = items.find(item => item.str.includes("Title /"))!;
        expect(markers[0].transform[5]).toBeCloseTo(line.transform[5], 2);
      }
    }
  });

  it("rejects unknown presentation variants and a supplied GS-007 Adviser instead of silently losing content", async () => {
    await expect(renderDefenseApplication({ ...base, variant: "unknown" } as unknown as DefenseApplicationRenderInput))
      .rejects.toThrow(/variant must be masters or doctoral/);
    await expect(renderDefenseApplication({ ...base, applicationType: "unknown" } as unknown as DefenseApplicationRenderInput))
      .rejects.toThrow(/explicit title, proposal, final, or null/);
    const doctoral = example("doctoral");
    await expect(renderDefenseApplication({
      ...doctoral, committee: { ...doctoral.committee, adviserName: "No printed slot for this value" },
    } as unknown as DefenseApplicationRenderInput)).rejects.toThrow(/no printed Adviser slot/);
  });

  it("keeps production imports limited to pdf-lib and accepted shared/form-specific modules", async () => {
    const directory = path.resolve(__dirname, "../../../../src/documents/official-defense/defense-application");
    const allowed = new Set(["pdf-lib", "../shared/institutional-header", "../shared/pdf-layout", "../shared/pdf-text", "./defense-application.types"]);
    for (const file of ["defense-application.renderer.ts", "defense-application.types.ts"]) {
      const source = await readFile(path.join(directory, file), "utf8");
      for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) expect(allowed.has(match[1]), match[1]).toBe(true);
      expect(source).not.toMatch(/\b(?:require|import)\s*\(/);
    }
  });
});
