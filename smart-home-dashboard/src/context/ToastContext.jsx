import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'

const ToastContext = createContext({ notify: () => {} })
export const useToast = () => useContext(ToastContext)

const STYLES = {
  success: { Icon: CheckCircle2, border: 'border-on/40', bg: 'bg-panel/95', iconCls: 'text-on' },
  error: { Icon: AlertTriangle, border: 'border-bad/40', bg: 'bg-panel/95', iconCls: 'text-bad' },
  info: { Icon: Info, border: 'border-accent/40', bg: 'bg-panel/95', iconCls: 'text-accent' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const notify = useCallback(
    (type, message) => {
      const id = crypto.randomUUID()
      setToasts((t) => [...t.slice(-3), { id, type, message }])
      setTimeout(() => dismiss(id), type === 'error' ? 7000 : 4000)
    },
    [dismiss],
  )
  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed bottom-5 right-5 left-5 sm:left-auto z-50 flex flex-col gap-2.5 sm:w-96"
        aria-live="polite"
      >
        {toasts.map(({ id, type, message }) => {
          const cfg = STYLES[type] || STYLES.info
          const Icon = cfg.Icon
          return (
            <div
              key={id}
              role="status"
              className={`flex items-start gap-3 rounded-2xl border ${cfg.border} ${cfg.bg} p-4 shadow-2xl backdrop-blur-md transition-all animate-in slide-in-from-bottom-2 duration-200`}
            >
              <Icon className={`mt-0.5 size-4.5 shrink-0 ${cfg.iconCls}`} />
              <p className="flex-1 text-xs font-semibold text-ink leading-relaxed">{message}</p>
              <button
                onClick={() => dismiss(id)}
                aria-label="Dismiss notification"
                className="text-mute hover:text-ink cursor-pointer p-0.5"
              >
                <X className="size-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
