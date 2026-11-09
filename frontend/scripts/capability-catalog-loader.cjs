// Compile the existing, dependency-free FACULTY-1 catalog in its backend
// package's CommonJS format. No generated catalog or second grant authority.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Turbopack loader entry uses CommonJS.
const ts = require("typescript");
module.exports = function capabilityCatalog(source) {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
};
