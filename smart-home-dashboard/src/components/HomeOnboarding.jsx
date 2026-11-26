import { useState } from 'react'
import { House, KeyRound, Plus, LogIn, Loader2, LogOut, ShieldCheck, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useHome } from '../context/HomeContext'
import { useToast } from '../context/ToastContext'
import { friendlyError } from '../services/firebaseService'

export default function HomeOnboarding() {
  const { user, signOut } = useAuth()
  const { createHome, joinHome } = useHome()
  const { notify } = useToast()

  const [tab, setTab] = useState('create') // 'create' | 'join'
  const [homeName, setHomeName] = useState(`${(user?.email || 'My').split('@')[0]}'s Smart Home`)
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [pendingJoin, setPendingJoin] = useState(null)

  async function handleCreate(e) {
    e.preventDefault()
    setErr('')
    const name = homeName.trim()
    if (!name) return setErr('Please enter a home name.')
    setBusy(true)
    try {
      await createHome(name)
      notify('success', `Created "${name}"!`)
    } catch (error) {
      setErr(error?.message || friendlyError(error))
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin(e) {
    e.preventDefault()
    setErr('')
    const code = joinCode.trim().toUpperCase()
    if (!code) return setErr('Please enter a room invite code.')
    setBusy(true)
    try {
      const res = await joinHome(code)
      if (res?.status === 'pending') {
        setPendingJoin({ code, homeName: res.homeName || 'Smart Home' })
        notify('info', 'Join request sent to owner! Waiting for approval.')
      } else {
        notify('success', 'Joined home successfully!')
      }
    } catch (error) {
      setErr(error?.message || friendlyError(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center p-4 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 -left-40 size-80 rounded-full bg-cyan-600/10 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 size-80 rounded-full bg-blue-600/15 blur-[100px]" />
      <div className="relative z-10 w-full max-w-lg glass-panel rounded-3xl p-8 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-500 text-white shadow-lg shadow-cyan-600/20">
              <House className="size-6" />
            </span>
            <div>
              <h2 className="text-xs font-bold tracking-wider text-accent uppercase">Sifat&apos;s Home Setup</h2>
              <h1 className="text-xl font-black text-ink tracking-tight">Facility Provisioning</h1>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-xs text-mute hover:text-ink cursor-pointer"
            title="Sign out"
          >
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>

        <p className="mt-4 text-xs text-mute">
          Signed in as <strong className="text-ink">{user?.email}</strong>. Choose what you would like to do to get started:
        </p>

        {pendingJoin && (
          <div className="mt-4 rounded-xl border border-accent/40 bg-accent/10 p-4">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="size-5 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-ink">Join Request Submitted</p>
                <p className="text-xs text-mute mt-1">
                  Your request to join <strong className="text-ink">"{pendingJoin.homeName}"</strong> (Code:{' '}
                  <code className="text-accent font-semibold">{pendingJoin.code}</code>) has been sent to the owner. You will gain access once they approve.
                </p>
                <p className="text-xs font-semibold text-accent mt-2">
                  While you wait, you can also create your own smart home below!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Choice Switcher */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => { setTab('create'); setErr('') }}
            className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center cursor-pointer transition-all ${
              tab === 'create'
                ? 'border-accent bg-accent/10 text-accent font-bold shadow-sm'
                : 'border-line bg-panel2 text-mute hover:text-ink'
            }`}
          >
            <House className="size-6" />
            <div>
              <div className="text-sm">Create Own Room</div>
              <div className="text-[10px] font-normal text-mute mt-0.5">Admin of your own hardware</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => { setTab('join'); setErr('') }}
            className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center cursor-pointer transition-all ${
              tab === 'join'
                ? 'border-accent bg-accent/10 text-accent font-bold shadow-sm'
                : 'border-line bg-panel2 text-mute hover:text-ink'
            }`}
          >
            <KeyRound className="size-6" />
            <div>
              <div className="text-sm">Join with Code</div>
              <div className="text-[10px] font-normal text-mute mt-0.5">Access an existing household</div>
            </div>
          </button>
        </div>

        {/* Choice 1: Create Home */}
        {tab === 'create' && (
          <form onSubmit={handleCreate} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-mute">
                Home Name
                <input
                  type="text"
                  maxLength={40}
                  value={homeName}
                  onChange={(e) => setHomeName(e.target.value)}
                  placeholder="e.g. My Smart Home"
                  className="mt-1 w-full rounded-xl border border-line bg-panel2 px-4 py-2.5 text-sm font-semibold text-ink focus:border-accent focus:outline-none"
                  required
                />
              </label>
              <p className="mt-1.5 text-[11px] text-mute leading-relaxed">
                You will be the owner with full control over relays, rooms, and devices. You can also invite other users or join additional homes anytime.
              </p>
            </div>

            {err && (
              <p role="alert" className="rounded-lg bg-bad/10 border border-bad/30 p-2.5 text-xs text-bad">
                {err}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-bold text-white shadow-md hover:brightness-110 disabled:opacity-60 cursor-pointer"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Create My Smart Home
            </button>
          </form>
        )}

        {/* Choice 2: Join with Code */}
        {tab === 'join' && (
          <form onSubmit={handleJoin} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-mute">
                Household Invite Code / Room Key
                <input
                  type="text"
                  maxLength={20}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. HOME-7X9K2M"
                  className="mt-1 w-full rounded-xl border border-line bg-panel2 px-4 py-2.5 font-mono text-sm font-bold tracking-widest text-accent focus:border-accent focus:outline-none"
                  required
                />
              </label>
              <p className="mt-1.5 text-[11px] text-mute leading-relaxed">
                Enter the invite code shared by the home owner. You can still create your own private smart home anytime later from the dashboard menu.
              </p>
            </div>

            {err && (
              <p role="alert" className="rounded-lg bg-bad/10 border border-bad/30 p-2.5 text-xs text-bad">
                {err}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-bold text-white shadow-md hover:brightness-110 disabled:opacity-60 cursor-pointer"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              Join with Room Key
            </button>
          </form>
        )}

        <div className="mt-6 border-t border-line/60 pt-4 text-center">
          <p className="text-[11px] text-mute">
            💡 Multi-home enabled: Whether you create or join first, you can belong to multiple homes and switch between them seamlessly.
          </p>
        </div>
      </div>
    </main>
  )
}
