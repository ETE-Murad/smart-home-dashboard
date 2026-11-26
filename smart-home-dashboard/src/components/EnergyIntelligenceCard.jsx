import { useState } from 'react'
import {
  Zap,
  Gauge,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Receipt,
  Layers,
  Info,
} from 'lucide-react'

// Official Bangladesh Residential Electricity Tariff Slabs (BPDB / DESCO / DPDC / NESCO)
export const BANGLADESH_SLABS = [
  { id: 1, min: 0, max: 75, rate: 5.26, label: 'Slab 1 (0–75 units)', rangeText: '0–75 units' },
  { id: 2, min: 76, max: 200, rate: 8.50, label: 'Slab 2 (76–200 units)', rangeText: '76–200 units' },
  { id: 3, min: 201, max: 300, rate: 9.10, label: 'Slab 3 (201–300 units)', rangeText: '201–300 units' },
  { id: 4, min: 301, max: 400, rate: 9.62, label: 'Slab 4 (301–400 units)', rangeText: '301–400 units' },
  { id: 5, min: 401, max: 600, rate: 15.01, label: 'Slab 5 (401–600 units)', rangeText: '401–600 units' },
  { id: 6, min: 601, max: Infinity, rate: 17.35, label: 'Slab 6 (>600 units)', rangeText: 'Above 600' },
]

/**
 * Computes tiered electricity cost following Bangladesh progressive tariff brackets
 */
export function computeBangladeshBill(monthlyUnits) {
  if (monthlyUnits <= 0) {
    return {
      totalBill: 0,
      activeSlab: BANGLADESH_SLABS[0],
      breakdown: [],
      effectiveRate: BANGLADESH_SLABS[0].rate,
    }
  }

  let unitsLeft = monthlyUnits
  let totalBill = 0
  let activeSlab = BANGLADESH_SLABS[0]
  const breakdown = []

  const slabLimits = [
    { slab: BANGLADESH_SLABS[0], capacity: 75 },
    { slab: BANGLADESH_SLABS[1], capacity: 125 },
    { slab: BANGLADESH_SLABS[2], capacity: 100 },
    { slab: BANGLADESH_SLABS[3], capacity: 100 },
    { slab: BANGLADESH_SLABS[4], capacity: 200 },
    { slab: BANGLADESH_SLABS[5], capacity: Infinity },
  ]

  for (const { slab, capacity } of slabLimits) {
    if (unitsLeft <= 0) break
    activeSlab = slab
    const take = Math.min(unitsLeft, capacity)
    const cost = take * slab.rate
    totalBill += cost
    breakdown.push({
      ...slab,
      units: take,
      cost,
    })
    unitsLeft -= take
  }

  const effectiveRate = monthlyUnits > 0 ? totalBill / monthlyUnits : BANGLADESH_SLABS[0].rate

  return {
    totalBill,
    activeSlab,
    breakdown,
    effectiveRate,
  }
}

const OTHER_CURRENCIES = [
  { symbol: '৳', label: 'BDT (৳)', isSlab: true },
  { symbol: '$', label: 'USD ($)', ratePerKwh: 0.16, isSlab: false },
  { symbol: '€', label: 'EUR (€)', ratePerKwh: 0.28, isSlab: false },
  { symbol: '₹', label: 'INR (₹)', ratePerKwh: 7.20, isSlab: false },
]

export default function EnergyIntelligenceCard({ values, assignedOn, totalAssigned }) {
  const [currencyIndex, setCurrencyIndex] = useState(0) // Default to BDT (৳) with progressive slabs
  const [showSlabDetails, setShowSlabDetails] = useState(false)
  const curr = OTHER_CURRENCIES[currencyIndex]

  // Actual measured power or nominal estimation from active appliances
  const rawWatts = typeof values?.power === 'number' && values.power > 0
    ? values.power
    : assignedOn * 75 // ~75W nominal average per active appliance

  const voltage = typeof values?.voltage === 'number' && values.voltage > 100 ? values.voltage : 220.0

  const dailyKwh = (rawWatts * 24) / 1000
  const monthlyKwh = dailyKwh * 30

  // Bangladesh progressive slab calculation
  const bdCalc = computeBangladeshBill(monthlyKwh)

  // Monthly cost based on selected currency
  const monthlyCost = curr.isSlab ? bdCalc.totalBill : monthlyKwh * (curr.ratePerKwh || 8.5)
  const dailyCost = monthlyCost / 30

  // Max capacity scale 4000 Watts
  const maxCapacity = 4000
  const loadPercentage = Math.min(100, Math.round((rawWatts / maxCapacity) * 100))

  return (
    <div className="glass-panel-interactive relative overflow-hidden rounded-3xl p-6 shadow-[var(--shadow)]">
      {/* Subtle ambient glow on high power */}
      <div className={`pointer-events-none absolute -right-16 -top-16 size-44 rounded-full blur-3xl transition-opacity ${
        loadPercentage > 60 ? 'bg-warn/25 opacity-90' : 'bg-accent/15 opacity-50'
      }`} />

      {/* Header with Title and Currency Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 pb-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 text-warn border border-warn/30 shadow-inner">
            <Zap className="size-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-ink tracking-tight">Energy &amp; Power Intelligence</h3>
              <span className="rounded-full bg-on/15 border border-on/30 px-2 py-0.2 text-[10px] font-bold text-on">
                Live Analysis
              </span>
              {curr.isSlab && (
                <span className="rounded-full bg-accent/15 border border-accent/30 px-2 py-0.2 text-[10px] font-bold text-accent font-mono">
                  BD Tariff Slabs
                </span>
              )}
            </div>
            <p className="text-xs text-mute">Real-time load demand &amp; progressive slab tariff billing</p>
          </div>
        </div>

        {/* Currency Switcher */}
        <div className="flex items-center gap-1 rounded-xl border border-line bg-panel2/80 p-1">
          {OTHER_CURRENCIES.map((c, i) => (
            <button
              key={c.symbol}
              type="button"
              onClick={() => setCurrencyIndex(i)}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                i === currencyIndex
                  ? 'bg-accent text-white shadow-xs'
                  : 'text-mute hover:text-ink hover:bg-panel'
              }`}
              title={c.label}
            >
              {c.symbol}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* Real-time Wattage */}
        <div className="rounded-2xl border border-line/60 bg-panel2/50 p-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-mute">Instant Draw</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-black text-ink font-mono">{rawWatts.toFixed(0)}</span>
            <span className="text-xs font-bold text-accent font-mono">W</span>
          </div>
          <p className="mt-1 text-[11px] text-mute flex items-center gap-1 truncate">
            <span className="size-1.5 rounded-full bg-on animate-pulse" />
            {assignedOn} load{assignedOn === 1 ? '' : 's'} drawing
          </p>
        </div>

        {/* Projected Daily kWh */}
        <div className="rounded-2xl border border-line/60 bg-panel2/50 p-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-mute">Monthly Consumption</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-black text-ink font-mono">{monthlyKwh.toFixed(1)}</span>
            <span className="text-xs font-bold text-brand font-mono">Units</span>
          </div>
          <p className="mt-1 text-[11px] text-mute font-mono">~{dailyKwh.toFixed(2)} units / day</p>
        </div>

        {/* Projected Monthly Cost following Slabs */}
        <div className="rounded-2xl border border-line/60 bg-panel2/50 p-4 relative overflow-hidden">
          <span className="text-[11px] font-bold uppercase tracking-wider text-mute">Estimated Bill</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xs font-bold text-warn">{curr.symbol}</span>
            <span className="text-2xl sm:text-3xl font-black text-ink font-mono">{monthlyCost.toFixed(0)}</span>
            <span className="text-[11px] font-medium text-mute">/mo</span>
          </div>
          <p className="mt-1 text-[11px] text-mute font-mono truncate">
            {curr.isSlab ? (
              <span className="text-accent font-semibold">{bdCalc.activeSlab.label.split(' ')[0]} {bdCalc.activeSlab.label.split(' ')[1]}</span>
            ) : (
              <span>@{curr.ratePerKwh} {curr.symbol}/unit</span>
            )}
            {' · '}{curr.symbol}{dailyCost.toFixed(1)}/day
          </p>
        </div>

        {/* Active Tariff Slab Indicator */}
        <div className="rounded-2xl border border-line/60 bg-panel2/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-mute">Active Tariff Slab</span>
            <button
              type="button"
              onClick={() => setShowSlabDetails(!showSlabDetails)}
              className="text-accent hover:underline text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
            >
              <span>{showSlabDetails ? 'Hide' : 'Rates'}</span>
              {showSlabDetails ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-lg sm:text-xl font-extrabold text-ink font-mono">
              Tk {curr.isSlab ? bdCalc.activeSlab.rate.toFixed(2) : (curr.ratePerKwh || 8.5).toFixed(2)}
            </span>
            <span className="text-xs text-mute font-mono">/unit</span>
          </div>
          <p className="mt-1 text-[11px] text-accent font-semibold truncate flex items-center gap-1">
            <Receipt className="size-3 text-accent shrink-0" />
            <span>{curr.isSlab ? bdCalc.activeSlab.label : `${curr.label} Flat Rate`}</span>
          </p>
        </div>
      </div>

      {/* Expandable Bangladesh Tariff Slabs Table */}
      {showSlabDetails && (
        <div className="mt-4 rounded-2xl border border-line bg-panel2/80 p-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-3 border-b border-line/60 pb-2">
            <div className="flex items-center gap-2">
              <Receipt className="size-4 text-accent" />
              <h4 className="text-xs font-extrabold text-ink uppercase tracking-wider">
                Bangladesh Residential Tariff Structure (DESCO / BPDB)
              </h4>
            </div>
            <span className="text-[11px] font-mono text-mute">1 Unit = 1 kWh</span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 text-xs">
            {BANGLADESH_SLABS.map((slab) => {
              const isActive = curr.isSlab && bdCalc.activeSlab.id === slab.id
              return (
                <div
                  key={slab.id}
                  className={`rounded-xl border p-2.5 transition-all ${
                    isActive
                      ? 'border-on/60 bg-on/15 shadow-[0_0_12px_rgba(16,185,129,0.25)] ring-1 ring-on/40'
                      : 'border-line bg-panel/70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-ink font-mono text-[11px]">Slab {slab.id}</span>
                    {isActive && (
                      <span className="size-2 rounded-full bg-on animate-pulse" title="Current Active Bracket" />
                    )}
                  </div>
                  <p className="text-[10px] text-mute font-mono mt-0.5">{slab.rangeText}</p>
                  <p className={`mt-1 font-mono font-black text-sm ${isActive ? 'text-on' : 'text-accent'}`}>
                    Tk {slab.rate.toFixed(2)}
                    <span className="text-[10px] font-normal text-mute">/u</span>
                  </p>
                </div>
              )
            })}
          </div>

          {curr.isSlab && bdCalc.breakdown.length > 0 && (
            <div className="mt-3 pt-2 border-t border-line/50 flex flex-wrap items-center justify-between text-[11px] text-mute font-mono">
              <span>
                Calculation for <strong className="text-ink">{monthlyKwh.toFixed(1)} units</strong>:
                {' '}{bdCalc.breakdown.map((b) => `${b.units.toFixed(0)}u @ Tk${b.rate}`).join(' + ')}
              </span>
              <span>
                Average Effective: <strong className="text-accent">Tk {bdCalc.effectiveRate.toFixed(2)} / unit</strong>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Capacity Load Bar */}
      <div className="mt-5 rounded-2xl border border-line/40 bg-panel2/30 p-4">
        <div className="flex items-center justify-between text-xs mb-2">
          <div className="flex items-center gap-1.5 font-bold text-ink">
            <Gauge className="size-3.5 text-accent" />
            <span>Facility Capacity Utilization</span>
          </div>
          <span className="font-mono text-xs font-bold text-ink">
            {loadPercentage}% ({rawWatts.toFixed(0)}W / {maxCapacity}W)
          </span>
        </div>

        <div className="h-2.5 w-full rounded-full bg-panel2 overflow-hidden border border-line/50 p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              loadPercentage > 80
                ? 'bg-gradient-to-r from-warn via-orange-500 to-bad'
                : loadPercentage > 40
                ? 'bg-gradient-to-r from-accent via-cyan-500 to-amber-400'
                : 'bg-gradient-to-r from-emerald-500 to-cyan-400'
            }`}
            style={{ width: `${Math.max(4, loadPercentage)}%` }}
          />
        </div>

        <div className="mt-2 flex justify-between text-[10px] text-mute font-mono">
          <span>0 kW (Eco Standby)</span>
          <span>2.0 kW (Standard)</span>
          <span>4.0 kW (Household Max)</span>
        </div>
      </div>
    </div>
  )
}
