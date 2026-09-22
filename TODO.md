# TODO

## Turn on Sentry

Sentry is wired into the code but has never reported anything. `App.tsx` calls `Sentry.init` with tracing and session replay, and the SDK ships in the production bundle, but the DSN is missing at build time so the SDK silently disables itself. Production builds come from Netlify, and `VITE_SENTRY_DSN` is not set in Netlify's environment.

To turn it on:

1. Create a project at sentry.io and copy the client DSN.
2. Add `VITE_SENTRY_DSN` to Netlify (Site settings, Environment variables). Netlify builds do not read a local `.env`.
3. Redeploy and confirm an event arrives in the Sentry dashboard.
4. Upload source maps with `@sentry/cli` (already in dependencies) so stack traces are readable.
5. The init block samples 100% of traces and 100% of error replays. Lower those numbers if the quota hurts.

## Other known follow-ups

- Charts page overhaul. Long overdue as of Sept 2026; the vite migration kept the page as-is on purpose.
- Root advisories are at 0. The last 7 moderates were the firebase-tools devDependency chain; fixed via root `overrides` in package.json (@opentelemetry/core 2.11, csv-parse 7.0.2, stream-json 3.7.0, gaxios→uuid 11.1.1). firebase-tools 15.30 declares the same overrides itself, but npm ignores nested overrides, so they have to live at the project root. Verified: `firebase apps:list` works, tsc/vitest/build green. The forced csv-parse and stream-json only back the `auth:import` and `database:import` commands (not deploys); re-verify those two commands before using them. When firebase-tools ships fixed transitive deps of its own, the root overrides can be dropped.
- The functions run Node 22 and firebase-admin 14 now. The unfriend path (`FieldValue.increment(-1)`) has not been manually tested since the upgrade.
