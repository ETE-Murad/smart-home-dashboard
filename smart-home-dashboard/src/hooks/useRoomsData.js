import { useEffect, useMemo, useState } from 'react'
import { listen, friendlyError, homePath } from '../services/firebaseService'
import { RELAYS } from '../config'

const RELAY_IDS = RELAYS.map((r) => r.id)

/** Reads /settings/rooms in real time. Independent of relay state, so labels can be used anywhere. */
export function useRoomsData(customHomeId) {
  const [raw, setRaw] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(
    () => listen(homePath('settings/rooms', customHomeId),
      (v) => { setRaw(v && typeof v === 'object' ? v : {}); setLoading(false) },
      (e) => { setError(friendlyError(e)); setLoading(false) }),
    [customHomeId],
  )

  const rooms = useMemo(
    () => Object.entries(raw)
      .map(([id, r]) => ({
        id,
        name: typeof r?.name === 'string' ? r.name : 'Room',
        createdAt: typeof r?.createdAt === 'number' ? r.createdAt : 0,
        devices: Object.entries(r?.devices || {})
          .map(([did, d]) => ({ id: did, name: d?.name || 'Device', type: d?.type, relay: d?.relay }))
          .filter((d) => RELAY_IDS.includes(d.relay))
          .sort((a, b) => RELAY_IDS.indexOf(a.relay) - RELAY_IDS.indexOf(b.relay)),
      }))
      .sort((a, b) => a.createdAt - b.createdAt),
    [raw],
  )

  const deviceByRelay = useMemo(() => {
    const map = {}
    rooms.forEach((room) => room.devices.forEach((d) => { map[d.relay] = { ...d, roomId: room.id, roomName: room.name } }))
    return map
  }, [rooms])

  return { rooms, deviceByRelay, loading, error }
}
