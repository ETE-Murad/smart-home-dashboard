import { useState } from 'react'
import {
  Layers,
  LogIn,
  UserPlus,
  Loader2,
  Eye,
  EyeOff,
  ShieldCheck,
  KeyRound,
  House,
  Radio,
  Cpu,
  Lock,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { friendlyError } from '../services/firebaseService'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [signupChoice, setSignupChoice] = useState('create') // 'create' | 'join'
  const [homeName, setHomeName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const isSignUp = mode === 'signup'

  const switchMode = (newMode) => {
    setMode(newMode)
    setError('')
    setConfirmPassword('')
  }

  async function submit(e) {
    e.preventDefault()
    setError('')

    const cleanEmail = email.trim()
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      return setError('Enter a valid email address.')
    }
    if (password.length < 6) {
      return setError('Password must be at least 6 characters.')
    }
    if (isSignUp && password !== confirmPassword) {
      return setError('Passwords do not match.')
    }
    if (isSignUp && signupChoice === 'join' && !inviteCode.trim()) {
      return setError('Please enter a room invite code.')
    }

    setBusy(true)
    try {
      if (isSignUp) {
        sessionStorage.setItem(
          'shd_signup_action',
          JSON.stringify({
            action: signupChoice,
            homeName: homeName.trim(),
            joinCode: inviteCode.trim().toUpperCase(),
          }),
        )
        await signUp(cleanEmail, password)
      } else {
        await signIn(cleanEmail, password)
      }
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const field =
    'mt-1.5 w-full rounded-xl border border-line bg-panel2/90 px-4 py-2.5 text-sm text-ink placeholder:text-mute/60 focus:border-accent focus:outline-none transition-colors'

  return (
    <main className="min-h-screen grid place-items-center p-4 sm:p-6 lg:p-10 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute -top-40 -left-40 size-96 rounded-full bg-cyan-600/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 size-96 rounded-full bg-blue-600/15 blur-[120px]" />

      <div className="relative z-10 w-full max-w-5xl overflow-hidden rounded-3xl border border-line bg-panel shadow-2xl grid lg:grid-cols-12">
        {/* Left Col: Commercial Showcase Banner */}
        <div className="lg:col-span-5 bg-gradient-to-br from-panel2 via-panel to-panel2 p-8 sm:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-line relative overflow-hidden">
          <div className="pointer-events-none absolute -right-20 -bottom-20 size-60 rounded-full bg-accent/15 blur-3xl" />

          <div>
            {/* Commercial Logo */}
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-500 text-white shadow-lg shadow-cyan-600/25">
                <Layers className="size-6" />
              </span>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-black tracking-tight text-ink">Sifat&apos;s Home</span>
                  <span className="rounded bg-accent/20 px-1.5 py-0.2 text-[10px] font-black uppercase tracking-wider text-accent">
                    PRO
                  </span>
                </div>
                <p className="text-xs text-mute font-medium">Smart Home Automation System</p>
              </div>
            </div>

            {/* Showcase Features */}
            <div className="mt-10 space-y-5">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-on/30 bg-on/10 px-2.5 py-0.5 text-[11px] font-bold text-on">
                  <span className="size-1.5 rounded-full bg-on animate-pulse" />
                  Cloud Real-time Engine
                </span>
                <h3 className="text-xl font-extrabold text-ink tracking-tight pt-1">
                  Commercial Automation &amp; Actuation Platform
                </h3>
                <p className="text-xs text-mute leading-relaxed">
                  Enterprise-grade telemetry cockpit designed for sub-second synchronization with modular ESP32 microcontrollers (#1 to #N).
                </p>
              </div>

              <div className="space-y-3 pt-3">
                <div className="flex items-start gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-panel border border-line text-accent">
                    <Radio className="size-3.5" />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-ink">Sub-second Latency Sync</p>
                    <p className="text-[11px] text-mute">Instantaneous state propagation to hardware buses.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-panel border border-line text-on">
                    <Cpu className="size-3.5" />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-ink">Modular Multi-Node Channels</p>
                    <p className="text-[11px] text-mute">Scalable multi-room relay switching with safety lockouts.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-panel border border-line text-brand">
                    <ShieldCheck className="size-3.5" />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-ink">Role-Based Access Control</p>
                    <p className="text-[11px] text-mute">Granular facility member delegation &amp; approval workflows.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* System status pill at bottom */}
          <div className="mt-8 pt-6 border-t border-line/60 flex items-center justify-between text-[11px] text-mute">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="size-2 rounded-full bg-on animate-pulse" />
              All Systems Operational
            </span>
            <span className="font-mono text-accent">TLS 1.3 / AES-256</span>
          </div>
        </div>

        {/* Right Col: Sign in / Create Account Form */}
        <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-center">
          <div className="max-w-md mx-auto w-full">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-ink">
                  {isSignUp ? 'Create your account' : 'Welcome back'}
                </h2>
                <p className="mt-1 text-xs text-mute">
                  {isSignUp
                    ? 'Register your profile to manage and monitor smart facilities.'
                    : 'Enter your credentials to access the command center.'}
                </p>
              </div>
            </div>

            {/* Tab switch */}
            <div className="mt-6 flex rounded-xl border border-line bg-panel2 p-1">
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition-all cursor-pointer ${
                  !isSignUp ? 'bg-panel text-ink shadow-sm' : 'text-mute hover:text-ink'
                }`}
              >
                <LogIn className="size-3.5" />
                Sign in
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition-all cursor-pointer ${
                  isSignUp ? 'bg-panel text-ink shadow-sm' : 'text-mute hover:text-ink'
                }`}
              >
                <UserPlus className="size-3.5" />
                Create account
              </button>
            </div>

            <form onSubmit={submit} className="mt-5 space-y-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-mute">
                Email address
                <input
                  type="email"
                  autoComplete="username"
                  placeholder="admin@enterprise.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={field}
                  required
                />
              </label>

              <label className="block text-xs font-bold uppercase tracking-wider text-mute">
                <div className="flex items-center justify-between">
                  <span>Password</span>
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="text-xs normal-case text-mute hover:text-ink flex items-center gap-1 font-normal cursor-pointer"
                  >
                    {showPassword ? (
                      <>
                        <EyeOff className="size-3" /> Hide
                      </>
                    ) : (
                      <>
                        <Eye className="size-3" /> Show
                      </>
                    )}
                  </button>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={field}
                  required
                />
              </label>

              {isSignUp && (
                <label className="block text-xs font-bold uppercase tracking-wider text-mute">
                  Confirm Password
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={field}
                    required
                  />
                </label>
              )}

              {isSignUp && (
                <div className="rounded-2xl border border-line bg-panel2/70 p-4 space-y-3">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-mute">
                    Initial Setup Preference
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSignupChoice('create')}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center cursor-pointer transition-all ${
                        signupChoice === 'create'
                          ? 'border-accent bg-accent/15 text-accent font-bold shadow-xs'
                          : 'border-line bg-panel text-mute hover:text-ink'
                      }`}
                    >
                      <House className="size-4" />
                      <span className="text-xs">Create New Facility</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSignupChoice('join')}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center cursor-pointer transition-all ${
                        signupChoice === 'join'
                          ? 'border-accent bg-accent/15 text-accent font-bold shadow-xs'
                          : 'border-line bg-panel text-mute hover:text-ink'
                      }`}
                    >
                      <KeyRound className="size-4" />
                      <span className="text-xs">Join Existing Unit</span>
                    </button>
                  </div>

                  {signupChoice === 'create' ? (
                    <div>
                      <label className="block text-xs font-semibold text-mute">
                        Facility Name (Optional)
                        <input
                          type="text"
                          maxLength={35}
                          placeholder="e.g. Headquarters / Residence"
                          value={homeName}
                          onChange={(e) => setHomeName(e.target.value)}
                          className={field}
                        />
                      </label>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-mute">
                        Facility Invite Code
                        <input
                          type="text"
                          maxLength={20}
                          placeholder="e.g. HOME-7X9K2M"
                          value={inviteCode}
                          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                          className={`${field} font-mono font-bold tracking-wider text-accent`}
                          required={signupChoice === 'join'}
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <p role="alert" className="rounded-xl bg-bad/10 border border-bad/30 p-3 text-xs font-semibold text-bad">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-600/25 transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
              >
                {busy ? (
                  <Loader2 className="size-4.5 animate-spin" />
                ) : isSignUp ? (
                  <>
                    <UserPlus className="size-4.5" />
                    Complete Registration
                  </>
                ) : (
                  <>
                    <LogIn className="size-4.5" />
                    Sign In to Console
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center text-xs text-mute">
              {isSignUp ? (
                <span>
                  Already registered?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="font-bold text-accent hover:underline cursor-pointer"
                  >
                    Sign in here
                  </button>
                </span>
              ) : (
                <span>
                  Need an operator account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    className="font-bold text-accent hover:underline cursor-pointer"
                  >
                    Register new account
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
