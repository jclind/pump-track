# TODO

## Turn on Sentry

Sentry is wired into the code but has never reported anything. `App.tsx` calls `Sentry.init` with tracing and session replay, and the SDK ships in the production bundle, but the DSN is missing at build time so the SDK silently disables itself. Production builds come from Netlify, and `REACT_APP_SENTRY_DSN` is not set in Netlify's environment.

To turn it on:

1. Create a project at sentry.io and copy the client DSN.
2. Add `REACT_APP_SENTRY_DSN` to Netlify (Site settings, Environment variables). Netlify builds do not read a local `.env`.
3. Redeploy and confirm an event arrives in the Sentry dashboard.
4. Upload source maps with `@sentry/cli` (already in dependencies) so stack traces are readable.
5. The init block samples 100% of traces and 100% of error replays. Lower those numbers if the quota hurts.

## Other known follow-ups

- Leave react-scripts 5.0.1 (CRA). About 20 audit advisories have no fix while it remains, and it has been unmaintained since 2022. Vite is the obvious replacement.
- Bump uuid 9 to 14 (breaking) to clear the last moderate advisory chain in the root app.
- The functions run Node 22 and firebase-admin 14 now. The unfriend path (`FieldValue.increment(-1)`) has not been manually tested since the upgrade.
