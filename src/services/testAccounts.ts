// Test accounts for the local emulators (`npm run dev:emu`). The seed script
// creates the seeded ones, and the login page shows a button for each, since
// a session driving the browser can't reach the Google popup window.
export type TestAccount = { sub: string; email: string; name: string }

export const SEEDED_TEST_ACCOUNTS = [
  {
    sub: 'google-test-alex',
    uid: 'test-alex',
    email: 'alex@example.com',
    name: 'Alex Tester',
    username: 'alextester0000001',
  },
  {
    sub: 'google-test-blair',
    uid: 'test-blair',
    email: 'blair@example.com',
    name: 'Blair Tester',
    username: 'blairtester0000002',
  },
]

// A Google account the emulator has never seen, so signing in with it runs
// the sign-up path.
export const newTestAccount = (): TestAccount => {
  const n = Date.now().toString().slice(-6)
  return { sub: `google-new-${n}`, email: `new${n}@example.com`, name: `New Tester ${n}` }
}
