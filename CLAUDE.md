# pump-track

## Releases

- Netlify deploys the `prod` branch. Work lands on `main` first, then moves to prod with a main→prod promotion PR.
- Bump `version` in package.json before opening a promotion PR into `prod`, or consciously decide not to. Nothing reads it today (not in the UI, not in manifest.json), so a missed bump is silent.
- Firebase functions deploy manually from `functions/`, never through Netlify.

## Local testing

- `npm run dev:emu` builds the functions, starts the Auth, Firestore, and Functions emulators (project `demo-pump-track`), seeds two test users, and serves the app at http://127.0.0.1:3000. The emulator UI is at http://127.0.0.1:4000. Stopping it throws all the data away, and the next start reseeds.
- The login page then shows "Sign in as Alex Tester", "Sign in as Blair Tester", and "Sign up as a new test user". They skip the Google popup, which a session driving the browser can't reach. The prod build has none of this.
- Two users at once: sign in as one at `127.0.0.1:3000` and the other at `localhost:3000`. The two addresses keep separate sign-ins in the same browser.
- The emulators run `firestore.rules` and the functions from this checkout, and reload rules on save. They can't show real cold starts or real Google sign-in, so do one real sign-in on prod after a promotion that touches sign-in.
- Test accounts live in `src/services/testAccounts.ts`, their workouts in `scripts/seed-emulators.mjs`.
