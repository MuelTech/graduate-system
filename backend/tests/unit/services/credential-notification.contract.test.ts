import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

/**
 * COR-7: source-contract guard for the Student credential notification.
 *
 * Static assertions locking the truthfulness of the credential copy across
 * the canonical email template registry, COR service call, seed loader,
 * and public FAQ.
 */
describe("COR-7 credential notification contract", () => {
  it("registers only safe credential_dispatch variables in the canonical registry", () => {
    const registry = readFileSync("src/config/email-templates.registry.ts", "utf8");
    const start = registry.indexOf('templateKey: "credential_dispatch"');
    expect(start).toBeGreaterThan(-1);
    const end = registry.indexOf("templateKey:", start + 10);
    const block = registry.slice(start, end === -1 ? undefined : end);

    expect(block).toContain("recipient_name");
    expect(block).toContain("student_number");
    expect(block).toContain("portal_link");
    expect(block).not.toContain("default_password");
  });

  it("CorService sends no password-like variable for credential_dispatch", () => {
    const corService = readFileSync("src/services/cor.service.ts", "utf8");
    const marker = corService.indexOf('"credential_dispatch"');
    expect(marker).toBeGreaterThan(-1);
    const block = corService.slice(marker, marker + 400);

    expect(block).toContain("student_name");
    expect(block).toContain("student_number: studentNumber");
    expect(block).toContain("portal_link");
    expect(block).not.toMatch(/default_password/i);
    expect(block).not.toMatch(/passwordHash/i);
    expect(block).not.toMatch(/lastName\.toUpperCase/i);
  });

  it("canonical registry and seed define a truthful credential_dispatch template", () => {
    const seed = readFileSync("prisma/seed.ts", "utf8");
    expect(seed).toContain("EMAIL_TEMPLATE_REGISTRY");

    const registry = readFileSync("src/config/email-templates.registry.ts", "utf8");
    const start = registry.indexOf('templateKey: "credential_dispatch"');
    const end = registry.indexOf("templateKey:", start + 10);
    const block = registry.slice(start, end === -1 ? undefined : end);

    expect(block).toContain("{{recipient_name}}");
    expect(block).toContain("{{student_number}}");
    expect(block).toMatch(/existing account password/i);
    expect(block).not.toMatch(/\{\{default_password\}\}/i);
    expect(block).not.toMatch(/default password/i);
    expect(block).not.toMatch(/initial password/i);
    expect(block).not.toMatch(/last name in all caps/i);
    expect(block).not.toMatch(/date of birth/i);
  });

  it("public FAQ does not claim an initial/DOB/default Student password", () => {
    const faq = readFileSync(
      "../frontend/src/app/(public)/faq/page.tsx",
      "utf8",
    );
    const q = faq.indexOf("What happens after my COR is verified?");
    expect(q).toBeGreaterThan(-1);
    const answer = faq.slice(q, q + 600);

    expect(answer).not.toMatch(/initial password/i);
    expect(answer).not.toMatch(/date of birth/i);
    expect(answer).not.toMatch(/default password/i);
    expect(answer).toMatch(/existing account password/i);
  });
});
