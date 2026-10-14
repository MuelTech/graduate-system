import { describe, expect, it } from "vitest";
import {
  EARIST_COR_PARSER_VERSION,
  parseEaristCorText,
} from "../../../src/extraction/earist-cor.parser";
import type { CorExtractionSuggestions } from "../../../src/extraction/cor-extraction.types";

/**
 * COR-1: pure EARIST COR parser tests.
 *
 * All values below are synthetic/fictitious. The doubled text runs (e.g.
 * `Registration No :Registration No :`) reproduce the overprint layout that the
 * real extracted normalized text exhibits; no real COR data is used.
 */

const EMPTY: CorExtractionSuggestions = {
  studentNumber: null,
  registrationNumber: null,
  studentName: null,
  program: null,
  college: null,
  emailAddress: null,
};

/** A synthetic full COR reproducing the confirmed EARIST label layout/shape. */
const FULL_SAMPLE = [
  "Republic of the PhilippinesRepublic of the Philippines",
  'Eulogio "Amang" RodriguezEulogio "Amang" Rodriguez',
  "Institute of Science and TechnologyInstitute of Science and Technology",
  "Nagtahan St. Sampaloc, ManilaNagtahan St. Sampaloc, Manila",
  "C E R T I F I C A T E O F R E G I S T R A T I O NC E R T I F I C A T E O F R E G I S T R A T I O N",
  "Registration No :Registration No : 12345678901234567890 Academic Year/Term :Academic Year/Term : First Semester AY 2030-2031First Semester AY 2030-2031",
  "STUDENT GENERAL INFORMATIONSTUDENT GENERAL INFORMATION",
  "CODECODE SUBJECT TITLESUBJECT TITLE UNITUNIT SECTIONSECTION SCHEDULE / ROOMSCHEDULE / ROOM FACULTYFACULTY",
  "Student NoStudent No:: 123-45678A123-45678A CollegeCollege :: Graduate SchoolGraduate School",
  "NameName:: DELA CRUZ, JUAN SANTOSDELA CRUZ, JUAN SANTOS ProgramProgram :: Master in Information TechnologyMaster in Information Technology",
  "GenderGender:: MaleMale MajorMajor :: CurriculumCurriculum :: 2023-20242023-2024",
  "Age:Age::: 2424 Year LevelYear Level :: Graduate-RegularGraduate-Regular Scholarship/DiscountScholarship/Discount::",
  "Email Address:Email Address::: juan.delacruz@example.comjuan.delacruz@example.com",
  "A S S E S S E D F E E SA S S E S S E D F E E S",
  "Tuition (3 unit(s))Tuition (3 unit(s)) 1,500.001,500.00",
  "Total Assessment :Total Assessment : 1,500.001,500.00",
  "Payment/Validation Date :Payment/Validation Date : January 15, 2026January 15, 2026",
  "Official Receipt :Official Receipt : 98765439876543",
  "APPROVED BY :APPROVED BY :",
  "Powered by TCPDF (www.tcpdf.org)",
].join("\n");

describe("parseEaristCorText", () => {
  it("exposes a parser version identifier", () => {
    expect(EARIST_COR_PARSER_VERSION).toMatch(/cor/i);
  });

  it("extracts every approved v1 field from a full synthetic sample", () => {
    const result = parseEaristCorText(FULL_SAMPLE);

    expect(result.studentNumber).toBe("123-45678A");
    expect(result.registrationNumber).toBe("1234567890");
    expect(result.studentName).toEqual({
      raw: "DELA CRUZ, JUAN SANTOS",
      surname: "DELA CRUZ",
      firstName: "JUAN",
      middleNameOrInitial: "SANTOS",
    });
    expect(result.program).toBe("Master in Information Technology");
    expect(result.college).toBe("Graduate School");
    expect(result.emailAddress).toBe("juan.delacruz@example.com");
  });

  it("does not treat Academic Year/Term, curriculum, fees or receipts as v1 fields", () => {
    const result = parseEaristCorText(FULL_SAMPLE);
    // Deferred fields must never leak into the v1 suggestion contract.
    expect(Object.keys(result)).toEqual([
      "studentNumber",
      "registrationNumber",
      "studentName",
      "program",
      "college",
      "emailAddress",
    ]);
  });

  it("tolerates repeated and irregular whitespace", () => {
    const messy = [
      "Student NoStudent No::    123-45678A123-45678A    CollegeCollege ::   Graduate   SchoolGraduate   School",
      "NameName::   DELA   CRUZ,    JUAN     SANTOSDELA   CRUZ,    JUAN     SANTOS   ProgramProgram ::   Master   in   Information   TechnologyMaster   in   Information   Technology",
      "Email Address:Email Address:::    juan.delacruz@example.comjuan.delacruz@example.com",
    ].join("\n");

    const result = parseEaristCorText(messy);

    expect(result.studentNumber).toBe("123-45678A");
    expect(result.college).toBe("Graduate School");
    expect(result.studentName).toEqual({
      raw: "DELA CRUZ, JUAN SANTOS",
      surname: "DELA CRUZ",
      firstName: "JUAN",
      middleNameOrInitial: "SANTOS",
    });
    expect(result.program).toBe("Master in Information Technology");
    expect(result.emailAddress).toBe("juan.delacruz@example.com");
  });

  it("tolerates uppercase/lowercase label variation", () => {
    const lower = [
      "registration noregistration no:: 12345678901234567890",
      "student nostudent no:: 123-45678A123-45678A",
      "namename:: DELA CRUZ, JUAN SANTOSDELA CRUZ, JUAN SANTOS",
      "programprogram :: Master in Information TechnologyMaster in Information Technology",
      "collegecollege :: Graduate SchoolGraduate School",
      "email addressemail address ::: juan.delacruz@example.comjuan.delacruz@example.com",
    ].join("\n");

    const result = parseEaristCorText(lower);

    expect(result.studentNumber).toBe("123-45678A");
    expect(result.registrationNumber).toBe("1234567890");
    expect(result.studentName?.raw).toBe("DELA CRUZ, JUAN SANTOS");
    expect(result.program).toBe("Master in Information Technology");
    expect(result.college).toBe("Graduate School");
    expect(result.emailAddress).toBe("juan.delacruz@example.com");
  });

  it("parses a middle initial conservatively", () => {
    const result = parseEaristCorText(
      "NameName:: REYES, ANA LREYES, ANA L\nProgramProgram :: MSITMSIT",
    );

    expect(result.studentName).toEqual({
      raw: "REYES, ANA L",
      surname: "REYES",
      firstName: "ANA",
      middleNameOrInitial: "L",
    });
  });

  it("parses a full middle name", () => {
    const result = parseEaristCorText(
      "NameName:: REYES, ANA MARIEREYES, ANA MARIE",
    );

    expect(result.studentName).toEqual({
      raw: "REYES, ANA MARIE",
      surname: "REYES",
      firstName: "ANA",
      middleNameOrInitial: "MARIE",
    });
  });

  it("returns partial suggestions when the email is missing", () => {
    const sample = [
      "Registration No :Registration No : 12345678901234567890",
      "Student NoStudent No:: 123-45678A123-45678A CollegeCollege :: Graduate SchoolGraduate School",
      "NameName:: DELA CRUZ, JUAN SANTOSDELA CRUZ, JUAN SANTOS ProgramProgram :: Master in Information TechnologyMaster in Information Technology",
    ].join("\n");

    const result = parseEaristCorText(sample);

    expect(result.studentNumber).toBe("123-45678A");
    expect(result.registrationNumber).toBe("1234567890");
    expect(result.studentName?.raw).toBe("DELA CRUZ, JUAN SANTOS");
    expect(result.emailAddress).toBeNull();
  });

  it("returns partial suggestions when the registration number is missing", () => {
    const sample = [
      "Student NoStudent No:: 123-45678A123-45678A CollegeCollege :: Graduate SchoolGraduate School",
      "NameName:: DELA CRUZ, JUAN SANTOSDELA CRUZ, JUAN SANTOS",
      "Email Address:Email Address::: juan.delacruz@example.comjuan.delacruz@example.com",
    ].join("\n");

    const result = parseEaristCorText(sample);

    expect(result.studentNumber).toBe("123-45678A");
    expect(result.registrationNumber).toBeNull();
    expect(result.studentName?.raw).toBe("DELA CRUZ, JUAN SANTOS");
    expect(result.emailAddress).toBe("juan.delacruz@example.com");
  });

  it("preserves raw and leaves components null for an ambiguous no-comma name", () => {
    const result = parseEaristCorText(
      "NameName:: JUAN DELA CRUZJUAN DELA CRUZ",
    );

    expect(result.studentName).toEqual({
      raw: "JUAN DELA CRUZ",
      surname: null,
      firstName: null,
      middleNameOrInitial: null,
    });
  });

  it("does not falsely capture assessed-fee, payment, receipt or footer values", () => {
    const boilerplate = [
      "A S S E S S E D F E E SA S S E S S E D F E E S",
      "Tuition (3 unit(s))Tuition (3 unit(s)) 1,500.001,500.00",
      "Total Assessment :Total Assessment : 1,500.001,500.00",
      "Outstanding Balance :Outstanding Balance : 0.000.00",
      "Payment/Validation Date :Payment/Validation Date : January 15, 2026January 15, 2026",
      "Official Receipt :Official Receipt : 98765439876543",
      "1. Full refund of tuition fee - Before the start of classes.1. Full refund of tuition fee - Before the start of classes.",
      "APPROVED BY :APPROVED BY :",
      "RegistrarRegistrar",
      "Powered by TCPDF (www.tcpdf.org)",
    ].join("\n");

    expect(parseEaristCorText(boilerplate)).toEqual(EMPTY);
  });

  it("collapses adjacent duplicated overprint runs to a single value", () => {
    const result = parseEaristCorText(
      "Student NoStudent No:: 123-45678A123-45678A\nRegistration No :Registration No : 12345678901234567890",
    );

    expect(result.studentNumber).toBe("123-45678A");
    expect(result.registrationNumber).toBe("1234567890");
  });

  it("still parses clean single-run text (no overprint duplication)", () => {
    const clean = [
      "Registration No : 1234567890",
      "Student No : 123-45678A",
      "Name : DELA CRUZ, JUAN SANTOS",
      "Program : Master in Information Technology",
      "College : Graduate School",
      "Email Address : juan.delacruz@example.com",
    ].join("\n");

    expect(parseEaristCorText(clean)).toEqual({
      studentNumber: "123-45678A",
      registrationNumber: "1234567890",
      studentName: {
        raw: "DELA CRUZ, JUAN SANTOS",
        surname: "DELA CRUZ",
        firstName: "JUAN",
        middleNameOrInitial: "SANTOS",
      },
      program: "Master in Information Technology",
      college: "Graduate School",
      emailAddress: "juan.delacruz@example.com",
    });
  });

  it("returns empty suggestions without throwing for empty/null-ish input", () => {
    expect(parseEaristCorText(null)).toEqual(EMPTY);
    expect(parseEaristCorText(undefined)).toEqual(EMPTY);
    expect(parseEaristCorText("   \n\t  ")).toEqual(EMPTY);
  });
});
