import { createHash } from "crypto";

/** Existing exact-byte identity contract: length-prefixed manifest and sorted assets. */
export function examPackageFingerprint(
  manifest: Buffer,
  assets: ReadonlyMap<string, Buffer>,
): string {
  const hash = createHash("sha256")
    .update(`${manifest.length}:`)
    .update(manifest);
  for (const reference of [...assets.keys()].sort()) {
    const bytes = assets.get(reference)!;
    hash
      .update(`${Buffer.byteLength(reference)}:${reference}:${bytes.length}:`)
      .update(bytes);
  }
  return hash.digest("hex");
}
