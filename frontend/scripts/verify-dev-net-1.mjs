// DEV-NET-1 — local/LAN/production backend-origin resolution.
//
// Run: node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/verify-dev-net-1.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildDevelopmentBackendUrl,
  normalizeBackendBaseUrl,
} from "../src/lib/backend-origin.shared.ts";
import { resolveClientBackendBaseUrl } from "../src/lib/backend-origin.client.ts";
import { resolveServerBackendBaseUrl } from "../src/lib/backend-origin.server.ts";

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

const API_CLIENT = "src/lib/api.client.ts";
const API_SERVER = "src/lib/api.server.ts";
const AUTH = "src/auth.ts";
const SOCKET = "src/lib/realtime/defense-socket.ts";
const REALTIME_HOOK = "src/hooks/use-defense-realtime.ts";
const DOCUMENT_ROUTE = "src/app/api/documents/[...path]/route.ts";
const REGISTER = "src/app/(auth)/register/page.tsx";
const APPLICANT_DASHBOARD = "src/app/(portal)/applicant/dashboard/page.tsx";
const COR_UPLOAD = "src/app/(portal)/applicant/cor-upload/page.tsx";
const ALIGNMENT = "src/app/(portal)/applicant/alignment/page.tsx";
const MEMOS = "src/app/(portal)/admin/memos/page.tsx";
const NEXT_CONFIG = "next.config.ts";
const FRONTEND_ENV = ".env.example";
const BACKEND_ENV = "../backend/.env.example";
const README = "../README.md";
const FIX1_VERIFIER = "scripts/verify-cdw-live-1-manual-qa-fix-1.mjs";

const activeEnvLines = (source) =>
  source
    .split(/\r?\n/)
    .filter((line) => /^\s*[A-Z0-9_]+=/.test(line))
    .join("\n");

test("normalizes explicit origins and accidental /api suffixes", () => {
  assert.equal(
    normalizeBackendBaseUrl("http://localhost:5000/"),
    "http://localhost:5000",
  );
  assert.equal(
    normalizeBackendBaseUrl("http://localhost:5000/api"),
    "http://localhost:5000",
  );
  assert.equal(
    normalizeBackendBaseUrl("http://localhost:5000/api/"),
    "http://localhost:5000",
  );
  assert.equal(
    normalizeBackendBaseUrl("  https://api.example.edu//  "),
    "https://api.example.edu",
  );
  assert.equal(normalizeBackendBaseUrl(""), "");
});

test("builds valid development URLs for loopback, LAN, and IPv6 hosts", () => {
  assert.equal(buildDevelopmentBackendUrl("localhost"), "http://localhost:5000");
  assert.equal(buildDevelopmentBackendUrl("127.0.0.1"), "http://127.0.0.1:5000");
  assert.equal(
    buildDevelopmentBackendUrl("192.168.1.123"),
    "http://192.168.1.123:5000",
  );
  assert.equal(
    buildDevelopmentBackendUrl("devbox.local"),
    "http://devbox.local:5000",
  );
  assert.equal(buildDevelopmentBackendUrl("::1"), "http://[::1]:5000");
  assert.equal(
    buildDevelopmentBackendUrl("[2001:db8::1]"),
    "http://[2001:db8::1]:5000",
  );
});

test("client explicit override wins in development and production", () => {
  assert.equal(
    resolveClientBackendBaseUrl({
      configuredUrl: "https://api.example.edu/api/",
      hostname: "192.168.1.123",
      isProduction: true,
      hasWindow: true,
    }),
    "https://api.example.edu",
  );
  assert.equal(
    resolveClientBackendBaseUrl({
      configuredUrl: "http://backend.internal:5000",
      hostname: "localhost",
      isProduction: false,
      hasWindow: true,
    }),
    "http://backend.internal:5000",
  );
});

test("client development follows the actual window hostname", () => {
  for (const hostname of [
    "localhost",
    "127.0.0.1",
    "192.168.1.123",
    "devbox.local",
  ]) {
    assert.equal(
      resolveClientBackendBaseUrl({
        configuredUrl: null,
        hostname,
        isProduction: false,
        hasWindow: true,
      }),
      `http://${hostname}:5000`,
    );
  }
});

test("client development formats IPv6 hostnames safely", () => {
  assert.equal(
    resolveClientBackendBaseUrl({
      configuredUrl: null,
      hostname: "::1",
      isProduction: false,
      hasWindow: true,
    }),
    "http://[::1]:5000",
  );
  assert.equal(
    resolveClientBackendBaseUrl({
      configuredUrl: null,
      hostname: "[2001:db8::1]",
      isProduction: false,
      hasWindow: true,
    }),
    "http://[2001:db8::1]:5000",
  );
});

test("client development without a window falls back to loopback", () => {
  assert.equal(
    resolveClientBackendBaseUrl({
      configuredUrl: null,
      hostname: null,
      isProduction: false,
      hasWindow: false,
    }),
    "http://localhost:5000",
  );
});

test("production client requires an explicit URL and never infers from window", () => {
  assert.throws(
    () =>
      resolveClientBackendBaseUrl({
        configuredUrl: null,
        hostname: "localhost",
        isProduction: true,
        hasWindow: true,
      }),
    /NEXT_PUBLIC_BACKEND_API_URL/,
  );
});

test("server development prefers override and otherwise falls back to localhost", () => {
  assert.equal(
    resolveServerBackendBaseUrl({
      configuredUrl: "https://api.example.edu",
      isProduction: true,
    }),
    "https://api.example.edu",
  );
  assert.equal(
    resolveServerBackendBaseUrl({
      configuredUrl: null,
      isProduction: false,
    }),
    "http://localhost:5000",
  );
});

test("production server requires BACKEND_API_URL", () => {
  assert.throws(
    () =>
      resolveServerBackendBaseUrl({
        configuredUrl: null,
        isProduction: true,
      }),
    /BACKEND_API_URL/,
  );
});

test("REST and realtime use the shared client resolver", () => {
  const apiClient = read(API_CLIENT);
  const socket = read(SOCKET);
  const hook = read(REALTIME_HOOK);

  assert.match(apiClient, /getClientBackendBaseUrl/);
  assert.match(socket, /getClientBackendBaseUrl/);
  assert.match(hook, /getClientBackendBaseUrl/);
  assert.doesNotMatch(apiClient, /NEXT_PUBLIC_BACKEND_API_URL/);
  assert.doesNotMatch(socket, /NEXT_PUBLIC_BACKEND_API_URL/);
  assert.doesNotMatch(hook, /NEXT_PUBLIC_BACKEND_API_URL/);
});

test("direct browser fetches use the client resolver", () => {
  for (const file of [REGISTER, COR_UPLOAD, ALIGNMENT, MEMOS]) {
    const source = read(file);
    assert.match(source, /getClientBackendBaseUrl/, `${file} must use resolver`);
    assert.doesNotMatch(
      source,
      /NEXT_PUBLIC_BACKEND_API_URL/,
      `${file} must not read public env directly`,
    );
  }
});

test("server callers use the server resolver and never public env", () => {
  for (const file of [
    API_SERVER,
    AUTH,
    DOCUMENT_ROUTE,
    APPLICANT_DASHBOARD,
  ]) {
    const source = read(file);
    assert.match(source, /getServerBackendBaseUrl/, `${file} must use resolver`);
    assert.doesNotMatch(
      source,
      /NEXT_PUBLIC_BACKEND_API_URL/,
      `${file} must not read public env`,
    );
    assert.doesNotMatch(
      source,
      /process\.env\.BACKEND_API_URL/,
      `${file} must centralize server env reads`,
    );
  }
});

test("only the resolver modules read the backend environment variables", () => {
  const clientResolver = read("src/lib/backend-origin.client.ts");
  const serverResolver = read("src/lib/backend-origin.server.ts");
  const sharedResolver = read("src/lib/backend-origin.shared.ts");

  assert.match(clientResolver, /NEXT_PUBLIC_BACKEND_API_URL/);
  assert.doesNotMatch(clientResolver, /process\.env\.BACKEND_API_URL/);
  assert.match(serverResolver, /process\.env\.BACKEND_API_URL/);
  assert.doesNotMatch(
    serverResolver,
    /process\.env\.NEXT_PUBLIC_BACKEND_API_URL/,
  );
  assert.doesNotMatch(sharedResolver, /process\.env/);
});

test("Next dev origins are environment-driven, not a developer IP", () => {
  const config = read(NEXT_CONFIG);
  assert.match(config, /ALLOWED_DEV_ORIGINS/);
  assert.doesNotMatch(config, /192\.168\.1\.101/);
});

test("tracked env examples contain no active developer-specific private IPv4", () => {
  const frontend = activeEnvLines(read(FRONTEND_ENV));
  const backend = activeEnvLines(read(BACKEND_ENV));
  const privateIp = /\b(?:192\.168|10\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01]))\./;

  assert.doesNotMatch(frontend, privateIp);
  assert.doesNotMatch(backend, privateIp);
  assert.match(read(FRONTEND_ENV), /BACKEND_API_URL="http:\/\/localhost:5000"/);
  assert.doesNotMatch(
    activeEnvLines(read(FRONTEND_ENV)),
    /^\s*NEXT_PUBLIC_BACKEND_API_URL=/m,
  );
  assert.match(
    read(BACKEND_ENV),
    /FRONTEND_URL="http:\/\/localhost:3000,http:\/\/127\.0\.0\.1:3000"/,
  );
});

test("tracked env examples no longer expose the old sample credentials", () => {
  const backend = read(BACKEND_ENV);
  assert.doesNotMatch(backend, /upstash\.io/);
  assert.doesNotMatch(backend, /A1XWvEqGxE1Z6bKRnq/);
  assert.match(backend, /REDIS_URL="redis:\/\/localhost:6379"/);
});

test("the old fixed-IP FIX-1 verifier policy is replaced", () => {
  const verifier = read(FIX1_VERIFIER);
  assert.doesNotMatch(verifier, /192\.168\.1\.101/);
  assert.match(verifier, /ALLOWED_DEV_ORIGINS|backend-origin|runtime host/i);
});

test("README documents localhost, LAN, production, and restart behavior", () => {
  const readme = read(README);
  assert.match(readme, /Development networking \/ backend origin/i);
  assert.match(readme, /localhost:3000.*localhost:5000/s);
  assert.match(readme, /ALLOWED_DEV_ORIGINS/);
  assert.match(readme, /restart.*next dev|next dev.*restart/is);
  assert.match(readme, /FRONTEND_URL/);
});

test("the focused verifier itself is discoverable", () => {
  assert.equal(typeof resolveClientBackendBaseUrl, "function");
  assert.equal(typeof resolveServerBackendBaseUrl, "function");
});
