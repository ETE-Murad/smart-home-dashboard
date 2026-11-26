import { useEffect, useState } from 'react'
import { listen, friendlyError, homePath } from '../services/firebaseService'
import { DEVICE_OFFLINE_AFTER_SEC } from '../config'

/**
 * ESP32 online/offline, decided ONLY from the heartbeat the ESP32 writes to /device/lastSeen
 * (a Firebase server timestamp). Being connected to Firebase does not make the device "online".
 */
export function useDeviceStatus(serverOffsetMs, customHomeId) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [now, setNow] = useState(Date.now())

  useEffect(
    () =>
      listen(
        homePath('device', customHomeId),
        (value) => { setData(value); setLoading(false) },
        (err) => { setError(friendlyError(err)); setLoading(false) },
      ),
    [customHomeId],
  )

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(timer)
  }, [])

  const serverNow = now + serverOffsetMs
  const lastSeen = typeof data?.lastSeen === 'number' ? data.lastSeen : null
  const ageSec = lastSeen ? Math.max(0, (serverNow - lastSeen) / 1000) : null
  const online = ageSec !== null && ageSec <= DEVICE_OFFLINE_AFTER_SEC

  return {
    loading, error, online, lastSeen, ageSec, serverNow,
    hasHeartbeat: lastSeen !== null,
    rssi: data?.rssi ?? null,
    ip: data?.ip ?? null,
    uptimeSec: data?.uptimeSec ?? null,
    firmware: data?.fw ?? null,
  }
}
