// Isolated synthetic preview only. No real backend, database, credentials or activation.
// Run from frontend: node scripts/faculty-11-fixture-server.mjs
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import next from "next";
import compileCatalog from "./capability-catalog-loader.cjs";

const catalog = {};
vm.runInNewContext(
  compileCatalog(
    readFileSync(
      new URL("../../backend/src/access/capability-catalog.ts", import.meta.url),
      "utf8",
    ),
  ),
  { exports: catalog },
);
const { FULL_ADMINISTRATOR_CAPABILITIES } = catalog;

process.env.AUTH_SECRET = "faculty-11-synthetic-browser-fixture-only";
process.env.AUTH_TRUST_HOST = "true";
process.env.BACKEND_API_URL = "http://127.0.0.1:4312";
process.env.NEXT_PUBLIC_BACKEND_API_URL = "http://127.0.0.1:4312";

const fixture = createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:4311");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") { res.end(); return; }
  if (req.url === "/api/auth/me" && req.headers.authorization === "Bearer faculty-11-synthetic") {
    res.end(JSON.stringify({
      user: { id: "synthetic-admin", email: "admin@example.test", role: "ADMIN", mustChangePassword: false },
      configuredAccess: {
        status: "RESOLVED",
        administratorLevel: "FULL",
        capabilities: FULL_ADMINISTRATOR_CAPABILITIES,
      },
      directAccessEnforcementEnabled: false,
      facultyWork: null,
    }));
  } else { res.statusCode = 404; res.end(JSON.stringify({ error: "Synthetic preview only." })); }
});
await new Promise(resolve => fixture.listen(4312, "127.0.0.1", resolve));
const app = next({ dev: true, hostname: "localhost", port: 4311 });
await app.prepare();
const frontend = createServer(app.getRequestHandler());
frontend.listen(4311, "127.0.0.1", () => console.log("Synthetic Faculty preview ready at http://localhost:4311"));
async function close() { frontend.close(); fixture.close(); await app.close(); process.exit(0); }
process.on("SIGINT", close); process.on("SIGTERM", close);
