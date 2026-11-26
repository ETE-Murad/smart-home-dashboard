import { Loader2, RotateCw, AlertTriangle, Cpu } from 'lucide-react'
import { getApplianceIcon } from '../icons'
import { formatDateTime } from '../utils/format'
import { playSwitchSound } from '../utils/sound'

function describe(r) {
  if (r.phase === 'submitting') return { text: 'Sending command…', cls: 'text-accent', badge: 'SYNCING' }
  if (r.phase === 'waiting') return { text: 'ESP32 confirming…', cls: 'text-accent', badge: 'WAITING' }
  if (r.phase === 'failed') return { text: r.error, cls: 'text-bad', badge: 'ERROR' }
  if (r.pending) return { text: 'Processing packet…', cls: 'text-accent', badge: 'SYNCING' }
  if (r.actual === null) return { text: 'Awaiting first telemetry', cls: 'text-mute', badge: 'UNKNOWN' }
  return r.actual ? { text: 'Operating Normally', cls: 'text-on', badge: 'ACTIVE' } : { text: 'Standby', cls: 'text-mute', badge: 'STANDBY' }
}

export default function RelayCard({ relay, canControl, disabledReason, onToggle, onRetry }) {
  const Icon = getApplianceIcon(relay.icon)
  const isOn = relay.actual === true
  const busy = relay.pending && relay.phase !== 'failed'
  const info = describe(relay)
  const disabled = !canControl || busy
  const target = !(relay.actual ?? relay.desired ?? false)

  const handleToggle = () => {
    playSwitchSound(target)
    onToggle(relay.id, target)
  }

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 ${
        isOn
          ? 'border-on/45 bg-gradient-to-br from-panel via-panel to-panel2/80 glow-ring-on shadow-lg shadow-on/10'
          : 'border-line bg-panel hover:border-accent/30 hover:bg-panel2/70 shadow-[var(--shadow)] hover:shadow-cyan-900/10'
      }`}
    >
      {/* Subtle top indicator bar */}
      <div
        className={`absolute top-0 left-0 right-0 h-1 transition-all duration-300 ${
          isOn ? 'bg-gradient-to-r from-on via-accent to-on' : 'bg-transparent'
        }`}
      />

      <div className="flex items-start justify-between gap-3">
        {/* Appliance Icon with ambient backlight when ON */}
        <div className="relative">
          {isOn && (
            <div className="pointer-events-none absolute -inset-2 rounded-2xl bg-on/25 blur-md animate-pulse" />
          )}
          <span
            className={`relative grid size-12 place-items-center rounded-2xl border transition-all duration-300 ${
              isOn
                ? 'border-on/60 bg-on/20 text-on shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                : 'border-line bg-panel2 text-mute group-hover:text-ink group-hover:border-line/80'
            }`}
          >
            <Icon className="size-6 transition-transform duration-300 group-hover:scale-110" />
          </span>
        </div>

        {/* Hardware Channel & GPIO Badge */}
        <div className="flex flex-col items-end gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-md border border-line bg-panel2/80 px-2 py-0.5 text-[10px] font-mono font-bold text-mute">
            <Cpu className="size-2.5 text-accent" />
            CH {relay.number < 10 ? `0${relay.number}` : relay.number}
            {relay.gpio ? ` · G${relay.gpio}` : ''}
          </span>

          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
              isOn
                ? 'bg-on/15 text-on border border-on/30'
                : relay.phase === 'failed'
                ? 'bg-bad/15 text-bad border border-bad/30'
                : 'bg-panel2 text-mute border border-line'
            }`}
          >
            {info.badge}
          </span>
        </div>
      </div>

      {/* Appliance Name & Status */}
      <div className="mt-4">
        <h3 className="text-base font-extrabold tracking-tight text-ink truncate" title={relay.name}>
          {relay.name}
        </h3>
        <p className={`mt-0.5 text-xs font-semibold ${info.cls} flex items-center gap-1.5`} aria-live="polite">
          <span
            className={`size-1.5 rounded-full ${
              isOn
                ? 'bg-on shadow-[0_0_6px_rgba(16,185,129,0.9)] animate-pulse'
                : relay.phase === 'failed'
                ? 'bg-bad'
                : 'bg-mute/60'
            }`}
          />
          {info.text}
        </p>
      </div>

      {/* Toggle Action & Timestamps */}
      <div className="mt-5 flex items-center justify-between border-t border-line/50 pt-4">
        {/* Tactile Switch Button */}
        <button
          type="button"
          role="switch"
          aria-checked={isOn}
          aria-label={`${relay.name}: switch ${isOn ? 'OFF' : 'ON'}`}
          disabled={disabled}
          title={disabled && !busy ? disabledReason : undefined}
          onClick={handleToggle}
          className={`relative h-9 w-16 rounded-full transition-all duration-300 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 active:scale-95 ${
            isOn
              ? 'bg-on shadow-[0_0_16px_rgba(16,185,129,0.5)] ring-2 ring-on/30'
              : 'bg-line/80 hover:bg-line'
          }`}
        >
          <span
            className={`absolute top-1 grid size-7 place-items-center rounded-full bg-white shadow-md transition-all duration-300 ease-out ${
              isOn ? 'left-8 text-on' : 'left-1 text-mute'
            }`}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin text-brand" />
            ) : (
              <span
                className={`size-2 rounded-full transition-all ${
                  isOn ? 'bg-on shadow-[0_0_6px_rgba(16,185,129,0.9)]' : 'bg-mute/40'
                }`}
              />
            )}
          </span>
        </button>

        {/* Retry or Timestamp */}
        {relay.phase === 'failed' ? (
          <button
            type="button"
            onClick={() => onRetry(relay.id)}
            className="flex items-center gap-1.5 rounded-xl border border-bad/40 bg-bad/10 px-3 py-1.5 text-xs font-bold text-bad hover:bg-bad/20 cursor-pointer transition-colors"
          >
            <RotateCw className="size-3.5" /> Retry
          </button>
        ) : (
          <div className="text-right text-[11px] text-mute">
            {relay.updatedAt ? (
              <>
                <span>Last toggle</span>
                <p className="font-mono text-ink/80 text-[10px]">{formatDateTime(relay.updatedAt)}</p>
              </>
            ) : (
              <span className="text-[10px]">Ready</span>
            )}
          </div>
        )}
      </div>

      {!canControl && disabledReason && (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-warn/10 px-2.5 py-1 text-[11px] font-semibold text-warn">
          <AlertTriangle className="size-3.5 shrink-0" />
          <span className="truncate">{disabledReason}</span>
        </p>
      )}
    </div>
  )
}
