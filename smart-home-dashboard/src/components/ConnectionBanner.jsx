import { WifiOff, CircuitBoard, Radio, AlertTriangle } from 'lucide-react'

/** Firebase and ESP32 gateway telemetry alert banners */
export default function ConnectionBanner({ firebaseStatus, device }) {
  return (
    <>
      {firebaseStatus === 'disconnected' && (
        <div
          role="alert"
          className="flex items-center justify-center gap-2.5 bg-gradient-to-r from-red-600 via-rose-600 to-red-600 px-4 py-2 text-xs font-bold text-white shadow-md"
        >
          <WifiOff className="size-4 animate-bounce" />
          <span>Cloud Connection Interrupted. Synchronizing background retry pipeline…</span>
        </div>
      )}

      {firebaseStatus === 'connected' && !device.loading && !device.online && (
        <div
          role="status"
          className="flex items-center justify-center gap-2.5 border-b border-warn/30 bg-warn/15 px-4 py-2 text-xs font-semibold text-warn backdrop-blur-sm"
        >
          <CircuitBoard className="size-4 shrink-0" />
          <span>
            {device.hasHeartbeat
              ? 'ESP32 Gateway Node is currently offline (heartbeat missed). Relay actuation is locked until link is restored.'
              : 'Awaiting initial heartbeat broadcast from ESP32 Gateway Node. Ensure microcontroller is powered and connected to Wi-Fi.'}
          </span>
        </div>
      )}
    </>
  )
}
