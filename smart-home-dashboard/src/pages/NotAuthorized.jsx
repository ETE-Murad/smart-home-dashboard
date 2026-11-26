import { useState } from 'react'
import { ShieldAlert, Copy, LogOut, Check, Lock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function NotAuthorized() {
  const { user, signOut } = useAuth()
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(user.uid)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  return (
    <main className="grid min-h-screen place-items-center p-4 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 -left-40 size-80 rounded-full bg-warn/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 size-80 rounded-full bg-bad/10 blur-[120px]" />

      <div className="relative z-10 w-full max-w-lg glass-panel rounded-3xl p-8 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-warn/15 border border-warn/30 text-warn">
            <Lock className="size-6" />
          </span>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-warn">Security Gateway</span>
            <h1 className="text-xl font-black text-ink tracking-tight">Authorization Required</h1>
          </div>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-mute">
          Signed in as <strong className="text-ink">{user?.email}</strong>. Security policies enforce that only accounts registered in the database <code>/admins</code> node have command permission on this hardware instance.
        </p>

        <div className="mt-4 rounded-2xl border border-line bg-panel2 p-4">
          <p className="text-[11px] font-bold text-mute uppercase tracking-wider mb-1.5">
            Your Operator UID
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-xs text-accent break-all bg-panel px-3 py-2 rounded-xl border border-line">
              {user?.uid}
            </code>
            <button
              onClick={copy}
              type="button"
              className="flex items-center gap-1.5 rounded-xl border border-line bg-panel px-3 py-2 text-xs font-bold text-ink hover:text-accent cursor-pointer transition-colors"
            >
              {copied ? <Check className="size-3.5 text-on" /> : <Copy className="size-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-line/60 pt-4">
          <span className="text-[11px] text-mute">Sifat&apos;s Home Automation Security</span>
          <button
            onClick={signOut}
            type="button"
            className="flex items-center gap-2 rounded-xl border border-line bg-panel2 px-4 py-2 text-xs font-bold text-mute hover:text-bad cursor-pointer transition-colors"
          >
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>
      </div>
    </main>
  )
}
