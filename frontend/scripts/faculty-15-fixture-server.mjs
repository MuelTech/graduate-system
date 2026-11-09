// FACULTY-15 synthetic loopback fixture only. No production backend/database or
// activation switch is imported or modified. Start from frontend for Playwright.
import { createServer } from "node:http";
import next from "next";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import compileCatalog from "./capability-catalog-loader.cjs";
const catalog = {};
vm.runInNewContext(
  compileCatalog(
    readFileSync(
      new URL(
        "../../backend/src/access/capability-catalog.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
  { exports: catalog },
);
const { FULL_ADMINISTRATOR_CAPABILITIES, expandCapabilityPrerequisites } =
  catalog;
process.env.AUTH_SECRET = "faculty-15-synthetic-browser-fixture-only";
process.env.AUTH_TRUST_HOST = "true";
process.env.BACKEND_API_URL = "http://127.0.0.1:4316";
process.env.NEXT_PUBLIC_BACKEND_API_URL = "http://127.0.0.1:4316";
const account = (id = "target", level = "RESTRICTED", capabilityKeys = []) => ({
  id,
  email: `${id}@example.test`,
  firstName: id === "actor" ? "Alexandra Catherine" : "Taylor",
  lastName: "Synthetic Administrator With A Long Family Name",
  role: "ADMIN",
  isActive: true,
  mustChangePassword: false,
  level,
  capabilityKeys,
  configuredAccess: {
    status: "RESOLVED",
    capabilities:
      level === "FULL"
        ? FULL_ADMINISTRATOR_CAPABILITIES
        : expandCapabilityPrerequisites(capabilityKeys),
  },
});
const defaults = () => ({
  level: "FULL",
  keys: [],
  status: "RESOLVED",
  role: "ADMIN",
  accessFailure: 0,
  accessDelay: 0,
  listFailure: 0,
  patchFailure: 0,
  createFailure: 0,
  listMode: "normal",
  lastFullConflict: true,
  calls: [],
  writes: [],
  rows: [
    account("actor", "FULL"),
    account(),
    {
      ...account("unmapped"),
      level: null,
      configuredAccess: { status: "MISSING_ADMIN_LEVEL", capabilities: [] },
    },
  ],
});
let state = defaults();
const temporaryPassword = "Synthetic-Administrator-15-One-Time-Only";
const fixture = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:4315");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  );
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  const url = new URL(req.url, "http://127.0.0.1:4316"),
    path = url.pathname;
  const json = (value, status = 200) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(value));
  };
  let body = {};
  if (["POST", "PATCH", "PUT"].includes(req.method)) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    try {
      body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
    } catch {
      return json({ error: "Invalid synthetic body" }, 400);
    }
  }
  if (path === "/__fixture") {
    if (req.method === "POST") {
      if (body.reset) state = defaults();
      Object.assign(state, body);
    }
    return json(state);
  }
  const actor =
    String(req.headers.authorization || "").replace("Bearer admin15-", "") ||
    "actor";
  state.calls.push({ path, search: url.search, method: req.method, actor });
  if (path === "/api/auth/me") {
    if (state.accessDelay)
      await new Promise((resolve) => setTimeout(resolve, state.accessDelay));
    if (state.accessFailure)
      return json({ error: "Synthetic account failure" }, state.accessFailure);
    return json({
      user: {
        id: actor,
        email: `${actor}@example.test`,
        firstName: "Alex",
        lastName: "Synthetic",
        role: state.role,
        mustChangePassword: false,
      },
      configuredAccess: {
        status: state.status,
        administratorLevel: state.level,
        capabilities:
          state.level === "FULL"
            ? FULL_ADMINISTRATOR_CAPABILITIES
            : expandCapabilityPrerequisites(state.keys),
      },
      directAccessEnforcementEnabled: false,
      facultyWork: null,
    });
  }
  if (path.startsWith("/api/admin/administrators")) {
    if (state.level !== "FULL" || state.status !== "RESOLVED")
      return json({ error: "Full Administrator authority is required." }, 403);
    if (req.method === "GET") {
      if (state.listFailure)
        return json({ error: "Synthetic unavailable" }, state.listFailure);
      if (path === "/api/admin/administrators") {
        const page = Number(url.searchParams.get("page") || 1);
        return json({
          page,
          pageSize: 25,
          accounts:
            state.listMode === "pages"
              ? Array.from({ length: page === 1 ? 25 : 1 }, (_, i) =>
                  account(`page-${page}-${i}`),
                )
              : state.rows,
        });
      }
      const row = state.rows.find(
        (row) => row.id === decodeURIComponent(path.split("/").at(-1)),
      );
      return row ? json(row) : json({ error: "No account" }, 404);
    }
    state.writes.push({ path, method: req.method, body });
    if (req.method === "POST") {
      if (state.createFailure)
        return json({ error: "Synthetic create failure" }, state.createFailure);
      if (
        Object.keys(body).sort().join(",") !==
        "capabilityKeys,email,firstName,lastName,level"
      )
        return json({ error: "Unexpected fields" }, 400);
      const created = {
        ...account("created", body.level, body.capabilityKeys),
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
        mustChangePassword: true,
      };
      state.rows.push(created);
      return json({ account: created, temporaryPassword }, 201);
    }
    if (req.method === "PATCH") {
      if (state.patchFailure)
        return json({ error: "Synthetic patch failure" }, state.patchFailure);
      const id = decodeURIComponent(path.split("/").at(-1));
      const row = state.rows.find((row) => row.id === id);
      if (!row) return json({ error: "No account" }, 404);
      if (
        state.lastFullConflict &&
        row.level === "FULL" &&
        (body.level === "RESTRICTED" || body.isActive === false)
      )
        return json(
          { error: "At least one active Full Administrator must remain." },
          409,
        );
      Object.assign(row, body);
      row.configuredAccess = {
        status: row.isActive ? "RESOLVED" : "INACTIVE",
        capabilities:
          row.level === "FULL"
            ? FULL_ADMINISTRATOR_CAPABILITIES
            : expandCapabilityPrerequisites(row.capabilityKeys),
      };
      if (id === actor) {
        state.level = row.level;
        state.keys = row.capabilityKeys;
      }
      return json(row);
    }
  }
  if (path === "/api/admin/dashboard")
    return json({
      kpis: {
        enrolledStudents: 1,
        defenseApplicationsToReview: 0,
        defensesReadyForScheduling: 0,
        corSubmissionsToReview: 0,
      },
      needsAttention: {
        defenseApplications: 0,
        corSubmissions: 0,
        defensesReadyForScheduling: 0,
        bridgingWaivers: 0,
        adviserRequestsForDeanReview: 0,
      },
      enrollment: { total: 1, byDegreeLevel: [], topPrograms: [] },
      thesisPipeline: [],
      upcomingDefenses: [],
      workflowMonitoring: {
        defensesAwaitingConclusion: 0,
        rapReportsAwaitingSignatures: 0,
      },
      recentActivity: [],
    });
  if (path === "/api/programs") return json({ graduatePrograms: [] });
  if (path === "/api/admin/students") return json({ students: [], total: 0 });
  if (path === "/api/admin/applicants")
    return json({ applicants: [], total: 0 });
  if (path === "/api/settings")
    return json([{ settingKey: "ACADEMIC_YEAR", settingValue: "2026-2027" }]);
  if (path === "/api/settings/audit-logs") return json({ logs: [], total: 0 });
  if (path === "/api/admin/email-logs/logs")
    return json({ data: [], meta: { totalPages: 0 } });
  if (path === "/api/thesis/defense/approved-applications")
    return json({ data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });
  if (path === "/api/exam-engine/admin/questions") return json([]);
  if (path === "/api/admin/faculty/management-context")
    return json({ canManage: true });
  return json([]);
});
await new Promise((resolve) => fixture.listen(4316, "127.0.0.1", resolve));
const app = next({ dev: true, hostname: "localhost", port: 4315 });
await app.prepare();
const frontend = createServer(app.getRequestHandler());
frontend.listen(4315, "127.0.0.1", () =>
  console.log("Synthetic Faculty-15 preview ready at http://localhost:4315"),
);
async function close() {
  frontend.close();
  fixture.close();
  await app.close();
  process.exit(0);
}
process.on("SIGINT", close);
process.on("SIGTERM", close);
