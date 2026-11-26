import { useMemo, useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'
import { formatClock, formatDateTime } from '../utils/format'
import { Activity, RotateCcw } from 'lucide-react'
import { useHome } from '../context/HomeContext'
import { useToast } from '../context/ToastContext'
import { resetMetricHistory, resetAllHistory } from '../services/sensorService'
import ConfirmationModal from './ConfirmationModal'

export default function HistoryChart({
  title,
  rows,
  dataKey,
  unit,
  color = '#06b6d4',
  loading,
  height = 280,
  canReset,
  customHomeId,
}) {
  const { currentHome, currentHomeId } = useHome()
  const { notify } = useToast()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [clearAll, setClearAll] = useState(false)
  const [resetting, setResetting] = useState(false)

  const isOwner = canReset !== undefined ? Boolean(canReset) : Boolean(currentHome?.isOwner)
  const homeId = customHomeId || currentHomeId

  const data = useMemo(() => rows.filter((r) => typeof r[dataKey] === 'number'), [rows, dataKey])

  // Calculate high-level statistical summary
  const stats = useMemo(() => {
    if (data.length === 0) return null
    const vals = data.map((d) => d[dataKey])
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length
    const current = vals[vals.length - 1]
    return { min, max, avg, current }
  }, [data, dataKey])

  const handleConfirmReset = async () => {
    try {
      setResetting(true)
      if (clearAll) {
        await resetAllHistory(homeId)
        notify('success', `All sensor history has been reset. Graphs will start from the beginning.`)
      } else {
        await resetMetricHistory(dataKey, homeId)
        notify('success', `${title} graph has been reset. New readings will plot from the beginning.`)
      }
      setConfirmOpen(false)
    } catch (err) {
      notify('error', err?.message || `Failed to reset ${title} graph.`)
    } finally {
      setResetting(false)
    }
  }

  const gradId = `area-grad-${dataKey}`

  return (
    <div className="glass-panel relative overflow-hidden rounded-2xl p-5 shadow-[var(--shadow)]">
      {/* Header with stats pills & Owner Reset Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-panel2 text-accent border border-line">
            <Activity className="size-3.5" />
          </span>
          <div>
            <h3 className="text-sm font-extrabold text-ink">{title} Telemetry</h3>
            <p className="text-[11px] text-mute">1-minute sensor sampling buffer</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {stats && (
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
              <span className="rounded-lg border border-line bg-panel2 px-2 py-0.5 text-mute">
                Min: <strong className="text-ink">{stats.min.toFixed(1)}</strong>
              </span>
              <span className="rounded-lg border border-line bg-panel2 px-2 py-0.5 text-mute">
                Max: <strong className="text-ink">{stats.max.toFixed(1)}</strong>
              </span>
              <span className="rounded-lg border border-line bg-panel2 px-2 py-0.5 text-mute">
                Avg: <strong className="text-accent">{stats.avg.toFixed(1)}</strong>
              </span>
            </div>
          )}

          {isOwner && (
            <button
              type="button"
              onClick={() => {
                setClearAll(false)
                setConfirmOpen(true)
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel2 px-2.5 py-1 text-xs font-bold text-mute hover:text-bad hover:border-bad/40 hover:bg-bad/10 transition-colors cursor-pointer"
              title={`Reset ${title} telemetry graph from beginning`}
            >
              <RotateCcw className="size-3 text-bad" />
              <span>Reset Graph</span>
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 text-mute" style={{ height }}>
        {loading ? (
          <div className="grid h-full place-items-center">
            <div className="flex flex-col items-center gap-2">
              <span className="size-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              <p className="text-xs text-mute">Querying telemetry points…</p>
            </div>
          </div>
        ) : data.length < 2 ? (
          <div className="grid h-full place-items-center px-6 text-center text-xs text-mute">
            <p>
              Sensor sampling in progress. Historical telemetry will plot automatically after 2
              recorded intervals.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="currentColor" strokeOpacity={0.08} vertical={false} />
              <XAxis
                dataKey="ts"
                tickFormatter={formatClock}
                tick={{ fill: 'currentColor', fontSize: 11 }}
                stroke="currentColor"
                strokeOpacity={0.2}
                minTickGap={40}
              />
              <YAxis
                tick={{ fill: 'currentColor', fontSize: 11 }}
                stroke="currentColor"
                strokeOpacity={0.2}
                domain={['auto', 'auto']}
                unit={unit ? ` ${unit}` : ''}
                width={56}
              />
              <Tooltip
                labelFormatter={formatDateTime}
                formatter={(v) => [`${Number(v).toFixed(2)} ${unit || ''}`, title]}
                contentStyle={{
                  background: 'var(--panel2)',
                  border: '1px solid var(--line)',
                  borderRadius: 12,
                  boxShadow: 'var(--shadow)',
                  color: 'var(--ink)',
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                }}
              />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2.5}
                fillOpacity={1}
                fill={`url(#${gradId})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Confirmation Modal for Resetting Graph */}
      <ConfirmationModal
        open={confirmOpen}
        title={`Reset ${title} Telemetry Graph`}
        message={`Are you sure you want to reset this telemetry graph? All recorded historical data points for ${title.toLowerCase()} will be cleared. The graph will start fresh from the beginning as new readings arrive from your ESP32.`}
        confirmLabel={resetting ? 'Resetting…' : 'Reset Graph'}
        danger
        loading={resetting}
        onConfirm={handleConfirmReset}
        onCancel={() => !resetting && setConfirmOpen(false)}
      >
        <label className="flex items-start gap-2.5 text-xs text-mute cursor-pointer select-none rounded-xl border border-line bg-panel2/70 p-3 hover:bg-panel2 transition-colors">
          <input
            type="checkbox"
            checked={clearAll}
            onChange={(e) => setClearAll(e.target.checked)}
            className="mt-0.5 rounded border-line text-bad focus:ring-bad/30 cursor-pointer"
          />
          <span className="leading-snug">
            <strong className="text-ink font-semibold">Clear entire history buffer</strong>
            <br />
            Also resets all other metrics (voltage, current, temperature, and humidity).
          </span>
        </label>
      </ConfirmationModal>
    </div>
  )
}
