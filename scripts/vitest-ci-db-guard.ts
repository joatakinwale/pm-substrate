/**
 * Vitest global setup: in CI, the DB-gated suites (`describeIfDb`) must run,
 * never silently skip. Locally a missing PM_DATABASE_URL still skips them —
 * that convenience is the exact seam this guard closes for CI: if the CI
 * workflow ever loses the Postgres service or the env var, the run fails
 * loudly instead of going green with a third of the suite skipped.
 */
export default function ciDbGuard(): void {
  if (process.env["CI"] && !process.env["PM_DATABASE_URL"]) {
    throw new Error(
      "CI is set but PM_DATABASE_URL is not: DB-gated test suites would " +
        "silently skip. Provide the Postgres service and PM_DATABASE_URL " +
        "(see .github/workflows/ci.yml) or unset CI for a local partial run.",
    );
  }
}
