// Trusted Node runtime/dependencies are prerequisites; application code comes only from HEAD.
const { execFileSync } = require("node:child_process");
const { readFileSync, realpathSync } = require("node:fs");
const { createHash } = require("node:crypto");
const path = require("node:path");
const Module = require("node:module");

const root = path.resolve(__dirname, "../..");
const launcher = "backend/scripts/faculty-cutover-rehearsal.cjs";
const entry = "backend/src/cli/faculty-cutover-rehearsal.ts";
// Closed application module graph: no working-tree .js/.ts or ignored dist fallback.
const sources = [entry, "backend/src/access/cutover-rehearsal.ts", "backend/src/access/cutover-rehearsal.database.ts",
  "backend/src/access/account-access.ts", "backend/src/access/capability-catalog.ts", "backend/src/utils/academic-account.ts", "backend/src/utils/account-email.ts"].sort();
const externalModules = new Set(["node:crypto", "node:fs", "mysql2/promise", "dotenv/config"]);
function git(...args) {
  // Do not let inherited alternate index/worktree/object settings hide the relevant checkout.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
  return execFileSync("git", ["-C", root, ...args], { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 4_000_000 });
}
function assertCleanCheckout(expectedCommit) {
  if (realpathSync(git("rev-parse", "--show-toplevel").trim()) !== realpathSync(root)) throw new Error("Wrong operator checkout.");
  const commit = git("rev-parse", "--verify", "HEAD").trim();
  if (!/^[a-f0-9]{40}$/.test(commit) || (expectedCommit && expectedCommit !== commit)) throw new Error("Operator source HEAD changed.");
  if (git("status", "--porcelain=v1", "--untracked-files=all", "--ignore-submodules=none").trim()) throw new Error("Operator checkout must be clean, including untracked source.");
  if (git("ls-files", "-v").split(/\r?\n/).some(line => /^[a-zS] /.test(line))) throw new Error("Hidden index changes are not permitted (assume-unchanged/skip-worktree).");
  const committed = git("show", `${commit}:${launcher}`);
  if (readFileSync(__filename, "utf8").replace(/\r\n/g, "\n") !== committed.replace(/\r\n/g, "\n")) throw new Error("Launcher does not match source HEAD.");
  return commit;
}
function loadReviewedOperator() {
  const sourceCommit = assertCleanCheckout();
  const content = new Map([launcher, ...sources].map(file => [file, git("show", `${sourceCommit}:${file}`)]));
  const sha256 = value => createHash("sha256").update(value).digest("hex");
  const files = [...content].map(([file, code]) => ({ file, sha256: sha256(code) }));
  const provenance = { sourceCommit, execution: "GIT_HEAD_TYPESCRIPT", sourceTreeSha256: sha256(JSON.stringify(files)), files };
  // No application imports, temporary build files or operator outputs precede the checks above.
  const ts = require("typescript"), cache = new Map();
  function load(file) {
    if (!sources.includes(file)) throw new Error("Operator import is outside the committed module graph.");
    if (cache.has(file)) return cache.get(file).exports;
    const filename = path.join(root, file), compiled = new Module(filename, module);
    compiled.filename = filename; compiled.paths = Module._nodeModulePaths(path.dirname(filename)); cache.set(file, compiled);
    const externalRequire = compiled.require.bind(compiled);
    compiled.require = name => {
      if (!name.startsWith(".")) {
        if (!externalModules.has(name)) throw new Error("Operator dependency is outside the committed module graph.");
        return externalRequire(name);
      }
      const resolved = path.relative(root, path.resolve(path.dirname(filename), name)).replace(/\\/g, "/");
      return load(resolved.endsWith(".ts") ? resolved : `${resolved}.ts`);
    };
    const result = ts.transpileModule(content.get(file), { fileName: filename, compilerOptions: {
      target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
    } });
    compiled._compile(result.outputText, filename); compiled.loaded = true; return compiled.exports;
  }
  assertCleanCheckout(sourceCommit);
  return { provenance, assertSource: () => assertCleanCheckout(sourceCommit), operator: load(entry) };
}
module.exports = { loadReviewedOperator };
if (require.main === module) {
  (async () => {
    const { provenance, assertSource, operator } = loadReviewedOperator();
    process.chdir(path.join(root, "backend"));
    await operator.runRehearsal(provenance, assertSource);
  })().catch(() => { console.error("FACULTY-16 rejected: source provenance, protected inputs or rehearsal state could not be verified. Use a clean committed checkout and this tracked launcher; no credentials are logged."); process.exitCode = 1; });
}
