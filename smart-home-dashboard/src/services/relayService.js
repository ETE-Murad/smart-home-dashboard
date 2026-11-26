// Writes the DESIRED relay state. The ESP32 reads it, switches the GPIO pin,
// then reports the ACTUAL state under /relayStatus.
import { ref, set, update } from 'firebase/database'
import { db } from '../firebase'
import { RELAYS } from '../config'
import { withTimeout, homePath } from './firebaseService'

const IDS = RELAYS.map((r) => r.id)
const WRITE_TIMEOUT_MS = 8000

export function validateRelayId(id) {
  if (!IDS.includes(id)) throw new Error(`Unknown relay "${id}".`)
}

export function setRelayDesired(id, state, customHomeId) {
  validateRelayId(id)
  if (typeof state !== 'boolean') throw new Error('Relay state must be true (ON) or false (OFF).')
  return withTimeout(set(ref(db, homePath(`relays/${id}`, customHomeId)), state), WRITE_TIMEOUT_MS, 'Could not reach Firebase.')
}

/** One atomic write for several relays (used by All ON / All OFF). */
export function setManyRelaysDesired(ids, state, customHomeId) {
  ids.forEach(validateRelayId)
  if (typeof state !== 'boolean') throw new Error('Relay state must be true (ON) or false (OFF).')
  const changes = Object.fromEntries(ids.map((id) => [id, state]))
  return withTimeout(update(ref(db, homePath('relays', customHomeId)), changes), WRITE_TIMEOUT_MS, 'Could not reach Firebase.')
}

