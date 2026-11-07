import express from "express";
import jwt from "jsonwebtoken";
import { createServer } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ actor: null as any, reads: vi.fn(), writes: vi.fn() }));
vi.mock("../../../src/config/database", () => ({ default: { user: {
  findUnique: vi.fn(async ({ where }: any) => where.id === "actor" ? fixture.actor : null),
} } }));
// Bounded test composition only: production exports the dormant instance.
vi.mock("../../../src/access/admission-student-authorization", async importOriginal => {
  const original = await importOriginal<typeof import("../../../src/access/admission-student-authorization")>();
  return { ...original, admissionStudentAuthorization: new original.AdmissionStudentAuthorization(true) };
});
vi.mock("../../../src/middlewares/upload.middleware", () => ({ secureUpload: () => ({ single: () => (_req: any, _res: any, next: any) => next() }) }));
vi.mock("../../../src/services/email.service", () => ({ EmailService: { sendTemplateEmail: vi.fn() } }));
vi.mock("../../../src/extraction/cor-extraction.service", () => ({ CorExtractionService: class {} }));
vi.mock("../../../src/repositories/admin-applicant.repository", () => ({ AdminApplicantRepository: class {
  effectivePassIds = async () => [];
  findApplicants = async () => { fixture.reads("applicants"); return []; };
  countApplicants = async () => 0;
  findStudentById = async () => { fixture.reads("applicant-detail"); return {
    id: "target", user: { firstName: "A", lastName: "B", email: "a@b.test" },
    createdAt: new Date(), examApplications: [], corUploads: [], admissionStatus: "APPLICANT",
  }; };
  findAdmissionContext = async () => { fixture.reads("admission-context"); return { id: "target", admissionStatus: "ENROLLED", studentNumber: "S1" }; };
  findWaiverContext = async () => { fixture.reads("waiver-context"); return { id: "target", bridgingWaiver: { id: "waiver", status: "PENDING" } }; };
  updateWaiverStatus = async (...args: any[]) => fixture.writes("waiver-alias", ...args);
  updateAlignmentStatus = async () => undefined;
  createAuditLog = async () => undefined;
} }));
vi.mock("../../../src/repositories/admin-student.repository", () => ({ AdminStudentRepository: class {
  findStudents = async () => { fixture.reads("students"); return []; };
  countStudents = async () => 0;
  findStudentDetailById = async () => { fixture.reads("student-detail"); return { id: "target" }; };
  findStudentUserId = async () => { fixture.reads("student-journey"); return "target-user"; };
  findStudentById = async () => ({ id: "target", compExamRecords: [] });
  updateCompExamStatus = async (...args: any[]) => { fixture.writes("comp-admin", ...args); return { status: "PASSED" }; };
} }));
vi.mock("../../../src/services/student-thesis-journey.service", () => ({ StudentThesisJourneyService: class {
  getJourney = async (id: string) => ({ userId: id, steps: [] });
} }));
vi.mock("../../../src/repositories/student.repository", () => ({ StudentRepository: class {
  getStudentById = async () => ({ id: "target" });
  updateComprehensiveExamStatus = async (...args: any[]) => { fixture.writes("comp-legacy", ...args); return { status: "PASSED" }; };
} }));
vi.mock("../../../src/repositories/waiver.repository", () => ({ WaiverRepository: class {
  getAdminWaiverQueue = async () => { fixture.reads("waivers"); return []; };
  validateWaiver = async (...args: any[]) => { fixture.writes("waiver-canonical", ...args); return {}; };
  rejectWaiver = async (...args: any[]) => { fixture.writes("waiver-canonical", ...args); return {}; };
} }));
vi.mock("../../../src/repositories/cor.repository", () => ({ CorRepository: class {
  getPendingUploads = async () => { fixture.reads("cor"); return []; };
  getCurrentUploadByStudentId = async () => ({ id: "upload", status: "PENDING" });
  getUploadById = async () => ({ id: "upload", status: "PENDING", studentId: "target", student: {
    id: "target", userId: "target-user", admissionStatus: "APPLICANT", user: { role: "APPLICANT" },
  } });
  checkPassedExam = async () => true;
  verifyAndPromote = async (...args: any[]) => { fixture.writes("cor-verify", ...args); return { corRecord: {} }; };
  rejectUpload = async (...args: any[]) => { fixture.writes("cor-reject", ...args); return {}; };
} }));

import applicants from "../../../src/routes/admin-applicant.routes";
import students from "../../../src/routes/admin-student.routes";
import cor from "../../../src/routes/cor.routes";
import waivers from "../../../src/routes/waiver.routes";
import student from "../../../src/routes/student.routes";
import { AdminApplicantService } from "../../../src/services/admin-applicant.service";
import { AdminStudentService } from "../../../src/services/admin-student.service";
import { CorService } from "../../../src/services/cor.service";
import { WaiverService } from "../../../src/services/waiver.service";
import { StudentService } from "../../../src/services/student.service";

const verify = { studentNumber: "S1", surname: "B", firstName: "A", email: "a@b.test", programId: "program" };
const endpoints = [
  ["GET", "/admin/applicants", "applicants.view"],
  ["GET", "/admin/applicants/target", "applicants.view"],
  ["PUT", "/admin/applicants/target/waiver/validate", "waivers.manage"],
  ["PUT", "/admin/applicants/target/waiver/reject", "waivers.manage", { adminNotes: "Rejected" }],
  ["PUT", "/admin/applicants/target/cor/verify", "cor.verify", verify],
  ["PUT", "/admin/applicants/target/cor/reject", "cor.verify", { reason: "Rejected" }],
  ["PUT", "/admin/applicants/target/promote", "cor.verify"],
  ["GET", "/waivers", "waivers.view"],
  ["PUT", "/waivers/waiver/validate", "waivers.manage"],
  ["PUT", "/waivers/waiver/reject", "waivers.manage", { notes: "Rejected" }],
  ["GET", "/cor/pending", "cor.view"],
  ["POST", "/cor/verify/upload", "cor.verify", verify],
  ["POST", "/cor/reject/upload", "cor.verify", { reason: "Rejected" }],
  ["GET", "/admin/students", "students.view"],
  ["GET", "/admin/students/target", "students.view"],
  ["GET", "/admin/students/target/journey", "students.view"],
  ["PUT", "/admin/students/target/comprehensive-exam", "students.comprehensive_exam.manage", { status: "PASSED" }],
  ["POST", "/student/target/comprehensive-exam", "students.comprehensive_exam.manage", { status: "PASSED" }],
] as const;
function actor(keys: readonly string[] = [], changes = {}) {
  fixture.actor = { id: "actor", email: "actor@example.test", role: "ADMIN", isActive: true,
    mustChangePassword: false, panelist: null, administratorAccess: { level: "RESTRICTED" },
    capabilityGrants: keys.map(capabilityKey => ({ capabilityKey })), ...changes };
}
let server: ReturnType<typeof createServer>;
let base: string;
beforeEach(async () => {
  vi.clearAllMocks(); vi.stubEnv("JWT_SECRET", "faculty-5-synthetic-secret"); actor();
  const app = express(); app.use(express.json());
  app.use("/api/admin/applicants", applicants); app.use("/api/admin/students", students);
  app.use("/api/cor", cor); app.use("/api/waivers", waivers); app.use("/api/student", student);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
});
afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  vi.unstubAllEnvs();
});
function request(method: string, path: string, body?: unknown, claim = "ADMIN") {
  return fetch(base + path, { method, headers: { "Content-Type": "application/json",
    Authorization: `Bearer ${jwt.sign({ userId: "actor", role: claim }, process.env.JWT_SECRET!)}` },
    ...(body ? { body: JSON.stringify(body) } : {}) });
}

describe("FACULTY-5 actual HTTP middleware/controllers/services with synthetic repositories", () => {
  it.each(endpoints)("%s %s allows Full and its exact key; denies without it", async (method, path, key, ...rest) => {
    const body = rest[0];
    actor([], { administratorAccess: { level: "FULL" } });
    expect((await request(method, path, body)).status).toBe(200);
    actor([key]); expect((await request(method, path, body)).status).toBe(200);
    vi.clearAllMocks(); actor(); expect((await request(method, path, body)).status).toBe(403);
    expect(fixture.reads).not.toHaveBeenCalled(); expect(fixture.writes).not.toHaveBeenCalled();
  });
  it.each(["cor.view", "cor.verify", "waivers.view", "waivers.manage"])("%s cannot read either Applicant registry endpoint", async key => {
    actor([key]);
    for (const path of ["/admin/applicants", "/admin/applicants/target"]) expect((await request("GET", path)).status).toBe(403);
    expect(fixture.reads).not.toHaveBeenCalled();
  });
  it.each(["waivers.view", "cor.view", "students.view"])("%s never authorizes its mutation aliases", async key => {
    actor([key]);
    const prefix = key.split(".")[0];
    const writes = endpoints.filter(([method, , capability]) => method !== "GET" && capability.startsWith(prefix));
    expect(writes.length).toBeGreaterThan(0);
    for (const [method, path, , ...rest] of writes) expect((await request(method, path, rest[0])).status).toBe(403);
    expect(fixture.writes).not.toHaveBeenCalled();
  });
  it.each([
    { administratorAccess: null }, { administratorAccess: { level: "INVALID" } },
    { capabilityGrants: [{ capabilityKey: "essay.evaluate" }] }, { capabilityGrants: null },
    { role: "STUDENT" }, { role: "FACULTY", panelist: { isActive: true } }, { isActive: false },
  ])("denies every endpoint under invalid current authority %j despite ADMIN token", async extra => {
    actor([], { administratorAccess: { level: "FULL" }, ...extra });
    for (const [method, path, , ...rest] of endpoints) expect((await request(method, path, rest[0])).status).toBe(403);
    expect(fixture.writes).not.toHaveBeenCalled(); expect(fixture.reads).not.toHaveBeenCalled();
  });
  it("FACULTY-2 stops forced-password accounts before every normal administrative route", async () => {
    actor([], { administratorAccess: { level: "FULL" }, mustChangePassword: true });
    for (const [method, path, , ...rest] of endpoints) {
      const response = await request(method, path, rest[0]); expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "PASSWORD_CHANGE_REQUIRED" });
    }
    expect(fixture.writes).not.toHaveBeenCalled();
  });
  it("revokes on the next request; ignores body and stale role/capability claims", async () => {
    actor(["students.comprehensive_exam.manage"]);
    expect((await request("GET", "/admin/students", undefined, "CUSTOM")).status).toBe(200);
    fixture.actor.capabilityGrants = [];
    const response = await request("POST", "/student/target/comprehensive-exam", {
      status: "PASSED", actorId: "full", role: "ADMIN", capabilityKeys: ["students.comprehensive_exam.manage"],
    });
    expect(response.status).toBe(403); expect(fixture.writes).not.toHaveBeenCalled();
  });
  it("COR/waiver mutation context never loads the full Applicant detail", async () => {
    actor(["cor.verify", "waivers.manage"]);
    for (const [method, path, key, ...rest] of endpoints.filter(([, , key]) => ["cor.verify", "waivers.manage"].includes(key))) {
      expect((await request(method, path, rest[0])).status).toBe(200);
    }
    expect(fixture.reads.mock.calls.some(([kind]) => kind === "applicant-detail" || kind === "applicants")).toBe(false);
    expect(fixture.reads).toHaveBeenCalledWith("admission-context"); expect(fixture.reads).toHaveBeenCalledWith("waiver-context");
  });
  it("Admin capabilities cannot enter Applicant upload or Student self-service journey", async () => {
    actor([], { administratorAccess: { level: "FULL" } });
    expect((await request("POST", "/cor/upload", {})).status).toBe(403);
    expect((await request("GET", "/cor/my-upload")).status).toBe(403);
    expect((await request("GET", "/student/journey")).status).toBe(403);
  });
});

describe("FACULTY-5 direct business entry points cannot bypass the route guard", () => {
  const calls = [
    () => new AdminApplicantService().listApplicants({}, "actor"),
    () => new AdminApplicantService().getApplicantDetail("target", "actor"),
    () => new AdminApplicantService().validateWaiver("target", "actor"),
    () => new AdminApplicantService().rejectWaiver("target", "actor", { adminNotes: "No" }),
    () => new AdminApplicantService().verifyCor("target", "actor", verify),
    () => new AdminApplicantService().rejectCor("target", "actor", { reason: "No" }),
    () => new AdminApplicantService().promoteToStudent("target", "actor"),
    () => new AdminStudentService().listStudents({}, "actor"),
    () => new AdminStudentService().getStudentDetail("target", "actor"),
    () => new AdminStudentService().getStudentJourney("target", "actor"),
    () => new AdminStudentService().updateCompExamStatus("target", "PASSED", "actor"),
    () => new StudentService().updateCompExam("target", { status: "PASSED" }, "actor"),
    () => new CorService().getPendingUploads("actor"),
    () => new CorService().findPendingUploadIdForStudent("target", "actor"),
    () => new CorService().verifyCor("upload", "actor", verify),
    () => new CorService().rejectCor("upload", "actor", "No"),
    () => new WaiverService().getAdminQueue("actor"),
    () => new WaiverService().validateWaiver("waiver", "actor"),
    () => new WaiverService().rejectWaiver("waiver", "actor", "No"),
  ];
  it.each(calls.map((call, index) => [index, call] as const))("denies direct entry %s before reading or writing target data", async (_index, call) => {
    actor(["exam.records.view"]);
    await expect(call()).rejects.toMatchObject({ statusCode: 403 });
    expect(fixture.reads).not.toHaveBeenCalled(); expect(fixture.writes).not.toHaveBeenCalled();
  });
});
