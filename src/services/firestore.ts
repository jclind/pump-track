import { initializeApp } from 'firebase/app'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import { getAnalytics } from 'firebase/analytics'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions'

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

// Initialize Firebase
export const app = initializeApp(firebaseConfig)
export const firebaseFunctions = getFunctions()
export const auth = getAuth(app)

// `npm run dev:emu` sets this, and nothing else does. The ports match
// firebase.json.
export const emulatorsOn = import.meta.env.VITE_USE_EMULATORS === 'true'

// The IndexedDB cache lets reads work offline and keeps queued writes across
// a reload. The emulators throw their data away on every restart, so a cache
// kept from the last run would show stale documents; they get the default
// memory cache.
export const db = initializeFirestore(
  app,
  emulatorsOn
    ? {}
    : {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      }
)
if (emulatorsOn) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8085)
  connectFunctionsEmulator(firebaseFunctions, '127.0.0.1', 5001)
}
export const analytics = emulatorsOn ? null : getAnalytics(app)
