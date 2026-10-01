# pump-track

## Releases

- Netlify deploys the `prod` branch. Work lands on `main` first, then moves to prod with a main→prod promotion PR.
- Bump `version` in package.json before opening a promotion PR into `prod`, or consciously decide not to. Nothing reads it today (not in the UI, not in manifest.json), so a missed bump is silent.
- Firebase functions deploy manually from `functions/`, never through Netlify.
