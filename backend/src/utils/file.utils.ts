import path from "path";

/**
 * Resolved absolute path to the private uploads directory.
 * All uploaded files are stored under this root so that path-traversal
 * checks can validate that resolved paths stay within it.
 */
export const PRIVATE_UPLOAD_ROOT = path.resolve(
  process.env.UPLOAD_DIR || "./uploads"
);
