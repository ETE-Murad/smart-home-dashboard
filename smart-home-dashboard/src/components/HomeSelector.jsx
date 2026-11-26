import { useState, useRef, useEffect } from 'react'
import {
  House,
  ChevronDown,
  Plus,
  KeyRound,
  Check,
  Users,
  Loader2,
  X,
  Shield,
  Home as HomeIcon,
} from 'lucide-react'
import { useHome } from '../context/HomeContext'
import { useToast } from '../context/ToastContext'
import { friendlyError } from '../services/firebaseService'

export default function HomeSelector({ compact = false }) {
  const { homes, currentHome, currentHomeId, switchHome, createHome, joinHome } = useHome()
  const { notify } = useToast()

  const [open, setOpen] = useState(false)
  const [modalMode, setModalMode] = useState(null) // 'create' | 'join' | null
  const [homeName, setHomeName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const menuRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    if (!homeName.trim()) {
      return setError('Please enter a home name.')
    }
    setBusy(true)
    try {
      await createHome(homeName.trim())
      notify('success', `Created home "${homeName.trim()}"`)
      setHomeName('')
      setModalMode(null)
      setOpen(false)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin(e) {
    e.preventDefault()
    setError('')
    if (!inviteCode.trim()) {
      return setError('Please enter an invite code.')
    }
    setBusy(true)
    try {
      const res = await joinHome(inviteCode.trim())
      if (res?.status === 'pending') {
        notify('info', 'Join request submitted! You will gain access once the home owner approves.')
      } else if (res?.status === 'switched') {
        notify('success', 'Switched to home')
      } else {
        notify('success', 'Joined home successfully')
      }
      setInviteCode('')
      setModalMode(null)
      setOpen(false)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between gap-2.5 rounded-xl border border-line bg-panel2/80 px-3 py-2 text-left transition-colors hover:border-accent/60 hover:bg-panel2 cursor-pointer ${
          compact ? 'text-xs' : 'text-sm'
        }`}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand/20 text-accent">
            <House className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold leading-tight text-ink">
              {currentHome?.name || 'Smart Home'}
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-mute">
              <span className="capitalize">{currentHome?.role || 'Owner'}</span>
              <span>•</span>
              <span>{currentHome?.memberCount || 1} {currentHome?.memberCount === 1 ? 'member' : 'members'}</span>
            </div>
          </div>
        </div>
        <ChevronDown className={`size-4 shrink-0 text-mute transition-transform duration-200 ${open ? 'rotate-180 text-accent' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div className="absolute left-0 z-50 mt-2 w-72 rounded-2xl border border-line bg-panel p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2 py-1.5 text-[11px] font-bold tracking-wider text-mute uppercase">
            Your Homes ({homes.length})
          </div>

          <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {homes.map((h) => {
              const active = h.id === currentHomeId
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => {
                    switchHome(h.id)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl p-2.5 text-left text-xs transition-all cursor-pointer ${
                    active
                      ? 'bg-brand/15 text-accent font-bold border border-accent/20'
                      : 'text-mute hover:bg-panel2 hover:text-ink'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{h.name}</p>
                    <div className="flex items-center gap-1.5 text-[10px] text-mute">
                      <span className="inline-flex items-center gap-1">
                        {h.isOwner ? <Shield className="size-3 text-brand" /> : <Users className="size-3" />}
                        {h.isOwner ? 'Owner' : 'Shared member'}
                      </span>
                      <span>•</span>
                      <span>{h.memberCount} {h.memberCount === 1 ? 'member' : 'members'}</span>
                    </div>
                  </div>
                  {active && <Check className="size-4 shrink-0 text-accent" />}
                </button>
              )
            })}
          </div>

          <div className="mt-2 border-t border-line/60 pt-2 space-y-1">
            <button
              type="button"
              onClick={() => {
                setModalMode('create')
                setError('')
              }}
              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-ink hover:bg-panel2 transition-colors cursor-pointer"
            >
              <Plus className="size-4 text-accent" />
              <span>Create new home</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setModalMode('join')
                setError('')
              }}
              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-ink hover:bg-panel2 transition-colors cursor-pointer"
            >
              <KeyRound className="size-4 text-brand" />
              <span>Join with invite code</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal Dialog */}
      {modalMode && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-brand/20 text-accent">
                  {modalMode === 'create' ? <HomeIcon className="size-4" /> : <KeyRound className="size-4" />}
                </span>
                <h3 className="text-base font-extrabold text-ink">
                  {modalMode === 'create' ? 'Create a New Home' : 'Join an Existing Home'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="rounded-lg p-1 text-mute hover:bg-panel2 hover:text-ink cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {modalMode === 'create' ? (
              <form onSubmit={handleCreate} className="mt-4 space-y-4">
                <p className="text-xs text-mute leading-relaxed">
                  Set up a separate smart home with its own ESP32 device, isolated relays, and sensors. No other household can see or control your devices.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">
                    Home Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mountain Villa, Apartment 4B"
                    value={homeName}
                    onChange={(e) => setHomeName(e.target.value)}
                    maxLength={40}
                    autoFocus
                    className="w-full rounded-xl border border-line bg-panel2 px-3.5 py-2.5 text-sm text-ink placeholder:text-mute/60 focus:border-accent focus:outline-none"
                    required
                  />
                </div>

                {error && <p className="text-xs text-bad">{error}</p>}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalMode(null)}
                    className="rounded-xl border border-line px-4 py-2 text-xs font-bold text-mute hover:bg-panel2 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white shadow-md hover:brightness-110 disabled:opacity-60 cursor-pointer"
                  >
                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                    Create Home
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleJoin} className="mt-4 space-y-4">
                <p className="text-xs text-mute leading-relaxed">
                  Enter the invite code shared by the owner of the smart home (for example, <code className="text-accent font-semibold">HOME-7X9K2M</code>).
                </p>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">
                    Invite Code
                  </label>
                  <input
                    type="text"
                    placeholder="HOME-XXXXXX"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    autoFocus
                    className="w-full rounded-xl border border-line bg-panel2 px-3.5 py-2.5 font-mono text-sm tracking-wider uppercase text-ink placeholder:text-mute/60 focus:border-accent focus:outline-none"
                    required
                  />
                </div>

                {error && <p className="text-xs text-bad">{error}</p>}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalMode(null)}
                    className="rounded-xl border border-line px-4 py-2 text-xs font-bold text-mute hover:bg-panel2 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white shadow-md hover:brightness-110 disabled:opacity-60 cursor-pointer"
                  >
                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : <KeyRound className="size-3.5" />}
                    Join Home
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
