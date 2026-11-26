import { HISTORY_RANGES } from '../config'

export default function RangeSelect({ value, onChange }) {
  return (
    <div
      role="group"
      aria-label="History range selector"
      className="inline-flex rounded-xl border border-line bg-panel2 p-1 shadow-inner"
    >
      {HISTORY_RANGES.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => onChange(r.key)}
          aria-pressed={value === r.key}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
            value === r.key
              ? 'bg-accent text-white shadow-xs'
              : 'text-mute hover:text-ink'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
