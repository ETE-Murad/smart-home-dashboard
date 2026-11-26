import { useEffect, useState } from 'react'
import { ref, onValue, query, limitToLast } from 'firebase/database'
import { db } from '../firebase'
import { listen, friendlyError, homePath } from '../services/firebaseService'
import { DEFAULT_THRESHOLDS } from '../config'

/** Latest readings + per-sensor status + temperature thresholds. */
export function useSensorData(customHomeId) {
  const [sensors, setSensors] = useState(null)
  const [sensorStatus, setSensorStatus] = useState(null)
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsubs = [
      listen(homePath('sensors', customHomeId), (v) => { setSensors(v); setLoading(false) }, (e) => { setError(friendlyError(e)); setLoading(false) }),
      listen(homePath('sensorStatus', customHomeId), setSensorStatus),
      listen(homePath('settings/temperature', customHomeId), (v) =>
        setThresholds({ ...DEFAULT_THRESHOLDS, ...(v && typeof v === 'object' ? v : {}) }),
      ),
    ]
    return () => unsubs.forEach((u) => u())
  }, [customHomeId])

  return { sensors, sensorStatus, thresholds, loading, error }
}

/** Last `count` stored records from history (written once a minute by the ESP32). */
export function useSensorHistory(count, customHomeId) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    const historyPath = homePath('history', customHomeId)
    const q = query(ref(db, historyPath), limitToLast(count))
    const unsub = onValue(
      q,
      (snap) => {
        const list = []
        snap.forEach((child) => {
          const v = child.val()
          if (v && typeof v.ts === 'number') list.push(v)
        })
        setRows(list)
        setLoading(false)
      },
      (e) => { setError(friendlyError(e)); setLoading(false) },
    )
    return unsub
  }, [count, customHomeId])

  return { rows, loading, error }
}
