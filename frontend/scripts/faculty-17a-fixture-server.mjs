// Synthetic browser contract only: no application backend/database or activation switch.
import { createServer } from "node:http";
import next from "next";

process.env.AUTH_SECRET = "faculty-17a-synthetic-browser-only";
process.env.AUTH_TRUST_HOST = "true";
process.env.BACKEND_API_URL = "http://127.0.0.1:4318";
process.env.NEXT_PUBLIC_BACKEND_API_URL = "http://127.0.0.1:4318";
const identities = {
  faculty: { id: "shared-faculty", role: "FACULTY", password: "Faculty-17A-Own-Password" },
  admin: { id: "shared-admin", role: "ADMIN", password: "Admin-17A-Different-Password" },
};
const email = "person@gmail.com";
const calls = [], logins = [];
const fixture = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:4317");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  const path = new URL(req.url, "http://127.0.0.1:4318").pathname;
  const json = (value, status = 200) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(value)); };
  let body = {};
  if (req.method === "POST") {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    try { body = JSON.parse(Buffer.concat(chunks).toString() || "{}"); }
    catch { return json({ error: "Invalid synthetic body" }, 400); }
  }
  if (path === "/__fixture") return json({ calls, logins });
  if (path === "/api/auth/login") {
    const identity = identities[body.role];
    const accepted = identity && String(body.email).trim().toLowerCase() === email && body.password === identity.password;
    logins.push({ role: body.role, email: body.email, accepted: Boolean(accepted), userId: accepted ? identity.id : null });
    if (!accepted) return json({ error: "Invalid login credentials!" }, 401);
    return json({ token: `faculty17a-${identity.id}`, user: { id: identity.id, email, role: identity.role, mustChangePassword: false } });
  }
  const id = String(req.headers.authorization ?? "").replace("Bearer faculty17a-", "");
  const identity = Object.values(identities).find(value => value.id === id);
  calls.push({ path, userId: identity?.id ?? null });
  if (!identity) return json({ error: "Authentication required" }, 401);
  if (path === "/api/auth/me") return json({
    user: { id, email, role: identity.role, mustChangePassword: false },
    configuredAccess: { status: "RESOLVED", administratorLevel: identity.role === "ADMIN" ? "RESTRICTED" : null,
      capabilities: identity.role === "ADMIN" ? ["students.view"] : ["essay.evaluate"] },
    directAccessEnforcementEnabled: false,
    facultyWork: identity.role === "ADMIN" ? null : {
      essayEvaluations: { relevant: true },
      myAdvisees: { relevant: false, activeAdviseeCount: 0, addressedRequestCount: 0, issuedCertificationCount: 0 },
      myDefenses: { relevant: false, assignmentCount: 0 },
    },
  });
  if (path.includes("notifications")) return json([]);
  if (path === "/api/memos") return json([]);
  return json({ error: "Unavailable in synthetic login fixture" }, 503);
});
await new Promise(resolve => fixture.listen(4318, "127.0.0.1", resolve));
const app = next({ dev: true, hostname: "localhost", port: 4317 });
await app.prepare();
createServer(app.getRequestHandler()).listen(4317, "127.0.0.1", () => console.log("Synthetic FACULTY-17A preview ready at http://localhost:4317"));
