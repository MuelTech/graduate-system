// Loopback-only synthetic QA. Does not import the backend, touch a database or
// activate any production gate. Run from frontend, then e2e/faculty-portal.spec.ts.
import { createServer } from "node:http";
import next from "next";

process.env.AUTH_SECRET = "faculty-14-synthetic-browser-fixture-only";
process.env.AUTH_TRUST_HOST = "true";
process.env.BACKEND_API_URL = "http://127.0.0.1:4314";
process.env.NEXT_PUBLIC_BACKEND_API_URL = "http://127.0.0.1:4314";
const allWork = {
  essayEvaluations: { relevant: true },
  myAdvisees: {
    relevant: true,
    activeAdviseeCount: 1,
    addressedRequestCount: 1,
    issuedCertificationCount: 1,
  },
  myDefenses: { relevant: true, assignmentCount: 2 },
};
const defaults = () => ({
  work: structuredClone(allWork),
  accessFailure: 0,
  accessDelay: 0,
  dashboardFailure: 0,
  dashboardData: null,
  notificationsFailure: 0,
  notificationsData: null,
  queueFailure: 0,
  detailFailure: 0,
  gradeFailure: 0,
  gradeDelay: 0,
  queueMode: "scan",
  responseState: "SUBMITTED",
  stimulusType: "IMAGE",
  external: false,
  calls: [],
  grades: [],
  completed: [],
});
let state = defaults();
const applicant = {
  firstName: "Alexandra Catherine",
  lastName: "Synthetic Applicant With A Long Family Name",
  pinnacleApplicantId: "SYNTHETIC-APP-001",
};
const item = (id) => ({
  applicationId: id,
  applicant,
  programName:
    "Master of Arts in Education — Educational Management and Research",
  examDate: "2026-11-09T00:00:00Z",
  finalizedAt: "2026-11-09T01:30:00Z",
  status: "PENDING",
});
const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=",
  "base64",
);
const fixture = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:4313");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, OPTIONS",
  );
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  const url = new URL(req.url, "http://127.0.0.1:4314");
  const json = (value, status = 200) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(value));
  };
  let body = {};
  if (req.method === "POST") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    try {
      body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
    } catch {
      return json({ error: "Invalid synthetic request" }, 400);
    }
  }
  if (url.pathname === "/__fixture") {
    if (req.method === "POST") {
      if (body.reset) state = defaults();
      Object.assign(state, body);
    }
    return json(state);
  }
  const path = url.pathname;
  state.calls.push({ path, search: url.search, method: req.method });
  if (path === "/api/auth/login") {
    if (
      body.role !== "faculty" ||
      body.password !== "fixture-password" ||
      !["future@example.test", "legacy@example.test"].includes(body.email)
    )
      return json({ error: "Invalid synthetic credentials" }, 403);
    const identity = body.email.startsWith("legacy") ? "legacy" : "future";
    return json({
      token: `faculty14-${identity}`,
      user: {
        id: identity,
        email: body.email,
        role: identity === "legacy" ? "PANELIST" : "FACULTY",
        mustChangePassword: false,
      },
    });
  }
  const identity =
    req.headers.authorization === "Bearer faculty14-legacy"
      ? "legacy"
      : "future";
  if (path === "/api/auth/me") {
    if (state.accessDelay)
      await new Promise((resolve) => setTimeout(resolve, state.accessDelay));
    if (state.accessFailure)
      return json(
        { error: "Synthetic unavailable account" },
        state.accessFailure,
      );
    return json({
      user: {
        id: identity,
        email: `${identity}@example.test`,
        role: identity === "legacy" ? "PANELIST" : "FACULTY",
        mustChangePassword: false,
      },
      configuredAccess: {
        status: "RESOLVED",
        administratorLevel: null,
        capabilities: state.work.essayEvaluations.relevant
          ? ["essay.evaluate"]
          : [],
      },
      directAccessEnforcementEnabled: false,
      facultyWork: state.work,
    });
  }
  if (path === "/api/notifications") {
    if (state.notificationsFailure)
      return json(
        { error: "Synthetic unavailable notifications" },
        state.notificationsFailure,
      );
    if (state.notificationsData) {
      return json(
        Array.isArray(state.notificationsData)
          ? state.notificationsData
          : (state.notificationsData[identity] ?? []),
      );
    }
    return json([]);
  }
  if (path === "/api/panelists/me")
    return json({
      isExternal: state.external,
      specialization: `Research — ${identity}`,
      officeAffiliation: "Synthetic Graduate School",
      highestEducationalAttainment: "Doctorate",
    });
  if (path === "/api/thesis/defense/panelist/dashboard") {
    if (state.dashboardFailure)
      return json(
        { error: "Synthetic unavailable dashboard" },
        state.dashboardFailure,
      );
    if (state.dashboardData) {
      return json(state.dashboardData[identity] ?? state.dashboardData);
    }
    return json({
      kpis: { upcomingDefenses: 0, pendingTasks: 0 },
      needsAttention: [],
      activeDefenses: [],
      upcomingDefenses: [],
      waitingOnOthers: [],
    });
  }
  if (path === "/api/thesis/adviser/workspace")
    return json({ activeAdvisees: [], incomingRequests: [], reviewTasks: [] });
  if (
    path.includes("adviser-certifications") ||
    path.includes("adviser-requests")
  )
    return json([]);
  if (path === "/api/exam/essay-evaluations") {
    if (state.queueFailure) {
      if (state.revokeOnQueue) state.work.essayEvaluations.relevant = false;
      return json({ error: "Synthetic unavailable queue" }, state.queueFailure);
    }
    const cursor = url.searchParams.get("cursor");
    if (state.queueMode === "continuation") {
      if (!cursor)
        return json({
          items: [item(`${identity}-first`)],
          nextCursor: "continuation-a",
        });
      if (cursor === "continuation-a")
        return json({ items: [], nextCursor: "continuation-b" });
      return json({ items: [item(`${identity}-second`)], nextCursor: null });
    }
    if (state.queueMode === "empty" || state.completed.length)
      return json({ items: [], nextCursor: null });
    if (state.queueMode === "repeat")
      return json({ items: [], nextCursor: cursor ?? "scan-a" });
    if (state.queueMode === "scan" && !cursor)
      return json({ items: [], nextCursor: "scan-a" });
    if (state.queueMode === "scan" && cursor === "scan-a")
      return json({ items: [], nextCursor: "scan-b" });
    return json({ items: [item(`${identity}-application`)], nextCursor: null });
  }
  if (path.startsWith("/api/exam/essay-evaluations/")) {
    const id = path.split("/")[4];
    if (path.endsWith("/content")) {
      if (state.mediaFailure)
        return json(
          { error: "Synthetic unavailable image" },
          state.mediaFailure,
        );
      res.writeHead(200, { "Content-Type": "image/png" });
      res.end(image);
      return;
    }
    if (req.method === "POST" && path.endsWith("/grade")) {
      state.grades.push(body);
      if (state.gradeDelay)
        await new Promise((resolve) => setTimeout(resolve, state.gradeDelay));
      if (state.gradeFailure)
        return json({ error: "Synthetic grading failure" }, state.gradeFailure);
      state.completed.push(id);
      return json({
        applicationId: id,
        status: "COMPLETED",
        essayScore: body.essayScore,
        maximumScore: 10,
        evaluator: {
          id: identity,
          firstName: "Synthetic",
          lastName: "Faculty",
        },
        evaluatedAt: new Date().toISOString(),
      });
    }
    if (state.detailFailure || state.completed.includes(id))
      return json(
        { error: "Synthetic record unavailable" },
        state.detailFailure || 409,
      );
    return json({
      ...item(id),
      questionId: "synthetic-question",
      question: {
        questionText: "Explain the research method and its limitations.",
        questionTextEmphasis: [{ start: 12, end: 27, style: "BOLD" }],
        stimulusType: state.stimulusType,
        stimulusMediaId: "synthetic-image",
        structuredStimulus: {
          type: "MATRIX",
          rows: [
            [1, 2],
            [3, 4],
          ],
        },
      },
      responseState: state.responseState,
      responseText:
        state.responseState === "MISSING"
          ? null
          : state.responseState === "BLANK"
            ? ""
            : "  Exact response whitespace.\n\n" +
              "A long synthetic essay paragraph about the research method and its limitations. ".repeat(
                50,
              ),
      maximumScore: 10,
    });
  }
  return json([]);
});
await new Promise((resolve) => fixture.listen(4314, "127.0.0.1", resolve));
const app = next({ dev: true, hostname: "localhost", port: 4313 });
await app.prepare();
const frontend = createServer(app.getRequestHandler());
frontend.listen(4313, "127.0.0.1", () =>
  console.log("Synthetic Faculty-14 preview ready at http://localhost:4313"),
);
async function close() {
  frontend.close();
  fixture.close();
  await app.close();
  process.exit(0);
}
process.on("SIGINT", close);
process.on("SIGTERM", close);
