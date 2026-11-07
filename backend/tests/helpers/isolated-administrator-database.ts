/** Deliberately requires a separate local port; no normal-XAMPP scratch schemas. */
export function isolatedAdministratorDatabaseServer(testServer: string, applicationDatabase: string): URL {
  const test = new URL(testServer); const application = new URL(applicationDatabase);
  if (test.protocol !== "mysql:" || !["localhost", "127.0.0.1", "[::1]"].includes(test.hostname.toLowerCase())) {
    throw new Error("An explicit local MySQL/MariaDB server URL is required.");
  }
  if (test.pathname !== "/" && test.pathname !== "") throw new Error("Test URL must be server-only, without any schema.");
  if ((test.port || "3306") === (application.port || "3306")) {
    throw new Error("A different port from the application DATABASE_URL is required for destructive tests.");
  }
  return test;
}
