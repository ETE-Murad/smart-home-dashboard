import { Thermometer, Droplets, Sparkles, Wind } from 'lucide-react'
import { fmt, timeAgo } from '../utils/format'
import { computeHeatIndex, getComfortStatus } from '../utils/climate'

export default function TemperatureCard({
  temperature,
  humidity,
  state,
  thresholds,
  updatedAt,
  nowMs,
}) {
  const hasValue = state.kind === 'ok' || state.kind === 'stale'
  const feelsLike = hasValue ? computeHeatIndex(temperature, humidity) : null
  const comfort = hasValue ? getComfortStatus(temperature, humidity) : null

  let levelText = comfort?.label || 'Optimal Climate'
  let levelColor = 'text-on bg-on/10 border-on/30'
  let tempColor = 'text-ink'

  if (hasValue && temperature >= thresholds.critical) {
    tempColor = 'text-bad'
    levelText = 'Critical Heat'
    levelColor = 'text-bad bg-bad/10 border-bad/30'
  } else if (hasValue && temperature >= thresholds.warn) {
    tempColor = 'text-warn'
    levelText = 'High Temp'
    levelColor = 'text-warn bg-warn/10 border-warn/30'
  } else if (comfort?.tone === 'warn') {
    levelColor = 'text-warn bg-warn/10 border-warn/30'
  }

  return (
    <div className="glass-panel-interactive relative overflow-hidden rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-mute">
            Climate &amp; Atmosphere
          </span>
          {hasValue && (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${levelColor}`}
            >
              <Sparkles className="size-2.5" />
              {levelText}
            </span>
          )}
        </div>
        <span className="grid size-9 place-items-center rounded-xl border border-accent/20 bg-accent/10 text-accent">
          <Thermometer className="size-4.5" />
        </span>
      </div>

      {hasValue ? (
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-y-2">
          {/* Temperature */}
          <div>
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl sm:text-4xl font-extrabold tracking-tight font-mono ${tempColor}`}>
                {fmt(temperature, 1)}
              </span>
              <span className="text-base font-bold text-accent font-mono">°C</span>
            </div>
            <p className="text-[11px] font-medium text-mute mt-0.5 flex items-center gap-1">
              <span>DHT11 Bus</span>
              {feelsLike !== null && (
                <>
                  <span className="text-mute/40">•</span>
                  <span className="text-accent font-mono">Feels {feelsLike}°C</span>
                </>
              )}
            </p>
          </div>

          {/* Humidity */}
          <div className="rounded-xl border border-line bg-panel2/80 px-3 py-1.5 flex items-center gap-2.5">
            <Droplets className="size-4 text-brand" />
            <div>
              <div className="flex items-baseline gap-0.5">
                <span className="text-lg font-extrabold text-ink font-mono">{fmt(humidity, 0)}</span>
                <span className="text-xs font-bold text-mute">%</span>
              </div>
              <p className="text-[10px] text-mute">Relative Humidity</p>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-base font-semibold text-mute py-2">{state.label}</p>
      )}

      {/* Comfort range slider preview */}
      {hasValue && (
        <div className="mt-4">
          <div className="flex justify-between text-[10px] text-mute mb-1 font-mono">
            <span>Safe (&lt;{thresholds.warn}°C)</span>
            <span>Warn ({thresholds.warn}°C)</span>
            <span>Alert ({thresholds.critical}°C+)</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-line/60 overflow-hidden flex">
            <div className="h-full bg-on" style={{ width: '60%' }} />
            <div className="h-full bg-warn" style={{ width: '25%' }} />
            <div className="h-full bg-bad" style={{ width: '15%' }} />
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-mute">
        <span>Sensor: DHT11 Digital Bus</span>
        <span>{updatedAt ? timeAgo(Math.max(0, (nowMs - updatedAt) / 1000)) : 'No telemetry'}</span>
      </div>
    </div>
  )
}
