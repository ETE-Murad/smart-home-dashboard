import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ToggleRight,
  Power,
  PowerOff,
  CircuitBoard,
  Zap,
  Activity,
  Gauge,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Radio,
  Sliders,
  CheckCircle2,
  Clock,
  Home as HomeIcon,
  Layers,
  Moon,
  Sun,
  Sunrise,
  Sunset,
} from 'lucide-react'
import StatusCard from '../components/StatusCard'
import MetricCard from '../components/MetricCard'
import TemperatureCard from '../components/TemperatureCard'
import ConfirmationModal from '../components/ConfirmationModal'
import EnergyIntelligenceCard from '../components/EnergyIntelligenceCard'
import { useDashboard } from '../context/DashboardData'
import { useSensorStates } from '../hooks/useSensorStates'
import { useToast } from '../context/ToastContext'
import { getApplianceIcon } from '../icons'
import { timeAgo, formatDateTime } from '../utils/format'
import { playSwitchSound } from '../utils/sound'
import { computeHeatIndex, getComfortStatus } from '../utils/climate'

export default function Dashboard() {
  const { device, relayState, roomView, home } = useDashboard()
  const { values, states, thresholds, updatedAt, nowMs } = useSensorStates()
  const { counts, setAll, anyPending, request } = relayState
  const { notify } = useToast()
  const [modalAction, setModalAction] = useState(null) // { target: boolean, title: string }

  const assignedDevices = useMemo(
    () => (roomView?.rooms || []).flatMap((r) => r.devices || []),
    [roomView?.rooms]
  )
  const totalAssigned = assignedDevices.length
  const assignedOn = assignedDevices.filter((d) => d.relay?.actual === true).length
  const assignedOff = totalAssigned - assignedOn

  // Dynamic greeting & astro icon based on hour
  const hour = new Date().getHours()
  let greeting = 'Good evening'
  let GreetingIcon = Moon
  if (hour >= 5 && hour < 12) {
    greeting = 'Good morning'
    GreetingIcon = Sunrise
  } else if (hour >= 12 && hour < 17) {
    greeting = 'Good afternoon'
    GreetingIcon = Sun
  } else if (hour >= 17 && hour < 21) {
    greeting = 'Good evening'
    GreetingIcon = Sunset
  }

  // Active load percentage
  const activePercent = totalAssigned > 0 ? Math.round((assignedOn / totalAssigned) * 100) : 0

  // Indoor climate comfort
  const hasTemp = states.temperature.kind === 'ok' || states.temperature.kind === 'stale'
  const feelsLike = hasTemp ? computeHeatIndex(values.temperature, values.humidity) : null
  const comfort = hasTemp ? getComfortStatus(values.temperature, values.humidity) : null

  // Recent activity: devices with latest toggles
  const recentActivity = useMemo(() => {
    return assignedDevices
      .filter((d) => d.relay?.updatedAt)
      .sort((a, b) => (b.relay?.updatedAt || 0) - (a.relay?.updatedAt || 0))
      .slice(0, 4)
  }, [assignedDevices])

  // Master Switch Action with immediate, helpful feedback
  const handleMasterAction = (target) => {
    if (!device.online) {
      notify('error', 'ESP32 Gateway is offline. Ensure ESP32 is powered and connected to Wi-Fi.')
      return
    }
    if (totalAssigned === 0) {
      notify('warn', 'No appliances configured yet. Please configure rooms first.')
      return
    }
    if (target && assignedOn === totalAssigned) {
      notify('info', 'All appliances are already turned ON.')
      return
    }
    if (!target && assignedOn === 0) {
      notify('info', 'All appliances are already turned OFF.')
      return
    }

    setModalAction({
      target,
      title: target ? 'Master Switch: Turn All Appliances ON' : 'Eco Standby: Turn All Appliances OFF',
    })
  }

  return (
    <div className="space-y-8">
      {/* Hero Commercial Hub Header */}
      <section className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-panel via-panel2/70 to-panel p-6 sm:p-8 shadow-[var(--shadow)]">
        <div className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-accent/15 blur-3xl animate-pulse" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 size-80 rounded-full bg-brand/15 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-bold text-accent shadow-xs">
                <Sparkles className="size-3.5" />
                <span>Sifat&apos;s Home Automation</span>
                <span className="size-1 rounded-full bg-accent" />
                <span className="text-mute font-mono">v2.4 Pro</span>
              </span>

              {comfort && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
                    comfort.tone === 'on'
                      ? 'border-on/30 bg-on/10 text-on'
                      : comfort.tone === 'warn'
                      ? 'border-warn/30 bg-warn/10 text-warn'
                      : 'border-accent/30 bg-accent/10 text-accent'
                  }`}
                >
                  <Sparkles className="size-3" />
                  <span>{comfort.label}</span>
                  {feelsLike !== null && (
                    <span className="font-mono text-mute/80">• Feels {feelsLike}°C</span>
                  )}
                </span>
              )}
            </div>

            <h2 className="text-2xl font-black tracking-tight sm:text-3xl text-ink flex items-center gap-2.5">
              <GreetingIcon className="size-7 text-accent" />
              <span>{greeting}, {home?.name || 'Smart Facility'}</span>
            </h2>

            <p className="text-sm font-medium text-mute max-w-2xl">
              Modular multi-node hardware bus active. Gateway reports{' '}
              <strong className="text-ink font-semibold">
                {device.online ? 'Healthy telemetry & sub-second sync' : 'Gateway awaiting reconnection'}
              </strong>
              .
            </p>
          </div>

          {/* Master Power & Quick Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleMasterAction(false)}
              className="flex items-center gap-2 rounded-xl border border-line bg-panel2 px-4 py-2.5 text-xs font-bold text-ink shadow-xs transition-all hover:bg-panel hover:border-bad/40 hover:text-bad cursor-pointer active:scale-95"
              title="Turn all connected appliances OFF"
            >
              <PowerOff className="size-4 text-mute" />
              <span>All Off (Eco)</span>
            </button>

            <button
              type="button"
              onClick={() => handleMasterAction(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-cyan-600/20 hover:brightness-110 transition-all cursor-pointer active:scale-95"
              title="Turn all connected appliances ON"
            >
              <Power className="size-4" />
              <span>All On</span>
            </button>

            <Link
              to="/relays"
              className="flex items-center gap-1.5 rounded-xl border border-line bg-panel px-4 py-2.5 text-xs font-bold text-accent hover:border-accent/40 transition-colors"
            >
              <span>Switch Board</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>

        {/* Live Grid Health strip */}
        <div className="relative z-10 mt-6 grid grid-cols-2 gap-3 border-t border-line/60 pt-6 sm:grid-cols-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-on/15 text-on border border-on/25">
              <ShieldCheck className="size-4.5" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-mute">Security</p>
              <p className="text-xs font-extrabold text-ink">Role-Based Access</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-accent/15 text-accent border border-accent/25">
              <Radio className="size-4.5" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-mute">Sync Latency</p>
              <p className="text-xs font-extrabold text-ink font-mono">&lt; 150 ms Live</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-brand/15 text-brand border border-brand/25">
              <CircuitBoard className="size-4.5" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-mute">N Nodes</p>
              <p className="text-xs font-extrabold text-ink">ESP32 #1 to #N</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-warn/15 text-warn border border-warn/25">
              <Zap className="size-4.5" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-mute">Active Load</p>
              <p className="text-xs font-extrabold text-ink font-mono">{activePercent}% Grid Demand</p>
            </div>
          </div>
        </div>
      </section>

      {/* KPI Status Row */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Facility KPI Metrics">
        <StatusCard
          label="Total Appliances"
          value={totalAssigned}
          sub={totalAssigned > 0 ? `${assignedOn} ON · ${assignedOff} Standby` : 'Configure in Room Management'}
          icon={ToggleRight}
          tone="neutral"
          badge="Modular Bus"
        />
        <StatusCard
          label="Appliances Active"
          value={assignedOn}
          sub={assignedOn > 0 ? `${assignedOn} active under load` : 'All appliances powered down'}
          icon={Power}
          tone="on"
          badge={totalAssigned > 0 ? `${activePercent}%` : '0%'}
        />
        <StatusCard
          label="Grid Power Demand"
          value={typeof values?.power === 'number' && values.power > 0 ? `${values.power.toFixed(1)} W` : `${assignedOn * 75} W`}
          sub={assignedOn > 0 ? `${assignedOn} appliances drawing load` : 'Zero active load draw'}
          icon={Zap}
          tone={assignedOn > 0 ? 'on' : 'neutral'}
          badge={assignedOn > 0 ? 'Active Load' : 'Eco Standby'}
        />
        <StatusCard
          label="Hardware Gateway"
          value={device.online ? 'Online' : 'Offline'}
          sub={device.hasHeartbeat ? `Heartbeat ${timeAgo(device.ageSec)}` : 'No heartbeat packet'}
          icon={CircuitBoard}
          tone={device.online ? 'on' : 'bad'}
          badge={device.online ? 'Healthy Bus' : 'Alert'}
        />
      </section>

      {/* Real-time Energy Intelligence Cockpit Card */}
      <EnergyIntelligenceCard
        values={values}
        assignedOn={assignedOn}
        totalAssigned={totalAssigned}
      />

      {/* Live Environmental & Power Telemetry */}
      <section aria-label="Live Telemetry">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold tracking-tight text-ink sm:text-lg">
              Live Sensor Telemetry
            </h3>
            <p className="text-xs text-mute">Continuous sampling from DHT11 &amp; electrical sensors</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-on animate-pulse" />
            <span className="text-xs font-mono font-semibold text-mute">20s refresh</span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="md:col-span-2 xl:col-span-1">
            <TemperatureCard
              temperature={values.temperature}
              humidity={values.humidity}
              state={states.temperature}
              thresholds={thresholds}
              updatedAt={updatedAt}
              nowMs={nowMs}
            />
          </div>
          <MetricCard
            label="Grid Voltage"
            value={values.voltage}
            unit="V"
            digits={1}
            icon={Zap}
            state={states.voltage}
            updatedAt={updatedAt}
            nowMs={nowMs}
          />
          <MetricCard
            label="Total Current"
            value={values.current}
            unit="A"
            digits={2}
            icon={Activity}
            state={states.current}
            updatedAt={updatedAt}
            nowMs={nowMs}
          />
          <MetricCard
            label="Active Power"
            value={values.power}
            unit="W"
            digits={1}
            icon={Gauge}
            state={states.power}
            updatedAt={updatedAt}
            nowMs={nowMs}
          />
        </div>
      </section>

      {/* Commercial Rooms Overview with In-Place Interactive Toggles */}
      <section aria-label="Rooms and zones">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-extrabold tracking-tight text-ink sm:text-lg">
              Facility Rooms &amp; Zones
            </h3>
            <p className="text-xs text-mute">Instant in-place appliance actuation per room</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/rooms"
              className="text-xs font-bold text-mute hover:text-ink transition-colors"
            >
              Configure Rooms
            </Link>
            <Link
              to="/relays"
              className="flex items-center gap-1 rounded-xl bg-panel2 border border-line px-3 py-1.5 text-xs font-bold text-accent hover:border-accent/40 transition-colors"
            >
              <span>All Switches</span>
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>

        {roomView.rooms.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8 text-center">
            <HomeIcon className="mx-auto size-10 text-mute/50" />
            <h4 className="mt-3 text-sm font-bold text-ink">No facility rooms configured yet</h4>
            <p className="mx-auto mt-1 max-w-sm text-xs text-mute">
              Group your lights, climate units, and power sockets into organized rooms for faster monitoring.
            </p>
            <Link
              to="/rooms"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white hover:brightness-110"
            >
              Create Rooms Now
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {roomView.rooms.map((room) => {
              const onCount = room.devices.filter((d) => d.relay?.actual === true).length
              return (
                <div
                  key={room.id}
                  className="glass-panel-interactive rounded-2xl p-5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-line/60 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="grid size-8 place-items-center rounded-lg bg-panel2 text-accent border border-line">
                          <Layers className="size-4" />
                        </span>
                        <div>
                          <h4 className="text-sm font-bold text-ink">{room.name}</h4>
                          <p className="text-[11px] text-mute">{room.devices.length} devices mapped</p>
                        </div>
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          onCount > 0 ? 'bg-on/15 text-on border border-on/30' : 'bg-panel2 text-mute border border-line'
                        }`}
                      >
                        {onCount} of {room.devices.length} ON
                      </span>
                    </div>

                    <div className="mt-3 space-y-2">
                      {room.devices.length === 0 ? (
                        <p className="text-xs text-mute py-2">No appliances configured in this room.</p>
                      ) : (
                        room.devices.map((d) => {
                          const Icon = getApplianceIcon(d.type)
                          const r = d.relay
                          const isOn = r?.actual === true
                          const isBusy = r?.pending && r?.phase !== 'failed'
                          return (
                            <div
                              key={d.id}
                              className="flex items-center justify-between rounded-xl border border-line/50 bg-panel2/40 px-3 py-2 text-xs transition-colors hover:bg-panel2/70"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Icon
                                  className={`size-4 shrink-0 transition-colors ${
                                    isOn ? 'text-on drop-shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'text-mute'
                                  }`}
                                />
                                <span className="truncate font-semibold text-ink">{d.name}</span>
                              </div>

                              {/* Interactive In-Place Toggle Switch */}
                              <button
                                type="button"
                                disabled={!device.online || isBusy}
                                onClick={() => {
                                  playSwitchSound(!isOn)
                                  request(d.relayId, !isOn)
                                }}
                                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold font-mono transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 active:scale-95 ${
                                  isBusy
                                    ? 'bg-accent/20 text-accent animate-pulse border border-accent/40'
                                    : isOn
                                    ? 'bg-on/20 text-on border border-on/40 hover:bg-on/30 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                                    : 'bg-panel2 text-mute border border-line hover:border-accent/40 hover:text-ink'
                                }`}
                                title={`Click to switch ${d.name} ${isOn ? 'OFF' : 'ON'}`}
                              >
                                <span
                                  className={`size-1.5 rounded-full ${
                                    isBusy
                                      ? 'bg-accent animate-ping'
                                      : isOn
                                      ? 'bg-on shadow-[0_0_4px_rgba(16,185,129,0.9)] animate-pulse'
                                      : 'bg-mute/40'
                                  }`}
                                />
                                <span>{isBusy ? 'Sync…' : isOn ? 'ON' : 'OFF'}</span>
                              </button>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-line/40 flex justify-end">
                    <Link
                      to="/relays"
                      className="text-[11px] font-bold text-accent hover:underline flex items-center gap-1"
                    >
                      Control Room Switches <ArrowRight className="size-3" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Live System Activity Stream */}
      {recentActivity.length > 0 && (
        <section aria-label="Recent activity log">
          <div className="glass-panel rounded-2xl p-5 shadow-[var(--shadow)]">
            <div className="flex items-center justify-between border-b border-line/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-lg bg-panel2 text-accent border border-line">
                  <Activity className="size-3.5" />
                </span>
                <div>
                  <h4 className="text-xs font-extrabold text-ink uppercase tracking-wider">Live System Activity Stream</h4>
                  <p className="text-[11px] text-mute">Recent hardware telemetry and actuation events</p>
                </div>
              </div>
              <span className="font-mono text-[10px] text-on flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-on animate-pulse" />
                Real-time
              </span>
            </div>

            <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
              {recentActivity.map((d) => {
                const isOn = d.relay?.actual === true
                return (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-xl border border-line bg-panel2/40 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink">{d.name}</p>
                      <p className="font-mono text-[10px] text-mute">
                        {d.relay?.updatedAt ? timeAgo(Math.max(0, (nowMs - d.relay.updatedAt) / 1000)) : 'Recently'}
                      </p>
                    </div>

                    <span
                      className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        isOn
                          ? 'bg-on/15 text-on border border-on/30'
                          : 'bg-panel2 text-mute border border-line'
                      }`}
                    >
                      {isOn ? 'Active ON' : 'Standby'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Confirmation Modal for Master All On/Off */}
      <ConfirmationModal
        open={modalAction !== null}
        title={modalAction?.title || 'Confirm Action'}
        message={
          modalAction?.target
            ? 'Every connected appliance across all rooms will switch ON simultaneously. Ensure high-current loads are safe.'
            : 'Every connected appliance across all rooms will turn OFF immediately.'
        }
        confirmLabel={modalAction?.target ? 'Turn ON All' : 'Turn OFF All'}
        danger={modalAction?.target}
        onCancel={() => setModalAction(null)}
        onConfirm={() => {
          const act = modalAction
          setModalAction(null)
          if (act) {
            playSwitchSound(act.target)
            setAll(act.target, null)
          }
        }}
      />
    </div>
  )
}
