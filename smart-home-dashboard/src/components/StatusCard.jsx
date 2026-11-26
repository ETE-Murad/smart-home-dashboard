const TONE_CONFIG = {
  neutral: {
    iconCls: 'text-accent bg-accent/15 border-accent/25',
    pill: 'text-accent bg-accent/10',
    bar: 'bg-accent',
  },
  on: {
    iconCls: 'text-on bg-on/15 border-on/25',
    pill: 'text-on bg-on/10',
    bar: 'bg-on',
  },
  off: {
    iconCls: 'text-off bg-off/15 border-off/25',
    pill: 'text-off bg-off/10',
    bar: 'bg-off',
  },
  bad: {
    iconCls: 'text-bad bg-bad/15 border-bad/25',
    pill: 'text-bad bg-bad/10',
    bar: 'bg-bad',
  },
  warn: {
    iconCls: 'text-warn bg-warn/15 border-warn/25',
    pill: 'text-warn bg-warn/10',
    bar: 'bg-warn',
  },
}

export default function StatusCard({ label, value, sub, icon: Icon, tone = 'neutral', badge }) {
  const config = TONE_CONFIG[tone] || TONE_CONFIG.neutral

  return (
    <div className="glass-panel-interactive relative overflow-hidden rounded-2xl p-5">
      {/* Decorative subtle ambient corner glow */}
      <div className="pointer-events-none absolute -top-12 -right-12 size-24 rounded-full bg-current opacity-10 blur-xl" />

      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-mute">
          {label}
        </span>
        <span
          className={`grid size-10 place-items-center rounded-xl border shadow-xs transition-transform group-hover:scale-105 ${config.iconCls}`}
        >
          <Icon className="size-5" />
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <p className="text-3xl font-extrabold tracking-tight text-ink font-mono sm:text-4xl">
          {value}
        </p>
        {badge && (
          <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${config.pill}`}>
            {badge}
          </span>
        )}
      </div>

      {sub && (
        <p className="mt-2 text-xs font-medium text-mute flex items-center gap-1.5 truncate">
          <span className={`size-1.5 rounded-full ${config.bar}`} />
          {sub}
        </p>
      )}
    </div>
  )
}
