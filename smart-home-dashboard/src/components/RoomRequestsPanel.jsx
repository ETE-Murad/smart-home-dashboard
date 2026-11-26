import { useState } from 'react'
import {
  ShieldCheck,
  Check,
  X,
  Clock,
  Trash2,
  Plus,
  Edit2,
  Sparkles,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import {
  approveRoomRequest,
  rejectRoomRequest,
  dismissRoomRequest,
} from '../services/roomRequestService'
import { friendlyError } from '../services/firebaseService'
import { useToast } from '../context/ToastContext'

function timeAgo(timestamp) {
  if (!timestamp) return 'recently'
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function RequestSummary({ request }) {
  const { type, details } = request
  switch (type) {
    case 'create_room': {
      const hasDevices = Array.isArray(details.devices) && details.devices.length > 0
      return (
        <span>
          Create new room <strong className="text-ink">"{details.name}"</strong>
          {hasDevices && (
            <>
              {' '}with <span className="font-semibold text-accent">{details.devices.length} {details.devices.length === 1 ? 'component' : 'components'}</span>: [
              {details.devices.map((d, i) => (
                <span key={i}>
                  {i > 0 && ', '}
                  <strong className="text-ink">{d.name}</strong> ({d.type}, Relay {d.relay?.replace('relay', '')})
                </span>
              ))}
              ]
            </>
          )}
        </span>
      )
    }
    case 'rename_room':
      return (
        <span>
          Rename room <strong className="text-mute line-through">{details.oldName}</strong> →{' '}
          <strong className="text-ink">"{details.newName}"</strong>
        </span>
      )
    case 'delete_room':
      return (
        <span>
          Delete room <strong className="text-bad">"{details.roomName}"</strong>
          {details.deviceCount ? ` (${details.deviceCount} device(s))` : ''}
        </span>
      )
    case 'add_device':
      return (
        <span>
          Add device <strong className="text-ink">"{details.device?.name}"</strong> (
          {details.device?.type}, Relay {details.device?.relay?.replace('relay', '')}) to{' '}
          <strong className="text-ink">"{details.roomName}"</strong>
        </span>
      )
    case 'update_device':
      return (
        <span>
          Update device in <strong className="text-ink">"{details.roomName}"</strong>:{' '}
          <strong className="text-mute">{details.oldDevice?.name || 'Device'}</strong> →{' '}
          <strong className="text-ink">"{details.device?.name}"</strong> ({details.device?.type},{' '}
          Relay {details.device?.relay?.replace('relay', '')})
        </span>
      )
    case 'delete_device':
      return (
        <span>
          Remove device <strong className="text-bad">"{details.deviceName}"</strong> from{' '}
          <strong className="text-ink">"{details.roomName}"</strong>
        </span>
      )
    case 'seed_rooms':
      return <span>Generate default starter rooms with pre-assigned relays</span>
    default:
      return <span>Requested change to rooms</span>
  }
}

function TypeBadge({ type }) {
  switch (type) {
    case 'create_room':
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-on/15 px-2 py-0.5 text-xs font-semibold text-on">
          <Plus className="size-3" /> New Room
        </span>
      )
    case 'rename_room':
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
          <Edit2 className="size-3" /> Rename Room
        </span>
      )
    case 'delete_room':
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-bad/15 px-2 py-0.5 text-xs font-semibold text-bad">
          <Trash2 className="size-3" /> Delete Room
        </span>
      )
    case 'add_device':
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-on/15 px-2 py-0.5 text-xs font-semibold text-on">
          <Plus className="size-3" /> Add Device
        </span>
      )
    case 'update_device':
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
          <Edit2 className="size-3" /> Edit Device
        </span>
      )
    case 'delete_device':
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-bad/15 px-2 py-0.5 text-xs font-semibold text-bad">
          <Trash2 className="size-3" /> Remove Device
        </span>
      )
    case 'seed_rooms':
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
          <Sparkles className="size-3" /> Suggest Rooms
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-panel2 px-2 py-0.5 text-xs font-semibold text-mute">
          Change
        </span>
      )
  }
}

export default function RoomRequestsPanel({ homeId, isOwner, user, roomRequests, currentRooms }) {
  const { notify } = useToast()
  const [processingId, setProcessingId] = useState(null)
  const [err, setErr] = useState('')

  const pendingList = roomRequests?.pendingRequests || []
  const allList = roomRequests?.requests || []
  const myList = allList.filter((r) => r.requesterUid === user?.uid)

  async function handleApprove(req) {
    setErr('')
    setProcessingId(req.id)
    try {
      await approveRoomRequest(homeId, req, currentRooms)
      notify('success', 'Request approved and applied to rooms!')
    } catch (error) {
      setErr(error?.message || friendlyError(error))
      notify('error', error?.message || 'Failed to approve request.')
    } finally {
      setProcessingId(null)
    }
  }

  async function handleReject(req) {
    setErr('')
    setProcessingId(req.id)
    try {
      await rejectRoomRequest(homeId, req.id)
      notify('info', 'Request rejected.')
    } catch (error) {
      setErr(error?.message || friendlyError(error))
      notify('error', error?.message || 'Failed to reject request.')
    } finally {
      setProcessingId(null)
    }
  }

  async function handleDismiss(req) {
    try {
      await dismissRoomRequest(homeId, req.id)
    } catch {
      /* ignore */
    }
  }

  // If the owner has pending requests:
  if (isOwner && pendingList.length > 0) {
    return (
      <div className="rounded-2xl border border-accent/40 bg-accent/5 p-5 shadow-[var(--shadow)]">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-xl bg-accent text-white">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <h3 className="font-bold text-ink">
              Pending Room & Device Approval Requests ({pendingList.length})
            </h3>
            <p className="text-xs text-mute">
              Members who joined with the invite code requested the following changes. Approve to apply or Reject to discard.
            </p>
          </div>
        </div>

        {err && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-bad/15 p-3 text-xs text-bad">
            <AlertCircle className="size-4 shrink-0" />
            <span>{err}</span>
          </div>
        )}

        <div className="mt-4 space-y-3">
          {pendingList.map((req) => {
            const isBusy = processingId === req.id
            return (
              <div
                key={req.id}
                className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <TypeBadge type={req.type} />
                    <span className="text-mute">
                      Requested by <strong className="text-ink">{req.requesterEmail}</strong>
                    </span>
                    <span className="text-mute">·</span>
                    <span className="flex items-center gap-1 text-mute">
                      <Clock className="size-3" />
                      {timeAgo(req.createdAt)}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-ink">
                    <RequestSummary request={req} />
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:self-center">
                  <button
                    disabled={isBusy}
                    onClick={() => handleApprove(req)}
                    className="flex items-center gap-1.5 rounded-lg bg-on px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:brightness-110 disabled:opacity-50"
                  >
                    {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                    Approve
                  </button>
                  <button
                    disabled={isBusy}
                    onClick={() => handleReject(req)}
                    className="flex items-center gap-1.5 rounded-lg border border-line bg-panel2 px-3 py-1.5 text-xs font-semibold text-bad hover:bg-bad/10 disabled:opacity-50"
                  >
                    <X className="size-3.5" />
                    Reject
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // If a member has requests, show their status (Pending, Approved, Rejected)
  if (!isOwner && myList.length > 0) {
    const recent = myList.slice(0, 5)
    return (
      <div className="rounded-2xl border border-line bg-panel p-4 shadow-[var(--shadow)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-ink">
            <Clock className="size-4 text-accent" />
            <span>My Change Requests</span>
          </div>
          <span className="text-xs text-mute">
            {recent.filter((r) => r.status === 'pending').length} pending owner approval
          </span>
        </div>

        <div className="mt-3 space-y-2">
          {recent.map((req) => (
            <div
              key={req.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-line/60 bg-panel2/60 px-3 py-2 text-xs"
            >
              <div className="flex flex-wrap items-center gap-2">
                <TypeBadge type={req.type} />
                <span className="text-ink">
                  <RequestSummary request={req} />
                </span>
                <span className="text-mute">({timeAgo(req.createdAt)})</span>
              </div>
              <div className="flex items-center gap-2">
                {req.status === 'pending' && (
                  <span className="rounded-full bg-warn/15 px-2 py-0.5 font-bold text-warn">
                    Pending
                  </span>
                )}
                {req.status === 'approved' && (
                  <span className="rounded-full bg-on/15 px-2 py-0.5 font-bold text-on">
                    Approved
                  </span>
                )}
                {req.status === 'rejected' && (
                  <span className="rounded-full bg-bad/15 px-2 py-0.5 font-bold text-bad">
                    Rejected
                  </span>
                )}
                {req.status !== 'pending' && (
                  <button
                    onClick={() => handleDismiss(req)}
                    className="text-mute hover:text-ink"
                    title="Dismiss"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return null
}
