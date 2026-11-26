// The ONLY place where Firebase is initialised.
// Values come from the .env file (see .env.example).
import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBScis-XFP3HauZGljn143fKhmv6tR8FtE',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'home-automation-8354f.firebaseapp.com',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://home-automation-8354f-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'home-automation-8354f',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'home-automation-8354f.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '760848692283',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:760848692283:web:312822f5ffcbdbf98bd81e',
}

const REQUIRED = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'appId']

let app = null
let db = null
let auth = null
let initError = null

try {
  const missing = REQUIRED.filter((key) => !firebaseConfig[key])
  if (missing.length > 0) {
    throw new Error(`Missing values in your .env file: ${missing.join(', ')}`)
  }
  app = initializeApp(firebaseConfig)
  db = getDatabase(app)
  auth = getAuth(app)
} catch (err) {
  initError = err.message || String(err)
}

// Safe, non-secret facts for the Settings page.
export const firebaseInfo = {
  projectId: firebaseConfig.projectId,
  databaseURL: firebaseConfig.databaseURL,
  authDomain: firebaseConfig.authDomain,
}

export { app, db, auth, initError }
