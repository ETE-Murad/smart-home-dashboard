export const formatDateTime = (ms) =>
  ms ? new Date(ms).toLocaleString([], { dateStyle: 'medium', timeStyle: 'medium' }) : '—'

export const formatClock = (ms) =>
  ms ? new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'

export function timeAgo(sec) {
  if (sec == null) return 'never'
  if (sec < 5) return 'just now'
  if (sec < 60) return `${Math.round(sec)} s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)} h ago`
  return `${Math.floor(sec / 86400)} d ago`
}

export function formatUptime(sec) {
  if (sec == null) return '—'
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`
}

export const fmt = (value, digits = 1) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—'
