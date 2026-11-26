import { fmt, timeAgo } from '../utils/format'

const STATE_STYLE = {
  ok: { text: 'text-on', dot: 'bg-on', badge: 'bg-on/15 text-on border-on/30' },
  stale: { text: 'text-warn', dot: 'bg-warn', badge: 'bg-warn/15 text-warn border-warn/30' },
  error: { text: 'text-bad', dot: 'bg-bad', badge: 'bg-bad/15 text-bad border-bad/30' },
  waiting: { text: 'text-mute', dot: 'bg-mute', badge: 'bg-panel2 text-mute border-line' },
  not_configured: { text: 'text-mute', dot: 'bg-mute', badge: 'bg-panel2 text-mute border-line' },
}

export default function MetricCard({
  label,
  value,
  unit,
  digits = 1,
  icon: Icon,
  state,
  updatedAt,
  nowMs,
  valueClass = '',
}) {
  const hasValue = state.kind === 'ok' || state.kind === 'stale'
  const style = STATE_STYLE[state.kind] || STATE_STYLE.waiting

  // Calculate subtle progress gauge percentage for visual telemetry if numeric
  let gaugePercent = null
  if (hasValue && typeof value === 'number') {
    if (unit === 'V') gaugePercent = Math.min(100, Math.max(0, ((value - 180) / 70) * 100)) // 180V - 250V range
    else if (unit === 'A') gaugePercent = Math.min(100, Math.max(0, (value / 20) * 100))     // 0 - 20A range
    else if (unit === 'W') gaugePercent = Math.min(100, Math.max(0, (value / 4400) * 100))   // 0 - 4.4kW range
    else if (unit === '%') gaugePercent = Math.min(100, Math.max(0, value))                   // 0 - 100%
  }

  return (
    <div className="glass-panel-interactive relative overflow-hidden rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-mute">
          {label}
        </span>
        <span className="grid size-9 place-items-center rounded-xl border border-accent/20 bg-accent/10 text-accent">
          <Icon className="size-4.5" />
        </span>
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        {hasValue ? (
          <div className="flex items-baseline gap-1.5">
            <span className={`text-3xl sm:text-4xl font-extrabold tracking-tight text-ink font-mono ${valueClass}`}>
              {fmt(value, digits)}
            </span>
            <span className="text-sm font-bold text-accent font-mono">{unit}</span>
          </div>
        ) : (
          <p className="text-base font-semibold text-mute py-1">{state.label}</p>
        )}

        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.badge}`}
        >
          <span className={`size-1.5 rounded-full ${style.dot} ${state.kind === 'ok' ? 'animate-pulse' : ''}`} />
          {state.kind === 'ok' ? 'LIVE' : state.label}
        </span>
      </div>

      {/* Mini Gauge bar if applicable */}
      {gaugePercent !== null && (
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-line/60">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              gaugePercent > 85 ? 'bg-warn' : 'bg-gradient-to-r from-accent to-brand'
            }`}
            style={{ width: `${gaugePercent}%` }}
          />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-mute">
        <span>Channel: Real-time ADS1115</span>
        <span>{updatedAt ? `Synced ${timeAgo((nowMs - updatedAt) / 1000)}` : 'Awaiting data'}</span>
      </div>
    </div>
  )
}
