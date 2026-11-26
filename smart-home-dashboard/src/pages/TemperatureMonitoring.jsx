import { useState } from 'react'
import { Droplets, Thermometer, Sparkles } from 'lucide-react'
import TemperatureCard from '../components/TemperatureCard'
import MetricCard from '../components/MetricCard'
import HistoryChart from '../components/HistoryChart'
import RangeSelect from '../components/RangeSelect'
import { useSensorStates } from '../hooks/useSensorStates'
import { useSensorHistory } from '../hooks/useSensorData'
import { HISTORY_RANGES } from '../config'
import { formatDateTime } from '../utils/format'

export default function TemperatureMonitoring() {
  const [range, setRange] = useState('1h')
  const points = (HISTORY_RANGES.find((r) => r.key === range) || HISTORY_RANGES[0]).points
  const { values, states, thresholds, updatedAt, nowMs, error } = useSensorStates()
  const history = useSensorHistory(points)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
              Climate &amp; Environmental Telemetry
            </h2>
            <span className="rounded-full bg-panel2 border border-line px-2.5 py-0.5 text-xs font-bold text-accent font-mono">
              DHT11 Bus
            </span>
          </div>
          <p className="mt-1 text-xs text-mute">
            Live thermal &amp; humidity dynamics with safety threshold triggers
          </p>
        </div>

        <RangeSelect value={range} onChange={setRange} />
      </div>

      {error && (
        <div role="alert" className="rounded-2xl border border-bad/30 bg-bad/10 p-4 text-xs font-semibold text-bad">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <TemperatureCard
          temperature={values.temperature}
          humidity={values.humidity}
          state={states.temperature}
          thresholds={thresholds}
          updatedAt={updatedAt}
          nowMs={nowMs}
        />
        <MetricCard
          label="Relative Humidity"
          value={values.humidity}
          unit="%"
          digits={0}
          icon={Droplets}
          state={states.humidity}
          updatedAt={updatedAt}
          nowMs={nowMs}
        />
      </div>

      {/* Status Info */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-mute px-1">
        <span className="flex items-center gap-1.5 font-medium">
          <span
            className={`size-2 rounded-full ${
              states.temperature.kind === 'ok' ? 'bg-on animate-pulse' : 'bg-mute'
            }`}
          />
          Sensor Pipeline: <strong className="text-ink">{states.temperature.label}</strong>
          <span className="text-mute/60 hidden sm:inline">•</span>
          <span className="hidden sm:inline">
            Warning at {thresholds.warn}°C · Critical at {thresholds.critical}°C
          </span>
        </span>
        {updatedAt && (
          <span className="font-mono text-[11px]">
            Latest payload: {formatDateTime(updatedAt)}
          </span>
        )}
      </div>

      {/* Side-by-side area charts */}
      <div className="grid gap-4 xl:grid-cols-2">
        <HistoryChart
          title="Ambient Temperature"
          rows={history.rows}
          dataKey="temperature"
          unit="°C"
          color="#06b6d4"
          loading={history.loading}
        />
        <HistoryChart
          title="Relative Humidity"
          rows={history.rows}
          dataKey="humidity"
          unit="%"
          color="#3b82f6"
          loading={history.loading}
        />
      </div>
    </div>
  )
}
