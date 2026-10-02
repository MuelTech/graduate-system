import fs from "fs";
import path from "path";

/**
 * DL-1: production-safe private storage root configuration.
 *
 * The development default (`./uploads`) stays practical. Production must
 * supply an explicit persistent root and must not resolve inside a
 * public/static webroot or a disposable build directory. No machine-specific
 * production path is hard-coded; deployment supplies it via UPLOAD_DIR.
 */
export class StorageConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageConfigError";
    Object.setPrototypeOf(this, StorageConfigError.prototype);
  }
}

export interface ResolveStorageConfigInput {
  uploadDir?: string;
  nodeEnv?: string;
  cwd?: string;
}

export interface StorageConfig {
  root: string;
  provider: string;
  isProduction: boolean;
}

const DISPOSABLE_BUILD_DIRS = ["dist", "build", ".next"];
const PUBLIC_WEBROOT_SEGMENTS = new Set(["public", "static"]);

function isInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function assertNotExistingFile(root: string): void {
  try {
    const stat = fs.statSync(root);
    if (stat.isFile()) {
      throw new StorageConfigError(
        `Private storage root resolves to an existing file, not a directory: ${root}`,
      );
    }
  } catch (error) {
    if (error instanceof StorageConfigError) throw error;
    // Missing path is acceptable — the provider creates it when needed.
  }
}

export function resolveStorageConfig(
  input: ResolveStorageConfigInput = {},
): StorageConfig {
  const isProduction = input.nodeEnv === "production";
  const cwd = path.resolve(input.cwd ?? process.cwd());
  const configured = input.uploadDir?.trim();

  if (!configured && isProduction) {
    throw new StorageConfigError(
      "UPLOAD_DIR must be explicitly configured in production. Refusing to use an implicit default private storage root.",
    );
  }

  const root = path.resolve(cwd, configured || "./uploads");

  if (isProduction) {
    const segments = root.split(/[\\/]+/).filter(Boolean);
    const publicSegment = segments.find((segment) =>
      PUBLIC_WEBROOT_SEGMENTS.has(segment.toLowerCase()),
    );
    if (publicSegment) {
      throw new StorageConfigError(
        `Production storage root must not resolve inside a public/static webroot: ${root}`,
      );
    }

    for (const buildDir of DISPOSABLE_BUILD_DIRS) {
      const forbidden = path.resolve(cwd, buildDir);
      if (isInside(forbidden, root)) {
        throw new StorageConfigError(
          `Production storage root must not resolve inside the disposable build directory "${buildDir}": ${root}`,
        );
      }
    }

    // Canonical Document Lifecycle rule: production storage must live outside
    // the disposable application release/webroot. Reject the application
    // directory itself and anything underneath it. Uses path.relative
    // containment (not naive string-prefix matching), so sibling paths such as
    // /srv/app-private remain valid.
    if (isInside(cwd, root)) {
      throw new StorageConfigError(
        `Production storage root must be outside the application directory: ${root}`,
      );
    }
  }

  assertNotExistingFile(root);

  return {
    root,
    provider: "local",
    isProduction,
  };
}
