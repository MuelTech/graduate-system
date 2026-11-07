import express from "express";
import jwt from "jsonwebtoken";
import { createServer } from "node:http";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ actor: null as any, list: vi.fn(async () => []) }));
vi.mock("../../../src/config/database", () => ({ default: { user: { findUnique: async () => fixture.actor } } }));
vi.mock("../../../src/repositories/admin-student.repository", () => ({ AdminStudentRepository: class {
  findStudents = fixture.list;
  countStudents = async () => 0;
} }));
vi.mock("../../../src/services/student-thesis-journey.service", () => ({ StudentThesisJourneyService: class {} }));
import router from "../../../src/routes/admin-student.routes";
import { ADMISSION_STUDENT_CAPABILITY_ENFORCEMENT_ENABLED } from "../../../src/access/admission-student-authorization";
let server: ReturnType<typeof createServer>;
let url: string;
beforeEach(async () => {
  vi.clearAllMocks(); vi.stubEnv("JWT_SECRET", "faculty-5-dormant-synthetic");
  fixture.actor = { id: "actor", role: "ADMIN", email: "actor@example.test", isActive: true,
    mustChangePassword: false, panelist: null, administratorAccess: null, capabilityGrants: [] };
  const app = express(); app.use("/api/admin/students", router); server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/admin/students`;
});
afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); vi.unstubAllEnvs();
});
function request() {
  return fetch(url, { headers: { Authorization: `Bearer ${jwt.sign({ userId: "actor", role: "ADMIN" }, process.env.JWT_SECRET!)}` } });
}
it("production composition preserves legacy current ADMIN access without a Full mapping or activation", async () => {
  vi.stubEnv("ADMISSION_STUDENT_CAPABILITY_ENFORCEMENT_ENABLED", "true");
  vi.stubEnv("DIRECT_ACCESS_ENFORCEMENT_ENABLED", "true");
  expect(ADMISSION_STUDENT_CAPABILITY_ENFORCEMENT_ENABLED).toBe(false);
  expect((await request()).status).toBe(200); expect(fixture.list).toHaveBeenCalledTimes(1);
  expect(fixture.actor.administratorAccess).toBeNull(); expect(fixture.actor.capabilityGrants).toEqual([]);
});
it("dormant composition retains current-account role and credential denials", async () => {
  fixture.actor.role = "STUDENT"; expect((await request()).status).toBe(403);
  fixture.actor.role = "ADMIN"; fixture.actor.mustChangePassword = true;
  const response = await request(); expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({ code: "PASSWORD_CHANGE_REQUIRED" });
  expect(fixture.list).not.toHaveBeenCalled();
});
