import crypto from "crypto";
import fs from "fs";

/**
 * DL-1: application-level checksum helpers.
 * SHA-256 is the agreed target algorithm for managed documents.
 */
export const DEFAULT_CHECKSUM_ALGORITHM = "sha256";

export function calculateSha256(data: string | Buffer): string {
  return crypto.createHash(DEFAULT_CHECKSUM_ALGORITHM).update(data).digest("hex");
}

/**
 * Computes the SHA-256 of a file using a streaming read so large files are not
 * fully buffered in memory.
 */
export function calculateFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(DEFAULT_CHECKSUM_ALGORITHM);
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}
