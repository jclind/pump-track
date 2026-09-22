# CRA → Vite migration plan

Step 4 of the dependency hardening plan (see TODO.md). Status: executed Sept 2026 on
branch `deps/vite-migration` (forked from `deps/npm-audit-fix`, unpushed); local gates
green. Two things the plan did not predict, recorded here for the record: jest-canvas-mock
came back because lottie-web probes canvas at import time (the plan's fallback clause
covered the re-add), and it needs `globalThis.jest = vi` shimmed via `vi.hoisted` in
setupTests before the import, since jest-canvas-mock calls `jest.fn()` at import.
Remaining: manual click-through and the Netlify cutover below. Written Sept 2026 against
branch `deps/npm-audit-fix`. The executing branch is
`deps/vite-migration`, forked from `deps/npm-audit-fix` (the render smoke test and the
other hardening commits live there, unpushed).

Audited 2026-09-22 against the working tree. Every path and line number below was checked.
Corrections from that audit are folded in and marked "(audit)" where they change what a
previous reader would have believed.

For a session executing this: work top to bottom, commit at the phase boundaries noted below.
For a session reviewing this: verify every file path, line number, and claim against the
actual tree before approving. Nothing here should be trusted on faith.

## Why

react-scripts 5.0.1 is unmaintained and carries ~20 audit advisories with no fix. Migrating
to Vite 7 removes them. Nothing user-facing may change except the accepted deltas below.

## Decisions already made (don't re-litigate)

- Browser floor: `build.target: 'es2020'`. This is a real floor raise, not a wash (audit).
  CRA 5 runs `babel-preset-react-app/dependencies` over node_modules, so today's bundle is
  ES5 syntax throughout. es2020 lands around iOS Safari 14 and Chrome 80. Accepted: firebase
  v10 is already shaky below that, and Vite 7's own default
  (`baseline-widely-available`, roughly Chrome 107+/Safari 16+) would be a much harder cut.
- Source maps: set `build.sourcemap: true` (audit). CRA emits `main.*.js.map` today and the
  current `build/` has them. Vite defaults to `false`, which would silently make production
  stack traces unreadable and break TODO.md's Sentry step 4 (upload maps with `@sentry/cli`).
- Firebase compat cleanup is in scope: 3 lines in `src/services/firestore.ts`, convert to
  modular `initializeApp`. Auth gets smoke tested.
- All build tooling (vite, plugin-react, vitest, jsdom, typescript, sass) goes to
  `devDependencies`. Netlify installs devDeps by default, with one caveat in "Netlify
  cutover" step 2.
- Env vars rename to `VITE_*` (not the `envPrefix` workaround). Netlify dashboard vars get
  renamed with the ordering in "Netlify cutover" below.
- `build.outDir: 'build'` so Netlify's publish directory stays unchanged.
- Keep moment/chartjs-adapter-moment. Keep `public/manifest.json` byte-for-byte (it still
  says "Create React App Sample"; renaming would change the installed-PWA name, which is
  user-facing). Rename would be a separate future change.
- Leave `VITE_SENTRY_DSN` unset to preserve the Sentry-disabled status quo.
- Accept that nothing lints afterward (audit). There is no lint script and no CI, so this
  breaks no gate, but CRA's dev server printed `react-hooks/exhaustive-deps` warnings to the
  terminal and Vite prints nothing. Flat config is a follow-up.

## Survey findings (verified against the tree)

- Env reads: exactly 8 sites in 2 files. 7 `REACT_APP_FIREBASE_*` in
  `src/services/firestore.ts:15-21`, `REACT_APP_SENTRY_DSN` in `src/App.tsx:28`. Nothing
  else touches `process.env`, `NODE_ENV`, or `PUBLIC_URL`.
- **`npx tsc --noEmit` already fails today** (audit). Exit 2, 50 errors, every one a syntax
  error in `node_modules/@types/node/ffi.d.ts` that TS 4.9.5 cannot parse. `skipLibCheck`
  does not suppress them because they are parse errors, not type errors. Zero errors come
  from `src/`. The fix is the phase 2 `"types"` array, which stops auto-including
  `@types/node` entirely. See the ordering note in phase 1.
- `src/_exports.scss` has an ICSS `:export` block (borderColor, primaryText, secondaryText,
  tertiaryText, primaryBackground, secondaryBackground, tertiaryBackground, secondary).
  8 components import it as a value and feed the colors into MUI `sx` props and chart.js.
  CRA tolerates this; Vite only produces exports from `*.module.scss`. Unhandled, all 8
  colors come back `undefined` with no error. Fix: rename + 8 path edits.
- `src/helpers.scss` is 60 lines of `$variable` declarations and nothing else (audit). No
  selectors, no rules. This is what makes the CSS-module rename safe: a single real selector
  in there would get its class name hashed once `_exports` becomes a module, breaking styles
  with no error anywhere.
- **Verified by probe** (audit): a scratch Vite 7.3.6 + sass 1.104.1 build of
  `_exports.module.scss` (same `@import './helpers.scss'` + `:export` shape) emitted
  `{borderColor:"#272727",primaryText:"#eeeeee",secondary:"#855ae1"}` into the JS chunk.
  Keys pass through verbatim, no `localsConvention` needed, the CSS asset comes out empty,
  and the leading-underscore filename works fine as a bundler entry.
- **Pre-existing bug, not a regression** (audit): `src/Components/FriendQRModal/FriendQRModal.tsx:56`
  reads `styles.primary`, which is not in the `:export` block (the block has `primaryText`).
  That QR `bgColor` is undefined today and will still be undefined after. The migration will
  not surface it: `vite/client` types `*.module.scss` as `{ readonly [key: string]: string }`,
  so `styles.anything` type-checks. Fix it in phase 3 while the file is open.
- Build-breaker: `react-scripts` supplies the Jest types that let `tsc` type-check
  `src/App.test.tsx` (via `src/react-app-env.d.ts`). Delete it without adding
  `"types": ["vite/client", "vitest/globals"]` to tsconfig and `npm run build` fails.
- Firebase compat: only `src/services/firestore.ts` lines 2-3 and 25 (`firebase/compat/app`
  import, compat auth side-effect import, `firebase.initializeApp`). All other files already
  import modular SDK functions; consumers of this file are `App.tsx` (`auth`) and
  `services/auth.ts`, `services/friends.ts`, `services/tracker.ts`
  (`auth, db, firebaseFunctions`). Nothing imports `app` externally; keep the export anyway.
- Test polyfills are deletable under Vitest: vitest's jsdom keeps Node globals (Node has
  TextEncoder + web streams natively), and the smoke test renders unauthenticated App, so
  chart.js never touches a canvas. The `#root` stub STAYS: `App.tsx:47` calls
  `Modal.setAppElement('#root')` at module load.
- Sass: 29 files; 28 use deprecated `@import` for `helpers.scss` (~40 `$vars`). Works under
  the modern API; silence the deprecation, converting to `@use` is a follow-up.
  `src/index.scss:2` has a Google Fonts `@import url(...)` which passes through untouched.
  No .scss file anywhere uses `darken()`, `lighten()`, `transparentize()` or slash-division
  (audit), so the `color-functions` and `slash-div` deprecations never fire and "clean sass
  log" is a reachable pass criterion, not wishful thinking.
- Installed sass is 1.63.6 (audit). `silenceDeprecations` landed in Dart Sass 1.80, so the
  bump in phase 1 is required, not cosmetic.
- Dead weight, safe to delete: `tailwind.config.js`, `components.json`, `app/globals.css`
  (tailwindcss isn't installed, nothing imports them), `src/reportWebVitals.ts` + `web-vitals`
  (called with no argument, a no-op), `@babel/plugin-proposal-private-property-in-object`
  (CRA audit workaround), `src/react-app-env.d.ts`, root `declaration.d.ts`.
- public/: `_redirects` (contents `/*  /index.html  200`, must survive the build),
  favicon.ico, logo192.png, logo512.png, manifest.json, robots.txt. Nothing in src/
  references public/ files.
- No CI, no git hooks, no lint scripts. The `eslintConfig` block in package.json dies with
  react-scripts. There are 18 `eslint-disable-next-line` comments across 13 files (audit,
  an earlier draft said one in App.tsx); all become inert comments.
- Local Node is v26.3.0 (fine for Vite 7's 20.19+ floor). Netlify's Node is unknown;
  `.nvmrc` handles it. `.env` is local-only with the 7 firebase var names; no other env
  files exist. `.env` is listed in `.gitignore`, so it is untracked (audit).

## Implementation

### Phase 1: package.json

- Remove: `react-scripts`, `web-vitals`, `tailwindcss-animate`, `jest-canvas-mock`,
  `@babel/plugin-proposal-private-property-in-object`.
- Add devDeps: `vite` ^7, `@vitejs/plugin-react`, `vitest`, `jsdom`. Move + bump to devDeps:
  `typescript` ^5.9 (match functions/), `sass` latest (needed for the silence flag below).
- Bump `@testing-library/jest-dom` 5.16.5 → ^6 (audit). v5's types live in
  `@types/testing-library__jest-dom` and augment the `jest` namespace, so under vitest the
  matchers go untyped. The current single test only uses `not.toBeNull()`, so nothing breaks
  today, but the first `toBeInTheDocument()` anyone writes is a type error. v6 supports
  vitest natively and the bump is free here.
- Scripts:
  - `"dev": "vite"`, `"start": "vite"`
  - `"start-3006": "vite --port 3006"` (current value is Windows `set PORT=` syntax, broken
    on macOS; keep the script name, fix the value)
  - `"build": "tsc && vite build"` (keeps type-check-on-build; vite does not type-check)
  - `"preview": "vite preview"`, `"test": "vitest"`, `"test:run": "vitest run"`
  - delete `"eject"`, the `eslintConfig` block, the `browserslist` block
- **Do not gate on `npx tsc --noEmit` yet** (audit). It is already red for reasons unrelated
  to this work (see survey), and it stays red until the phase 2 `"types"` array lands. Do
  phase 2's tsconfig edit, then run `npx tsc --noEmit` and fix forward. Expect zero `src/`
  errors either side of the TS 4.9 → 5.9 jump; the baseline has none.
- `"build": "tsc && vite build"` is a stricter gate than CRA had (audit). CRA used
  fork-ts-checker with its own config, so `npm run build` passed while bare `tsc` failed.
  Intentional, but that is why the check has to be green before it becomes load-bearing.
- The `npm ls @testing-library/dom` check from an earlier draft is moot (audit):
  `@testing-library/react@13.4` lists it as a regular dependency, not a peer. That only
  changed in RTL 14.

### Phase 2: config and root files

- New `vite.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'build',     // matches Netlify publish dir
    target: 'es2020',    // browser floor, see decisions
    sourcemap: true,     // CRA parity; Vite defaults to false
  },
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['import'], // 28 files still use Sass @import
      },
    },
  },
  server: { port: 3000 },  // CRA parity; firebase authorizes all localhost ports
  preview: { port: 3000 },
  test: {
    environment: 'jsdom',
    globals: true,         // App.test.tsx uses bare test/expect
    setupFiles: './src/setupTests.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'], // keep vitest out of functions/
  },
})
```

  Note: `include` is `["src"]`, so `tsc` never checks this file (audit). Config type errors
  surface only when vite runs.

- `git mv public/index.html index.html`, then: `%PUBLIC_URL%/favicon.ico` → `/favicon.ico`,
  same for `logo192.png` and `manifest.json`; add
  `<script type="module" src="/src/index.tsx"></script>` after `<div id="root"></div>`;
  delete the CRA template comments. Keep everything user-visible exactly: viewport with
  `maximum-scale=1`, title "Pump Track", theme-color, description, apple-touch-icon,
  manifest link, noscript.
- New `src/vite-env.d.ts` (replaces `react-app-env.d.ts`):

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  readonly VITE_FIREBASE_MEASUREMENT_ID: string
  readonly VITE_SENTRY_DSN?: string // currently unset in prod
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

- tsconfig.json: `"target": "ES2020"` (was es5; noEmit means this only affects checking),
  `"module": "ESNext"`, `"moduleResolution": "bundler"`,
  `"types": ["vite/client", "vitest/globals"]`. That last line is load-bearing twice over:
  it types `App.test.tsx`, and by replacing blanket `typeRoots` auto-inclusion it drops
  `@types/node`, which is what clears the 50 pre-existing `ffi.d.ts` parse errors (audit).
  Nothing in `src/` needs node types once the `process.env` reads and the setupTests
  polyfills are gone.
  Delete the `paths: {"@/*": ["./*"]}` mapping, which sits at the file root rather than
  inside `compilerOptions` and is therefore already inert (audit; zero `@/` imports exist
  either way), and the phantom `"@/components/ui"` + `"./declaration.d.ts"` entries from
  `include`, leaving `["src"]`. Keep strict, jsx react-jsx, isolatedModules, noEmit,
  resolveJsonModule (Footer imports package.json), skipLibCheck, esModuleInterop.
- Run `npx tsc --noEmit` here. This is the real baseline gate deferred from phase 1.
- Delete: `src/react-app-env.d.ts`, root `declaration.d.ts` (vite/client types
  `*.module.scss`; the only plain-scss value imports are the 8 `_exports` sites, renamed in
  phase 3), `src/reportWebVitals.ts`.
- New `.nvmrc` at repo root containing `22`.
- Own commit: delete `tailwind.config.js`, `components.json`, `app/globals.css` (+ the empty
  `app/` dir).

### Phase 3: source

- `src/services/firestore.ts`: replace the two compat imports with
  `import { initializeApp } from 'firebase/app'`, replace `firebase.initializeApp(...)` with
  `initializeApp(...)`, and swap all 7 `process.env.REACT_APP_FIREBASE_*` →
  `import.meta.env.VITE_FIREBASE_*`.
- `src/App.tsx:28`: `process.env.REACT_APP_SENTRY_DSN` → `import.meta.env.VITE_SENTRY_DSN`.
- `git mv src/_exports.scss src/_exports.module.scss`, contents unchanged (the `:export`
  block passes keys through verbatim; no localsConvention needed, confirmed by probe).
  Optional: drop the underscore and call it `colors.module.scss`. The `_` means "Sass
  partial" and this file is now a bundler entry; the probe shows either name works.
  Update the import path in all 8 consumers (path swap only):
  - `src/Components/ChartSelect/ChartSelect.tsx`
  - `src/Components/ExerciseChart/ExerciseChart.tsx`
  - `src/Components/ExercisePR/ExercisePR.tsx`
  - `src/Components/FriendQRModal/FriendQRModal.tsx`
  - `src/Components/FriendsList/FriendsList.tsx`
  - `src/Components/FriendsPage/UserCard/UserCard.tsx` (three levels up)
  - `src/Components/LastWorkout/LastWorkout.tsx`
  - `src/Components/UserDetails/UserDetails.tsx`
  Guard: `grep -rn "_exports.scss'" src/` must return zero hits.
- While in `FriendQRModal.tsx`: line 56 passes `bgColor={styles.primary}`, a key the
  `:export` block does not define (audit). Change it to `styles.primaryText`, which is the
  `#eeeeee` the QR code was presumably meant to sit on. This is a live bug today, so the
  fix is a visible change; confirm the QR modal looks right in the phase-4 click-through.
- `src/index.tsx`: delete the `reportWebVitals` import and call (and the boilerplate
  comment). Keep StrictMode, BrowserRouter, the `./index.scss` then `normalize.css` order.
- Rename the 7 vars in local `.env` (`REACT_APP_FIREBASE_*` → `VITE_FIREBASE_*`) at the same
  time as this phase, or the next `npm run dev` breaks. It will not appear in the commit:
  `.env` is gitignored (audit).

### Phase 4: tests

Rewrite `src/setupTests.ts` down to:

```ts
import '@testing-library/jest-dom'

// App.tsx calls Modal.setAppElement('#root') at module load, which requires
// the element to exist. index.html provides it in the real app; jsdom needs it here.
document.body.innerHTML = '<div id="root"></div>'
```

`src/App.test.tsx` stays untouched. The known firebase `act()` warning stays; it predates
this work.

## Verification (local)

1. `npx tsc --noEmit` clean. (Run it after the phase 2 tsconfig edit, not before.)
2. `npm run test:run` → 1 passing. If it fails with `TextEncoder is not defined`, restore the
   util/stream polyfill block; if it fails on canvas `getContext`, re-add `jest-canvas-mock`
   (works fine as a vitest setup import). Neither is expected.
3. `npm run build`, then audit `build/`: has `index.html`, `assets/*.js`, `assets/*.css`,
   `assets/*.js.map`, `_redirects`, `favicon.ico`, `logo192.png`, `logo512.png`,
   `manifest.json`, `robots.txt`; `grep -l <projectId> build/assets/*.js` proves env
   inlining; `grep -c fonts.googleapis.com` on the css proves fonts; no sass deprecation
   warnings in the log.
4. `npm run preview` and click through: Google popup login (the env-var proof that matters),
   workout list, Charts page with correct line colors (the `_exports` proof; the smoke test
   never asserts colors), friends page incl. incoming/outgoing, Account + QR modal (check
   the QR background now that `styles.primary` is fixed), hard refresh on a deep route
   (SPA fallback), footer shows the version.

## Netlify cutover (ordering is load-bearing)

1. BEFORE promoting: add all 7 `VITE_FIREBASE_*` vars to the Netlify dashboard, values
   copied from the existing `REACT_APP_*` ones. Do not delete the old ones yet. Do not add
   `VITE_SENTRY_DSN` (preserves Sentry-off status quo).
2. Confirm dashboard: build command `npm run build`, publish directory `build`. Both
   unchanged by design. `.nvmrc` covers Node. Also confirm `NODE_ENV` is **not** set to
   `production` in the dashboard (audit): every build tool now lives in `devDependencies`,
   and that variable makes npm skip them. Netlify installs devDeps by default, so this is
   only a problem if someone added the variable by hand. Failure would be loud
   (`vite: not found`), not silent.
3. Merge main→prod (after the usual main PR). Optionally watch a branch deploy first: the
   log should print Node ≥ 20.19 and a clean `vite build`.
4. On the live URL, in this order: login popup, workout list, charts colors, friends,
   `/manifest.json` + `/favicon.ico` + `/robots.txt` → 200, hard refresh a deep route,
   devtools shows no Sentry requests (unchanged).
5. A day later: delete the 7 `REACT_APP_FIREBASE_*` vars (and the unused
   `REACT_APP_SENTRY_DSN`). Safe: values are baked into bundles at build time, so deleting
   dashboard vars can't break an already-deployed build. Rollback is republishing the
   previous deploy; old builds don't depend on current dashboard vars.

## Risk table

| Risk | Symptom | Guard |
|---|---|---|
| Netlify missing a `VITE_FIREBASE_*` var | Login dead on prod, silent at build | Step 1 ordering, bundle grep, login clicked first on prod |
| One of the 8 `_exports` import paths missed | tsc error on `styles.x` (the module is typed `string` once `declaration.d.ts` is gone) | tsc + the grep guard above |
| A wrong `:export` KEY (e.g. `styles.primary`) | Color undefined, no error, tsc silent (index signature) | Visual check only. This is how the FriendQRModal bug survived |
| Colors semantically broken | Wrong chart colors, no error | Visual check of Charts in preview + prod |
| `tsc --noEmit` red before phase 2 | 50 `@types/node/ffi.d.ts` parse errors | Expected. Pre-existing; cleared by the `"types"` array |
| Netlify Node < 20.19 | Loud build failure | `.nvmrc`; read the deploy log |
| `NODE_ENV=production` set in Netlify | `vite: not found` at build | Cutover step 2 |
| `VITE_SENTRY_DSN` added by accident | New Replay/tracing traffic at 1.0 sampling | Leave unset; if enabling later, lower `tracesSampleRate` first |
| `_redirects` missing from build/ | Deep links 404 on refresh | Build audit + hard refresh |
| manifest.json edited | Installed-PWA name changes | Don't touch it; verify 200 post-deploy |
| TS 5.9 / bundler resolution errors | Loud build failure | Baseline has zero `src/` errors; fallback `moduleResolution: "node"` |
| Source maps dropped | Unreadable prod stack traces, Sentry step 4 blocked | `build.sourcemap: true`; check `build/assets/*.js.map` exists |
| Accepted delta: es2020 browser floor | Pre-2020 Safari/Chrome white-screen | Accepted, see decisions |
| Accepted delta: chunking differs from CRA | Split chunks instead of single files | None needed; hashed names, no correctness risk |
| Accepted delta: no linting | exhaustive-deps warnings stop appearing in dev | Accepted; flat config is a follow-up |

## Out of scope (follow-ups)

- Convert 28 Sass `@import`s to `@use` (silenced, not fixed).
- Real name/icons in `manifest.json`.
- ESLint flat config (react-app presets die with react-scripts; there was no lint script).
- moment → date-fns chart adapter (verify chart date axes after).
- `@sentry/cli` removal (referenced by nothing), `@types/react-lottie` (dead), `src/logo.svg`
  (unused), `src/assets/animations/no-data-animation.json` (unreferenced).
- Sentry enablement per TODO.md.
