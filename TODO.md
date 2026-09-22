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
- 7 moderate advisories remain in the root app, all inside the firebase-tools devDependency chain (@opentelemetry/core, csv-parse, stream-json). firebase-tools 15.30.2 is the latest release and none of its upstream deps have shipped fixes yet. Accepted for now: these only run on deploy machines parsing your own project files, nothing ships to the browser. Options when fixes land: bump firebase-tools, or force with npm overrides and re-test deploys.
- The functions run Node 22 and firebase-admin 14 now. The unfriend path (`FieldValue.increment(-1)`) has not been manually tested since the upgrade.
