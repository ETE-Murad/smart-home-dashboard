import { useEffect, useRef } from 'react'
import { AlertTriangle, ShieldAlert } from 'lucide-react'

export default function ConfirmationModal({
  open,
  title,
  message,
  confirmLabel,
  danger,
  loading = false,
  onConfirm,
  onCancel,
  children,
}) {
  const cancelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && !loading && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel, loading])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => !loading && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-line bg-panel p-6 shadow-2xl animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-center gap-3">
          <span
            className={`grid size-10 place-items-center rounded-xl border ${
              danger
                ? 'border-bad/30 bg-bad/15 text-bad'
                : 'border-accent/30 bg-accent/15 text-accent'
            }`}
          >
            {danger ? <AlertTriangle className="size-5" /> : <ShieldAlert className="size-5" />}
          </span>
          <h2 id="modal-title" className="text-lg font-black tracking-tight text-ink">
            {title}
          </h2>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-mute">{message}</p>

        {children && <div className="mt-4">{children}</div>}

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            ref={cancelRef}
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="rounded-xl border border-line bg-panel2 px-4 py-2.5 text-xs font-bold text-mute hover:text-ink hover:bg-panel cursor-pointer transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:brightness-110 active:scale-95 cursor-pointer disabled:opacity-50 inline-flex items-center gap-2 ${
              danger
                ? 'bg-gradient-to-r from-red-600 to-rose-600 shadow-red-600/25'
                : 'bg-gradient-to-r from-cyan-600 to-blue-600 shadow-cyan-600/25'
            }`}
          >
            {loading && <span className="size-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
