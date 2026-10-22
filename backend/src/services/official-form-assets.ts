/**
 * FORM-INT-1: server-side resolution of the accepted official-form logo assets.
 *
 * The assets live at `backend/assets/official-forms/`, outside the TypeScript
 * `src/` tree. Both the ts-node dev context (`src/services/`) and the compiled
 * start context (`dist/services/`) sit two levels below `backend/`, so the same
 * relative resolution works for `npm run dev` and `npm start` without copying
 * binaries into `dist/`. Deployment must keep the `assets/` directory alongside
 * `dist/` and `package.json`.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { InstitutionalLogos } from "../documents/official-defense/shared/institutional-header";
import { AppError } from "../utils/AppError";

const EARIST_LOGO = "earist-logo.jpg";
const GRADUATE_SCHOOL_LOGO = "graduate-school-logo.jpg";

/** Resolved from the module location so it is independent of process.cwd(). */
export const OFFICIAL_FORM_ASSET_DIR = path.resolve(
  __dirname,
  "../../assets/official-forms",
);

async function readLogo(rootDir: string, fileName: string): Promise<Buffer> {
  try {
    const bytes = await readFile(path.join(rootDir, fileName));
    if (bytes.length === 0) throw new Error("empty asset");
    return bytes;
  } catch {
    // Generic message: never expose server filesystem paths to an HTTP caller.
    throw new AppError("Official form assets are unavailable.", 500);
  }
}

/**
 * Load the two production masthead logos. `rootDir` exists so focused tests can
 * exercise the controlled missing-asset failure without moving real assets.
 */
export async function loadOfficialFormLogos(
  rootDir: string = OFFICIAL_FORM_ASSET_DIR,
): Promise<InstitutionalLogos> {
  const [earist, graduateSchool] = await Promise.all([
    readLogo(rootDir, EARIST_LOGO),
    readLogo(rootDir, GRADUATE_SCHOOL_LOGO),
  ]);
  return {
    earist: { bytes: earist, mimeType: "image/jpeg" },
    graduateSchool: { bytes: graduateSchool, mimeType: "image/jpeg" },
  };
}
