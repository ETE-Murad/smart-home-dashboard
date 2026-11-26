import { createContext, useCallback, useContext, useMemo } from 'react'
import { useFirebaseConnection } from '../hooks/useFirebaseConnection'
import { useDeviceStatus } from '../hooks/useDeviceStatus'
import { useRelays } from '../hooks/useRelays'
import { useSensorData } from '../hooks/useSensorData'
import { useRoomsData } from '../hooks/useRoomsData'
import { useRoomRequests } from '../hooks/useRoomRequests'
import { useHome } from './HomeContext'
import { useToast } from './ToastContext'

const DashboardContext = createContext(null)
export const useDashboard = () => useContext(DashboardContext)

/** Starts every real-time listener ONCE; pages just read from this. */
export function DashboardDataProvider({ children }) {
  const { notify } = useToast()
  const { currentHomeId, currentHome } = useHome()
  const connection = useFirebaseConnection()
  const device = useDeviceStatus(connection.offsetMs, currentHomeId)
  const roomsData = useRoomsData(currentHomeId)
  const roomRequests = useRoomRequests(currentHomeId)

  const labelFor = useCallback(
    (relayId) => roomsData.deviceByRelay[relayId]
      ? `${roomsData.deviceByRelay[relayId].roomName} ${roomsData.deviceByRelay[relayId].name}`
      : `Switch ${relayId.replace('relay', '')}`,
    [roomsData.deviceByRelay],
  )

  const relayState = useRelays({ homeId: currentHomeId, deviceOnline: device.online, notify, labelFor })
  const sensorState = useSensorData(currentHomeId)

  // Rooms with live relay state attached to every device; relays nobody uses are listed separately.
  const roomView = useMemo(() => {
    const byId = Object.fromEntries(relayState.relays.map((r) => [r.id, r]))
    const rooms = roomsData.rooms.map((room) => ({
      ...room,
      devices: room.devices.map((d) => ({ ...d, relay: byId[d.relay], relayId: d.relay })),
    }))
    const unassigned = relayState.relays.filter((r) => !roomsData.deviceByRelay[r.id])
    return { rooms, unassigned, loading: roomsData.loading, error: roomsData.error }
  }, [roomsData, relayState.relays])

  return (
    <DashboardContext.Provider
      value={{
        connection,
        device,
        relayState,
        sensorState,
        roomsData,
        roomView,
        roomRequests,
        homeId: currentHomeId,
        home: currentHome,
        nowMs: device.serverNow,
      }}
    >
      {children}
    </DashboardContext.Provider>
  )
}
