import "dotenv/config";
import {
  bootstrapInitialFullAdministrator,
  parseLocalDevFullAdministratorBootstrapArgs,
} from "../access/local-dev-full-administrator-bootstrap";

const USAGE = [
  "Bounded DR-1 local-development initial Full Administrator bootstrap.",
  "Requires explicit --email <admin-email> and --confirm-local-dev.",
  "Usage:",
  "  npm run admin:bootstrap-full:local-dev -- --email admin@earist.edu.ph --confirm-local-dev [--authorization-ref <ref>]",
  "Refuses non-local/non-graduate_system targets, non-ADMIN accounts, inactive accounts, mustChangePassword=true, or existing non-FULL/direct-grant state.",
  "All rollout gates remain false.",
].join("\n");

export async function runLocalDevFullAdministratorBootstrapCli(
  argv: readonly string[],
): Promise<number> {
  const args = parseLocalDevFullAdministratorBootstrapArgs(argv);
  if (args.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  try {
    const result = await bootstrapInitialFullAdministrator({
      email: args.email,
      authorizationReference: args.authorizationReference,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  } finally {
    // Only close Prisma if the target guard passed and database module was loaded.
    const dbModulePath = require.resolve("../config/database");
    if (require.cache[dbModulePath]) {
      await require(dbModulePath).default.$disconnect();
    }
  }
}

if (require.main === module) {
  runLocalDevFullAdministratorBootstrapCli(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : "DR-1 bootstrap failed"}\n`,
      );
      process.exitCode = 1;
    });
}
