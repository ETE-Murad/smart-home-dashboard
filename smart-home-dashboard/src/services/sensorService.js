import { ref, set, get, remove, update } from 'firebase/database'
import { db } from '../firebase'
import { SENSOR_STALE_SEC } from '../config'
import { homePath } from './firebaseService'

export function saveTemperatureThresholds({ warn, critical }, customHomeId) {
  const w = Number(warn)
  const c = Number(critical)
  if (!Number.isFinite(w) || !Number.isFinite(c)) throw new Error('Enter numbers for both thresholds.')
  if (w < -20 || c > 100) throw new Error('Thresholds must be between -20 and 100 °C.')
  if (w >= c) throw new Error('The warning threshold must be lower than the critical threshold.')
  return set(ref(db, homePath('settings/temperature', customHomeId)), { warn: w, critical: c })
}

/**
 * Reset historical telemetry points for a specific metric (e.g. 'voltage', 'current', 'temperature', 'humidity').
 * Clears the metric field across stored history records so that the graph starts clean from the beginning.
 */
export async function resetMetricHistory(metricKey, customHomeId) {
  const hPath = homePath('history', customHomeId)
  const historyRef = ref(db, hPath)
  const snap = await get(historyRef)
  if (!snap.exists()) return

  const updates = {}
  snap.forEach((child) => {
    const val = child.val()
    if (val && val[metricKey] !== undefined) {
      updates[`${hPath}/${child.key}/${metricKey}`] = null
    }
  })

  if (Object.keys(updates).length > 0) {
    await update(ref(db), updates)
  }
}

/**
 * Reset all historical telemetry records for this home entirely.
 */
export async function resetAllHistory(customHomeId) {
  const hPath = homePath('history', customHomeId)
  await remove(ref(db, hPath))
}

/**
 * Decide what to show for one reading. Never invents a value.
 * status: "ok" | "error" | "not_configured" (written by the ESP32 under /sensorStatus)
 */
export function getSensorState({ value, status, updatedAt, nowMs }) {
  if (status === 'not_configured') return { kind: 'not_configured', label: 'Sensor not configured' }
  if (updatedAt == null) return { kind: 'waiting', label: 'Waiting for sensor data' }
  if (status === 'error') return { kind: 'error', label: 'Sensor error' }
  if (typeof value !== 'number' || !Number.isFinite(value)) return { kind: 'waiting', label: 'Waiting for sensor data' }
  if ((nowMs - updatedAt) / 1000 > SENSOR_STALE_SEC) return { kind: 'stale', label: 'No recent update' }
  return { kind: 'ok', label: 'Live' }
}
