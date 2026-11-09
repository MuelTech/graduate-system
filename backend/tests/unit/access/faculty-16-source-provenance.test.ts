import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";

const backend = path.resolve(__dirname, "../../.."), temporary = path.join(backend, ".tmp");
const launcher = "backend/scripts/faculty-cutover-rehearsal.cjs";
const entry = "backend/src/cli/faculty-cutover-rehearsal.ts";
const sourceFiles = [entry, "backend/src/access/cutover-rehearsal.ts", "backend/src/access/cutover-rehearsal.database.ts",
  "backend/src/access/account-access.ts", "backend/src/access/capability-catalog.ts", "backend/src/utils/academic-account.ts", "backend/src/utils/account-email.ts"];
const folders: string[] = [];
function git(root: string, ...args: string[]) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
}
function put(root: string, file: string, content: string) {
  const target = path.join(root, file); mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, content);
}
function commit(root: string) {
  git(root, "add", "."); git(root, "-c", "user.name=Synthetic Test", "-c", "user.email=test@example.invalid", "commit", "-m", "Synthetic provenance fixture");
  return git(root, "rev-parse", "HEAD");
}
function fixture(probe = false) {
  mkdirSync(temporary, { recursive: true }); const root = mkdtempSync(path.join(temporary, "faculty16-provenance-")); folders.push(root);
  git(root, "init"); git(root, "config", "core.autocrlf", "false");
  put(root, ".gitignore", ".tmp/\ndist/\n*.js\n"); put(root, "README.md", "Synthetic source-integrity fixture\n");
  for (const file of [launcher, ...sourceFiles, "backend/package.json"]) put(root, file, readFileSync(path.join(backend, "..", file), "utf8"));
  if (probe) put(root, entry, "export async function runRehearsal(provenance, assertSource) { assertSource(); console.log(JSON.stringify(provenance)); }\n");
  return { root, head: commit(root), backend: path.join(root, "backend") };
}
function invoke(f: ReturnType<typeof fixture>, args: string[] = [], extraEnv = {}, cwd = f.backend) {
  return spawnSync(process.execPath, [path.join(f.root, launcher), ...args], { cwd, encoding: "utf8", timeout: 15_000,
    env: { ...process.env, FACULTY_16_DB_SERVER_URL: "mysql://synthetic@127.0.0.1:33316/", DATABASE_URL: "mysql://synthetic@127.0.0.1:3306/unused", ...extraEnv } });
}
afterEach(() => {
  for (const folder of folders.splice(0)) {
    if (path.dirname(path.resolve(folder)) !== temporary || !path.basename(folder).startsWith("faculty16-provenance-")) throw new Error("Unsafe fixture cleanup.");
    rmSync(folder, { recursive: true, force: true });
  }
});
describe("FACULTY-16 executable/source integrity (real isolated Git fixtures; no database)", () => {
  it.each(["tracked", "staged", "untracked", "outside-backend"])("rejects %s dirt before creating evidence or baseline", kind => {
    const f = fixture(), file = kind === "untracked" ? "backend/src/unreviewed.ts" : kind === "outside-backend" ? "new-policy.md" : "README.md";
    put(f.root, file, "Unreviewed change\n"); if (kind === "staged") git(f.root, "add", file);
    const evidence = path.join(f.backend, ".tmp/evidence.json"), baseline = path.join(f.backend, ".tmp/baseline.json");
    mkdirSync(path.dirname(evidence), { recursive: true });
    const result = invoke(f, ["--schema", `faculty16_test_${"a".repeat(32)}`, "--capture", baseline, "--evidence", evidence]);
    expect(result.status).toBe(1); expect(result.stderr).toContain("source provenance");
    expect(existsSync(evidence)).toBe(false); expect(existsSync(baseline)).toBe(false);
  });
  it.each(["--assume-unchanged", "--skip-worktree"])("rejects %s hidden tracked changes", flag => {
    const f = fixture(); git(f.root, "update-index", flag, "README.md"); put(f.root, "README.md", "Hidden unreviewed change");
    expect(git(f.root, "status", "--porcelain")).toBe(""); expect(invoke(f, ["--help"]).status).toBe(1);
  });
  it("ignores inherited alternate Git worktree/index settings and checks the relevant checkout", () => {
    const f = fixture(), other = fixture(); put(f.root, "README.md", "Dirty relevant checkout");
    expect(invoke(f, ["--help"], { GIT_DIR: path.join(other.root, ".git"), GIT_WORK_TREE: other.root, GIT_INDEX_FILE: path.join(other.root, ".git/index") }, other.backend).status).toBe(1);
  });
  it("executes committed sources from the launcher checkout and records their actual hashes/HEAD", () => {
    const f = fixture(true), other = fixture();
    const result = invoke(f, [], {}, other.backend); expect(result.status).toBe(0);
    const provenance = JSON.parse(result.stdout);
    expect(provenance.sourceCommit).toBe(f.head); expect(provenance.execution).toBe("GIT_HEAD_TYPESCRIPT");
    for (const file of provenance.files) {
      const bytes = execFileSync("git", ["-C", f.root, "show", `${f.head}:${file.file}`]);
      expect(file.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    }
    expect(provenance.sourceTreeSha256).toBe(createHash("sha256").update(JSON.stringify(provenance.files)).digest("hex"));
  });
  it("never executes ignored stale dist or adjacent JavaScript shadows", () => {
    const f = fixture(), marker = path.join(f.backend, ".tmp/stale-executed");
    const stale = `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'stale'); throw new Error('stale artifact executed');`;
    put(f.root, "backend/dist/cli/faculty-cutover-rehearsal.js", stale);
    put(f.root, "backend/src/access/cutover-rehearsal.js", stale);
    expect(git(f.root, "status", "--porcelain")).toBe("");
    const result = invoke(f, ["--help"]); expect(result.status).toBe(0); expect(result.stdout).toContain("isolated rehearsal only"); expect(existsSync(marker)).toBe(false);
    expect(JSON.parse(readFileSync(path.join(f.backend, "package.json"), "utf8")).scripts["faculty:cutover:rehearse"]).toBe("node scripts/faculty-cutover-rehearsal.cjs");
  });
  it("a previously committed executable cannot silently report the previous HEAD after source changes commit", () => {
    const f = fixture(true), old = JSON.parse(invoke(f).stdout);
    put(f.root, entry, readFileSync(path.join(f.root, entry), "utf8") + "// new reviewed implementation\n"); const next = commit(f.root);
    const actual = JSON.parse(invoke(f).stdout);
    expect(actual.sourceCommit).toBe(next); expect(actual.sourceCommit).not.toBe(old.sourceCommit);
    expect(actual.sourceTreeSha256).not.toBe(old.sourceTreeSha256);
  });
  it("rejects an ignored cached launcher from a different commit even when the checkout is clean", () => {
    const f = fixture(true), cached = readFileSync(path.join(f.root, launcher), "utf8");
    put(f.root, launcher, cached + "\n// committed launcher revision\n"); commit(f.root);
    put(f.root, ".git/info/exclude", "backend/scripts/stale-operator.cjs\n"); put(f.root, "backend/scripts/stale-operator.cjs", cached);
    expect(git(f.root, "status", "--porcelain")).toBe("");
    const evidence = path.join(f.backend, ".tmp/evidence.json"), result = spawnSync(process.execPath,
      [path.join(f.backend, "scripts/stale-operator.cjs"), "--evidence", evidence], { cwd: f.backend, encoding: "utf8", timeout: 15_000 });
    expect(result.status).toBe(1); expect(result.stderr).toContain("source provenance"); expect(existsSync(evidence)).toBe(false);
  });
  it("rejects a baseline bound to a different committed HEAD before creating evidence", () => {
    const f = fixture(), evidence = path.join(f.backend, ".tmp/evidence.json"), b = path.join(f.backend, ".tmp/baseline.json"), m = path.join(f.backend, ".tmp/manifest.json");
    put(f.root, "backend/.tmp/baseline.json", JSON.stringify({ schema: `faculty16_test_${"a".repeat(32)}`, sourceCommit: "0".repeat(40) }));
    put(f.root, "backend/.tmp/manifest.json", "{}");
    expect(invoke(f, ["--schema", `faculty16_test_${"a".repeat(32)}`, "--baseline", b, "--manifest", m, "--evidence", evidence]).status).toBe(1);
    expect(existsSync(evidence)).toBe(false);
  });
  it("a fresh compiled dist entry also denies direct execution without creating outputs", () => {
    const f = fixture(), evidence = path.join(f.backend, ".tmp/evidence.json");
    for (const file of sourceFiles) put(f.root, file.replace("backend/src/", "backend/dist/").replace(/\.ts$/, ".js"), ts.transpileModule(readFileSync(path.join(f.root, file), "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText);
    const result = spawnSync(process.execPath, [path.join(f.backend, "dist/cli/faculty-cutover-rehearsal.js"), "--evidence", evidence], { cwd: f.backend, encoding: "utf8", timeout: 15_000 });
    expect(result.status).toBe(1); expect(result.stderr).toContain("direct source/dist execution is denied"); expect(existsSync(evidence)).toBe(false);
  });
});
