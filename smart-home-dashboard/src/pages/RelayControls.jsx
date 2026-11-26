import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Power,
  PowerOff,
  Search,
  Filter,
  CheckCircle2,
  SlidersHorizontal,
  Layers,
  Sparkles,
  Zap,
} from 'lucide-react'
import RelayCard from '../components/RelayCard'
import ConfirmationModal from '../components/ConfirmationModal'
import { useDashboard } from '../context/DashboardData'
import { playSwitchSound } from '../utils/sound'

export default function RelayControls() {
  const { device, connection, relayState, roomView } = useDashboard()
  const { relays, loading, error, request, retry, setAll, anyPending } = relayState
  const [bulk, setBulk] = useState(null) // { target, ids, scope }
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'on' | 'off'

  const assignedRelayIds = useMemo(
    () => roomView.rooms.flatMap((r) => r.devices.map((d) => d.relayId)),
    [roomView.rooms]
  )
  const totalAssignedDevices = assignedRelayIds.length

  const reason = connection.status !== 'connected'
    ? 'Not connected to Cloud.'
    : !device.online
    ? 'ESP32 Gateway is offline.'
    : null
  const canControl = !loading && !reason

  const ask = (target, ids, scope) => setBulk({ target, ids, scope })

  // Filter helper for devices & relays
  const matchesFilter = (name, actualState) => {
    const q = searchQuery.toLowerCase().trim()
    const matchesSearch = !q || name.toLowerCase().includes(q)
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'on' && actualState === true) ||
      (statusFilter === 'off' && actualState === false)
    return matchesSearch && matchesStatus
  }

  if (loading || roomView.loading) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
        <span className="size-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        <p className="text-sm font-semibold text-mute">Initializing switch telemetry bus…</p>
      </div>
    )
  }

  const grid = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-4'

  return (
    <div className="space-y-8">
      {/* Top Header & Master Batch Controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl text-ink">
              Switch Board &amp; Controls
            </h2>
            <span className="rounded-full bg-panel2 border border-line px-2.5 py-0.5 text-xs font-bold text-accent font-mono">
              {totalAssignedDevices} {totalAssignedDevices === 1 ? 'Device' : 'Devices'}
            </span>
          </div>
          <p className="mt-1 text-xs text-mute">
            Hardware-addressed appliances with sub-second synchronization
          </p>
        </div>

        {/* Master Power Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={!canControl || anyPending || totalAssignedDevices === 0}
            onClick={() => ask(true, assignedRelayIds, 'all assigned appliances')}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:brightness-110 disabled:opacity-50 cursor-pointer transition-all"
          >
            <Power className="size-4" />
            <span>Master All ON</span>
          </button>

          <button
            type="button"
            disabled={!canControl || anyPending || totalAssignedDevices === 0}
            onClick={() => ask(false, assignedRelayIds, 'all assigned appliances')}
            className="flex items-center gap-2 rounded-xl border border-line bg-panel2 px-4 py-2.5 text-xs font-bold text-ink hover:bg-panel hover:border-bad/40 disabled:opacity-50 cursor-pointer transition-all"
          >
            <PowerOff className="size-4 text-mute" />
            <span>Master All OFF</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-mute" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search appliance, switch number, or room..."
            className="w-full rounded-xl border border-line bg-panel2 pl-10 pr-4 py-2 text-xs text-ink placeholder:text-mute focus:border-accent focus:outline-none transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-mute mr-1 hidden sm:inline">Filter:</span>
          {[
            { id: 'all', label: 'All Switches' },
            { id: 'on', label: 'Active (ON)' },
            { id: 'off', label: 'Standby (OFF)' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                statusFilter === f.id
                  ? 'bg-accent text-white shadow-sm'
                  : 'border border-line bg-panel2 text-mute hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Warnings & Alerts */}
      {error && (
        <div role="alert" className="rounded-2xl border border-bad/30 bg-bad/10 p-4 text-xs font-semibold text-bad">
          {error}
        </div>
      )}

      {relays.every((r) => r.actual === null) && device.online && (
        <div className="rounded-2xl border border-warn/30 bg-warn/10 p-4 text-xs font-medium text-warn">
          Gateway active. Telemetry packets will populate switch states automatically upon first sync.
        </div>
      )}

      {/* Rooms Sections */}
      {roomView.rooms.length === 0 && (
        <div className="glass-panel rounded-2xl p-6 text-sm text-mute">
          No rooms created yet. Group your switches by room in{' '}
          <Link to="/rooms" className="font-bold text-accent hover:underline">
            Room Management
          </Link>
          .
        </div>
      )}

      {roomView.rooms.map((room) => {
        const matchingDevices = room.devices.filter((d) =>
          matchesFilter(`${room.name} ${d.name}`, d.relay?.actual)
        )
        const ids = room.devices.map((d) => d.relayId)
        const onCount = room.devices.filter((d) => d.relay?.actual === true).length

        if (searchQuery && matchingDevices.length === 0) return null

        return (
          <section key={room.id} aria-label={room.name} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-2">
              <div className="flex items-center gap-2.5">
                <span className="grid size-7 place-items-center rounded-lg bg-panel2 text-accent border border-line">
                  <Layers className="size-3.5" />
                </span>
                <h3 className="text-base font-extrabold text-ink">{room.name}</h3>
                <span className="rounded-full bg-panel2 border border-line px-2.5 py-0.5 text-xs font-semibold text-mute">
                  <strong className="text-ink">{onCount}</strong> of {room.devices.length} ON
                </span>
              </div>

              {room.devices.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    disabled={!canControl || anyPending}
                    onClick={() => ask(true, ids, room.name)}
                    className="rounded-lg border border-line bg-panel2 px-3 py-1 text-xs font-bold text-ink hover:bg-on/15 hover:text-on hover:border-on/30 disabled:opacity-50 cursor-pointer transition-colors"
                  >
                    Room ON
                  </button>
                  <button
                    disabled={!canControl || anyPending}
                    onClick={() => ask(false, ids, room.name)}
                    className="rounded-lg border border-line bg-panel2 px-3 py-1 text-xs font-bold text-ink hover:bg-panel hover:text-bad disabled:opacity-50 cursor-pointer transition-colors"
                  >
                    Room OFF
                  </button>
                </div>
              )}
            </div>

            {room.devices.length === 0 ? (
              <p className="text-xs text-mute py-2">
                No appliances in this room.{' '}
                <Link to="/rooms" className="font-bold text-accent hover:underline">
                  Add one
                </Link>
                .
              </p>
            ) : (
              <div className={grid}>
                {matchingDevices.map((d) => (
                  <RelayCard
                    key={d.id}
                    relay={{ ...d.relay, name: d.name, icon: d.type }}
                    canControl={canControl}
                    disabledReason={reason}
                    onToggle={request}
                    onRetry={retry}
                  />
                ))}
              </div>
            )}
          </section>
        )
      })}

      {/* Empty State when no devices are assigned yet */}
      {totalAssignedDevices === 0 && (
        <div className="glass-panel flex flex-col items-center justify-center rounded-2xl p-8 text-center">
          <span className="grid size-12 place-items-center rounded-xl bg-accent/15 text-accent mb-3">
            <SlidersHorizontal className="size-6" />
          </span>
          <h3 className="text-base font-bold text-ink">No Appliances Assigned Yet</h3>
          <p className="mt-1 max-w-sm text-xs text-mute">
            Switches only appear here once assigned to an appliance in a room.
          </p>
          <Link
            to="/rooms"
            className="mt-4 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-white shadow-sm hover:brightness-110 transition-all"
          >
            Go to Room Management &rarr;
          </Link>
        </div>
      )}

      {/* Master Confirmation Dialog */}
      <ConfirmationModal
        open={bulk !== null}
        title={bulk?.target ? `Turn ${bulk?.scope} ON?` : `Turn ${bulk?.scope} OFF?`}
        message={
          bulk?.target
            ? 'Every selected actuator will switch on simultaneously. Please verify high-draw equipment (pumps, compressors, heaters) is clear.'
            : 'Every selected actuator will power down immediately.'
        }
        confirmLabel={bulk?.target ? 'Turn ON' : 'Turn OFF'}
        danger={bulk?.target}
        onCancel={() => setBulk(null)}
        onConfirm={() => {
          const b = bulk
          setBulk(null)
          if (b) {
            playSwitchSound(b.target)
            setAll(b.target, b.ids)
          }
        }}
      />
    </div>
  )
}
