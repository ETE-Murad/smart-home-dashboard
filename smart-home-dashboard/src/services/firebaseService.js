// Small helpers shared by every other service and hook.
import { ref, onValue } from 'firebase/database'
import { db } from '../firebase'

let currentHomeId = null

export function setActiveHomeId(id) {
  currentHomeId = id || null
}

export function getActiveHomeId() {
  return currentHomeId
}

/** Resolves a relative path to the active home namespace (e.g. 'relays' -> 'homes/<homeId>/relays') */
export function homePath(subpath, customHomeId) {
  const hid = customHomeId || currentHomeId
  if (!hid) return subpath
  const cleanSub = subpath ? (subpath.startsWith('/') ? subpath.slice(1) : subpath) : ''
  return cleanSub ? `homes/${hid}/${cleanSub}` : `homes/${hid}`
}

/** Subscribe to a path. Returns the unsubscribe function (use it in useEffect cleanup). */
export function listen(path, onData, onError) {
  return onValue(
    ref(db, path),
    (snapshot) => onData(snapshot.val()),
    (error) => onError?.(error),
  )
}

export const isPermissionDenied = (err) =>
  /permission[_ ]denied/i.test(`${err?.code ?? ''} ${err?.message ?? ''}`)

/** Turn a Firebase error into a sentence a person can act on. */
export function friendlyError(err) {
  const raw = `${err?.code ?? ''} ${err?.message ?? ''}`
  if (isPermissionDenied(err)) {
    return 'Permission denied by database security rules. Verify your account is authorized for this home.'
  }
  if (/auth\/email-already-in-use/.test(raw)) {
    return 'An account with this email already exists. Sign in instead.'
  }
  if (/auth\/weak-password/.test(raw)) {
    return 'Password is too weak. Please use at least 6 characters.'
  }
  if (/auth\/operation-not-allowed/.test(raw)) {
    return 'Email/password accounts are not enabled in your Firebase Authentication console.'
  }
  if (/auth\/(invalid-credential|wrong-password|user-not-found|invalid-email)/.test(raw)) {
    return 'Wrong email or password.'
  }
  if (/auth\/too-many-requests/.test(raw)) return 'Too many attempts. Wait a few minutes and try again.'
  if (/auth\/network-request-failed|network/i.test(raw)) return 'Network problem. Check your internet connection.'
  if (/timeout|timed out/i.test(raw)) return 'The request timed out. Check your connection and try again.'
  return err?.message || 'Something went wrong. Please try again.'
}

export function withTimeout(promise, ms, message) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}
