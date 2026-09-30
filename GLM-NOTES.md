# GLM test notes

## Tests added

120 tests total: 114 passing, 6 skipped (suspected bugs, see below).

Pure utilities (58):

- `src/util/glm-parseExercise.test.ts` (7) — name/weight/sets/comment parsing, `3x8` expansion, `/` groups, persistent ids
- `src/util/glm-getTitleAndDate.test.ts` (4) — date extraction with and without a year, title lowercasing
- `src/util/glm-dateUtil.test.ts` (9) — Today/Yesterday/weekday/M-D formatting, the 11-month year cutoff, invalid input
- `src/util/glm-calculateMaxWeight.test.ts` (4)
- `src/util/glm-chartUtil.test.ts` (19) — time-period cutoffs and day arrays, rounding, chart data shaping, tick units
- `src/util/glm-getDataFromExercise.test.ts` (3) — the "prev weights" display string
- `src/util/glm-stringModifiers.test.ts` (6)
- `src/util/glm-stringArrToSelectArr.test.ts` (2)
- `src/util/glm-calculateInputWidth.test.ts` (3) — padding math and the 1.1 multiplier; jsdom reports offsetWidth 0, noted in the file

Components (33), with `services/*` mocked at the module boundary so `services/firestore.ts` and its `getAuth(app)` never load:

- `src/Components/FormInput/glm-FormInput.test.tsx` (7) — Enter/Tab suggestion completion, Enter passthrough, backspace-on-empty, clear button, suggestion overlay, fade state
- `src/Components/WorkoutInput/glm-WorkoutInput.test.tsx` (3)
- `src/Components/FriendStatusButton/glm-FriendStatusButton.test.tsx` (4) — optimistic status transitions via rendered text
- `src/Components/ExercisePR/glm-ExercisePR.test.tsx` (3)
- `src/Components/FriendsPage/UserCard/glm-UserCard.test.tsx` (8) — accept/deny/remove-confirm flows and count callbacks
- `src/Components/ExerciseChart/glm-ExerciseChart.test.tsx` (4) — time-range buttons, loading and empty states
- `src/Components/Nav/glm-Nav.test.tsx` (4) — navigation targets, logout

Services and functions (23):

- `src/services/glm-tracker-updateUniqueTitles.test.ts` (5) — title count add/remove/zero-drop logic, Firestore mocked
- `src/glm-functions.test.ts` (18) — the callable handlers from `functions/src/index.ts` (friendship status precedence, addFriend, acceptFriendRequest, removeFriend, getNumberOfFriends, updateTotalWorkoutsAndExercises, sendFriendRequestEmail) against an in-memory Firestore. `firebase-functions/v1` and `firebase-admin/*` are mocked via the exact files under `functions/node_modules` their exports map resolves to, since bare specifiers do not resolve from `src/`. The fake snapshot exposes `exists` as a boolean property to match firebase-admin, the code truthy-checks it.

## Final suite result

`Tests  114 passed | 6 skipped (120)` (files: `1 failed | 18 passed | 1 skipped (20)`)

The one failing file is the pre-existing `src/App.test.tsx`, which fails at module load with `auth/invalid-api-key` because this environment has no Firebase config. It was left alone as instructed. `npm run lint` reports 0 errors.

## Not tested, and why

- Most of `services/auth.ts`, `services/firestore.ts`, `services/friends.ts`, `services/tracker.ts`: thin wrappers that only chain Firestore/Functions SDK calls. Mocking them would test the mocks, not logic. `updateUniqueTitles` is the exception and is tested.
- `getSuggestedFriends` (both client and function): its pagination loop depends on `where().orderBy().limit().startAfter()` query chains; faking the query semantics would be testing the fake.
- Rendering the chart.js `<Line>` itself: jsdom lacks the date adapter plumbing chart.js's time scale wants; the chart-branch rendering is untested, everything around it is.
- Firestore security rules and auth-check behavior in the functions, per the task rules.
- `Pages/*` and `Layout`, `Home.tsx`, `App.tsx`: they mount most of the app at once and add little beyond what the component tests cover.

## Suspected bugs

Strongest first. All are in `src/glm-suspected-bugs.test.ts`, skipped, one comment above each with input, expectation, and actual behavior. Each was verified to fail when unskipped.

1. `src/util/chartUtil.ts:23` — `convertToTimeNumber('3-month')` and `('6-month')` subtract 2 and 3 months instead of 3 and 6 (`timePeriod === 'month' ? 1 : '3-month' ? 2 : 3`). The sibling `getStartOfDayArrayByPeriod` spans 90 and 180 days for the same periods, so the chart fetches less data than its x-axis displays.
2. `src/util/chartUtil.ts:219` — `getStepSize` computes `min - max`, always negative for ordered bounds, so the step size is always 5 and never scales to 10/15/20 as the branches intend.
3. `src/services/friends.ts:102` — accepting a friend request invokes the `sendFriendRequestEmail` cloud function instead of `sendFriendAcceptedEmail`, which exists in `functions/src/index.ts:153` and nothing calls. The new friend gets a "New Friend Request" email.
4. `functions/src/index.ts:378` — `addFriend` validates `friendUsername` twice (`!friendUID || !friendUsername || !currUID || !friendUsername`) and never `currUsername`, so a missing `currUsername` writes `friendUsername: undefined` into the friend's incoming request instead of rejecting.
5. `src/util/parseExercise.ts:54` — the weight is cleaned with `.replaceAll('[^\\d.]', '')`, a string literal rather than a regex, so it strips nothing. `parseExercise('deadlifts 100lbs 3x8')` gets `Number('100lbs')` = NaN for the weight.
6. `src/util/chartUtil.ts:144` — per-day selection in `formatChartData` picks the exercise with the largest total weight (sum across groups) but plots its max weight, while the code comment says "largest weight". A day with lifts [100, 200] and [250] plots 200 and the 250 lift disappears from the chart.

## Checked by Claude, 2026-09-28

Suite re-run: 114 pass, 6 skipped; the one failing file is the existing
src/App.test.tsx, which needs a Firebase config. No source or package files
changed. All 6 suspected bugs fail when un-skipped; getStepSize's `min - max`
(chartUtil.tsx:219) checked by eye. The functions tests always call with an
auth uid equal to the payload's currUID, so they stay valid when the
functions switch to reading the uid from the auth context.

## Before merging: this branch breaks `npm run build` (found 2026-09-29)

Codex's review caught it and Claude confirmed it. `npm run build` runs
`tsc && vite build`, and the root tsconfig includes all of `src`, so tsc
type-checks these test files. On a clean install (root only, the way Netlify
builds) that gives 80 errors: 33 because `src/glm-functions.test.ts` and
`src/glm-suspected-bugs.test.ts` import `functions/src/index.ts`, whose
`firebase-functions` and `firebase-admin` exist only in `functions/node_modules`,
and 47 strict-mode type errors inside the GLM test files. `main` gives 0.
`vitest run` still passes, which is why the first check missed it.

Fix here before merging: keep test files out of the build's tsc (an
`exclude` for `**/*.test.*` plus a separate tsconfig for tests), fix the
test types, and make the function tests say they need `npm ci` in
`functions/` first.

Also from that review: the skipped missing-currUsername test's comment is
wrong about the outcome. Firestore rejects `undefined`, so `addFriend`
writes the outgoing request and then throws on the incoming one, leaving
half a request.
