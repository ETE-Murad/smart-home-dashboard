import { useState } from 'react'
import { Activity, ShieldAlert, Cpu, Sparkles } from 'lucide-react'
import MetricCard from './MetricCard'
import HistoryChart from './HistoryChart'
import RangeSelect from './RangeSelect'
import { useSensorStates } from '../hooks/useSensorStates'
import { useSensorHistory } from '../hooks/useSensorData'
import { HISTORY_RANGES } from '../config'
import { formatDateTime } from '../utils/format'

/** Shared layout for the Voltage and Current telemetry pages. */
export default function MetricPage({ title, metricKey, unit, digits, icon, color, extra }) {
  const [range, setRange] = useState('1h')
  const points = (HISTORY_RANGES.find((r) => r.key === range) || HISTORY_RANGES[0]).points
  const { values, states, updatedAt, nowMs, error } = useSensorStates()
  const history = useSensorHistory(points)
  const state = states[metricKey]
  const notConfigured = state.kind === 'not_configured'

  return (
    <div className="space-y-6">
      {/* Header & Range Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
              {title}
            </h2>
            <span className="rounded-full bg-panel2 border border-line px-2.5 py-0.5 text-xs font-bold text-accent font-mono">
              Live Stream
            </span>
          </div>
          <p className="mt-1 text-xs text-mute">
            Continuous analog telemetry with ADS1115 high-precision ADC
          </p>
        </div>

        {!notConfigured && <RangeSelect value={range} onChange={setRange} />}
      </div>

      {error && (
        <div role="alert" className="rounded-2xl border border-bad/30 bg-bad/10 p-4 text-xs font-semibold text-bad">
          {error}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard
          label={title.replace(' Monitoring', '')}
          value={values[metricKey]}
          unit={unit}
          digits={digits}
          icon={icon}
          state={state}
          updatedAt={updatedAt}
          nowMs={nowMs}
        />
        {extra && (
          <MetricCard
            {...extra.card}
            value={values[extra.key]}
            state={states[extra.key]}
            updatedAt={updatedAt}
            nowMs={nowMs}
          />
        )}
      </div>

      {/* Telemetry info bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-mute px-1">
        <span className="flex items-center gap-1.5 font-medium">
          <span
            className={`size-2 rounded-full ${
              state.kind === 'ok' ? 'bg-on animate-pulse' : 'bg-mute'
            }`}
          />
          Sensor Pipeline: <strong className="text-ink">{state.label}</strong>
        </span>
        {updatedAt && (
          <span className="font-mono text-[11px]">
            Latest payload received: {formatDateTime(updatedAt)}
          </span>
        )}
      </div>

      {/* Chart or Configuration notice */}
      {notConfigured ? (
        <div className="glass-panel rounded-2xl p-6 text-sm text-mute">
          <div className="flex items-start gap-3">
            <Cpu className="size-6 text-warn shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-ink">Sensor Disabled in Hardware Profile</h4>
              <p className="mt-1 text-xs text-mute leading-relaxed">
                This sensor bus is disabled in the ESP32 firmware definition. Connect the analog channel, configure the corresponding <code>HAS_…_SENSOR</code> flag to <code>true</code>, and compile the firmware sketch.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <HistoryChart
          title={title.replace(' Monitoring', '')}
          rows={history.rows}
          dataKey={metricKey}
          unit={unit}
          color={color}
          loading={history.loading}
        />
      )}
    </div>
  )
}
