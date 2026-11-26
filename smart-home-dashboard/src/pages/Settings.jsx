import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Save,
  RefreshCw,
  Sun,
  Moon,
  Copy,
  Check,
  KeyRound,
  Cpu,
  Shield,
  Users,
  Edit3,
  Trash2,
  LogOut,
  Mail,
  Fingerprint,
  UserPlus,
  UserMinus,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  Plus,
  EyeOff,
  Home as HomeIcon,
  Lock,
  Crown,
} from 'lucide-react'
import ConfirmationModal from '../components/ConfirmationModal'
import { useAuth } from '../context/AuthContext'
import { useDashboard } from '../context/DashboardData'
import { useHome } from '../context/HomeContext'
import { useToast } from '../context/ToastContext'
import { useRefresh } from '../context/RefreshContext'
import { useTheme } from '../hooks/useTheme'
import { saveTemperatureThresholds } from '../services/sensorService'
import { friendlyError } from '../services/firebaseService'
import { firebaseInfo } from '../firebase'
import { RELAYS } from '../config'
import { formatDateTime, formatUptime, timeAgo } from '../utils/format'

const card = 'glass-panel rounded-2xl p-6 shadow-[var(--shadow)] transition-all'
const input = 'rounded-xl border border-line bg-panel2 px-3.5 py-2 text-xs text-ink min-w-0 focus:border-accent focus:outline-none transition-colors'

function Row({ label, children }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line/60 py-2 text-sm last:border-0">
      <span className="text-mute">{label}</span>
      <span className="text-right font-semibold">{children}</span>
    </div>
  )
}

export default function Settings() {
  const { user } = useAuth()
  const { connection, device, sensorState, homeId, home } = useDashboard()
  const {
    currentHome,
    createHome,
    joinHome,
    updateHomeName,
    regenerateInviteCode,
    leaveHome,
    removeMember,
    transferOwnership,
    toggleRequireApproval,
    approveJoinRequest,
    rejectJoinRequest,
    joinRequests,
  } = useHome()
  const { notify } = useToast()
  const refresh = useRefresh()
  const { theme, setTheme } = useTheme()

  const [warn, setWarn] = useState(sensorState.thresholds.warn)
  const [critical, setCritical] = useState(sensorState.thresholds.critical)
  const [err, setErr] = useState('')

  const [isEditingName, setIsEditingName] = useState(false)
  const [nameVal, setNameVal] = useState(home?.name || '')
  const [copiedId, setCopiedId] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedSnippet, setCopiedSnippet] = useState(false)
  const [copiedMemberUid, setCopiedMemberUid] = useState(null)

  const [memberToRemove, setMemberToRemove] = useState(null)
  const [memberToTransfer, setMemberToTransfer] = useState(null)
  const [transferring, setTransferring] = useState(false)
  const [processingJoinUid, setProcessingJoinUid] = useState(null)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newHomeName, setNewHomeName] = useState('')
  const [creatingHome, setCreatingHome] = useState(false)

  const [showJoinModal, setShowJoinModal] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joiningHome, setJoiningHome] = useState(false)

  const activeHome = currentHome || home
  const isOwner = Boolean(activeHome?.isOwner)
  const requireApproval = activeHome?.requireApproval !== false

  async function handleCreateHomeSubmit(e) {
    e.preventDefault()
    if (!newHomeName.trim()) return
    setCreatingHome(true)
    try {
      await createHome(newHomeName.trim())
      notify('success', `Created home "${newHomeName.trim()}"! Switched to your new home.`)
      setNewHomeName('')
      setShowCreateModal(false)
    } catch (err) {
      notify('error', friendlyError(err))
    } finally {
      setCreatingHome(false)
    }
  }

  async function handleJoinHomeSubmit(e) {
    e.preventDefault()
    if (!joinCode.trim()) return
    setJoiningHome(true)
    try {
      const res = await joinHome(joinCode.trim())
      if (res?.status === 'pending') {
        notify('info', 'Join request submitted! You will gain access once the home owner approves.')
      } else if (res?.status === 'switched') {
        notify('success', 'Switched to home')
      } else {
        notify('success', 'Joined home successfully!')
      }
      setJoinCode('')
      setShowJoinModal(false)
    } catch (err) {
      notify('error', friendlyError(err))
    } finally {
      setJoiningHome(false)
    }
  }

  const membersObj = activeHome?.members || {}
  const membersList = Object.entries(membersObj)
    .map(([uid, m]) => ({
      uid,
      email: m?.email || 'User',
      role: m?.role || 'member',
      joinedAt: m?.joinedAt || 0,
    }))
    .sort((a, b) => {
      if (a.role === 'owner') return -1
      if (b.role === 'owner') return 1
      return a.joinedAt - b.joinedAt
    })

  useEffect(() => {
    if (home?.name) setNameVal(home.name)
  }, [home?.name])

  useEffect(() => {
    setWarn(sensorState.thresholds.warn)
    setCritical(sensorState.thresholds.critical)
  }, [sensorState.thresholds])

  async function saveThresholds(e) {
    e.preventDefault()
    setErr('')
    try {
      await saveTemperatureThresholds({ warn, critical })
      notify('success', 'Temperature thresholds saved')
    } catch (error) {
      setErr(friendlyError(error))
    }
  }

  async function handleSaveName() {
    if (!nameVal.trim()) return
    try {
      await updateHomeName(homeId, nameVal.trim())
      notify('success', 'Home name updated')
      setIsEditingName(false)
    } catch (e) {
      notify('error', e?.message || 'Failed to update name')
    }
  }

  async function handleRegenCode() {
    try {
      const newCode = await regenerateInviteCode(homeId)
      notify('success', `New invite code generated: ${newCode}`)
    } catch (e) {
      notify('error', e?.message || 'Failed to regenerate code')
    }
  }

  async function handleToggleApproval() {
    try {
      const targetState = !requireApproval
      await toggleRequireApproval(homeId, targetState)
      notify(
        'success',
        targetState
          ? 'New members now require your approval to join'
          : 'New members can now join with invite code directly',
      )
    } catch (e) {
      notify('error', e?.message || 'Failed to update approval setting')
    }
  }

  async function handleApproveJoin(req) {
    setProcessingJoinUid(req.uid)
    try {
      await approveJoinRequest(homeId, req.uid, req.email)
      notify('success', `Approved ${req.email} for this home!`)
    } catch (e) {
      notify('error', e?.message || 'Failed to approve join request')
    } finally {
      setProcessingJoinUid(null)
    }
  }

  async function handleRejectJoin(req) {
    setProcessingJoinUid(req.uid)
    try {
      await rejectJoinRequest(homeId, req.uid)
      notify('info', `Declined join request from ${req.email}`)
    } catch (e) {
      notify('error', e?.message || 'Failed to decline join request')
    } finally {
      setProcessingJoinUid(null)
    }
  }

  async function confirmRemoveMember() {
    if (!memberToRemove) return
    const target = memberToRemove
    setMemberToRemove(null)
    try {
      await removeMember(homeId, target.uid)
      notify('success', `Removed ${target.email} from this home`)
    } catch (e) {
      notify('error', e?.message || 'Failed to remove member')
    }
  }

  async function confirmTransferOwnership() {
    if (!memberToTransfer) return
    const target = memberToTransfer
    setTransferring(true)
    try {
      await transferOwnership(homeId, target.uid)
      notify('success', `Ownership successfully transferred to ${target.email || target.uid}!`)
      setMemberToTransfer(null)
    } catch (e) {
      notify('error', e?.message || 'Failed to transfer ownership')
    } finally {
      setTransferring(false)
    }
  }

  const copyText = async (text, setCopied) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      notify('error', 'Clipboard copy failed')
    }
  }

  const esp32Snippet = `#define HOME_ID         "${homeId || 'YOUR_HOME_ID'}"`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
              System Administration &amp; Security
            </h2>
            <span className="rounded-full bg-panel2 border border-line px-2.5 py-0.5 text-xs font-bold text-accent font-mono">
              Config Hub
            </span>
          </div>
          <p className="mt-1 text-xs text-mute">
            Hardware provisioning, multi-tenant home access control, and telemetry thresholds
          </p>
        </div>
      </div>

      {/* Multi-Home & ESP32 Hardware Binding Section */}
      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-brand/20 text-accent">
              <Cpu className="size-5" />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-ink">Home & ESP32 Configuration</h3>
              <p className="text-xs text-mute">Each home has isolated devices, data, and access controls.</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-3 py-1 text-xs font-bold text-accent">
            <Shield className="size-3" />
            {isOwner ? 'Home Owner' : 'Shared Member'}
          </span>
        </div>

        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          {/* Left Column: Home Details & Invite */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-mute">Home Name</label>
              {isEditingName ? (
                <div className="mt-1 flex items-center gap-2">
                  <input
                    value={nameVal}
                    onChange={(e) => setNameVal(e.target.value)}
                    maxLength={40}
                    className="flex-1 rounded-xl border border-accent bg-panel2 px-3 py-1.5 text-sm font-semibold text-ink focus:outline-none"
                  />
                  <button onClick={handleSaveName} className="rounded-xl bg-brand px-3 py-1.5 text-xs font-bold text-white hover:brightness-110">
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingName(false)
                      setNameVal(home?.name || '')
                    }}
                    className="rounded-xl border border-line px-3 py-1.5 text-xs text-mute hover:bg-panel2"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-base font-bold text-ink">{activeHome?.name || 'Smart Home'}</span>
                  {isOwner && (
                    <button onClick={() => setIsEditingName(true)} className="flex items-center gap-1 text-xs text-accent hover:underline">
                      <Edit3 className="size-3" /> Rename
                    </button>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-mute">Home ID (Private Namespace)</label>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-line bg-panel2 p-2.5">
                <code className="flex-1 truncate font-mono text-xs text-ink">{homeId || '—'}</code>
                <button
                  type="button"
                  onClick={() => copyText(homeId, setCopiedId)}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-accent hover:bg-panel"
                >
                  {copiedId ? <Check className="size-3.5 text-on" /> : <Copy className="size-3.5" />}
                  {copiedId ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-mute">Household Invite Code (Room Key)</label>
                {isOwner && (
                  <button onClick={handleRegenCode} className="text-[11px] text-accent hover:underline">
                    Regenerate code
                  </button>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-line bg-panel2 p-2.5">
                <KeyRound className="size-4 text-brand shrink-0" />
                <code className="flex-1 font-mono text-sm font-bold tracking-widest text-accent">
                  {activeHome?.inviteCode || '—'}
                </code>
                <button
                  type="button"
                  onClick={() => copyText(activeHome?.inviteCode || '', setCopiedCode)}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-accent hover:bg-panel"
                >
                  {copiedCode ? <Check className="size-3.5 text-on" /> : <Copy className="size-3.5" />}
                  {copiedCode ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-mute">
                Share this key with family members or roommates so they can access this home from their account.
              </p>
            </div>
          </div>

          {/* Right Column: Firmware binding */}
          <div className="flex flex-col justify-between rounded-xl border border-line/60 bg-panel2/50 p-4">
            <div>
              <div className="flex items-center gap-2">
                <Cpu className="size-4 text-accent" />
                <h4 className="text-sm font-bold text-ink">ESP32 Firmware Binding</h4>
              </div>
              <p className="mt-1 text-xs text-mute">
                To connect an ESP32 strictly to this home, paste this line into section 1 of your sketch (<code className="text-ink font-semibold">esp32_relay_controller.ino</code>):
              </p>

              <div className="mt-3 relative rounded-xl border border-line bg-panel p-3">
                <pre className="font-mono text-xs text-accent overflow-x-auto selection:bg-brand/30">
                  {esp32Snippet}
                </pre>
                <button
                  type="button"
                  onClick={() => copyText(esp32Snippet, setCopiedSnippet)}
                  className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-panel2 border border-line px-2 py-1 text-[11px] font-semibold text-ink hover:border-accent"
                >
                  {copiedSnippet ? <Check className="size-3 text-on" /> : <Copy className="size-3" />}
                  {copiedSnippet ? 'Copied' : 'Copy'}
                </button>
              </div>

              <div className="mt-3 rounded-lg bg-panel2/80 p-2.5 text-[11px] text-mute leading-relaxed">
                💡 <b className="text-ink">Multiple households:</b> Each friend or household flashes their ESP32 with their own unique <code className="text-accent font-semibold">HOME_ID</code>. Realtime Database rules guarantee complete isolation—no one can switch or monitor relays belonging to another home.
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-line/60 flex items-center justify-between">
              <span className="text-xs text-mute">
                {activeHome?.memberCount || 1} authorized {activeHome?.memberCount === 1 ? 'member' : 'members'}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (confirm(isOwner ? 'Are you sure you want to delete this home?' : 'Are you sure you want to leave this home?')) {
                    leaveHome(homeId)
                  }
                }}
                className="flex items-center gap-1.5 text-xs font-semibold text-bad hover:underline cursor-pointer"
              >
                {isOwner ? <Trash2 className="size-3.5" /> : <LogOut className="size-3.5" />}
                {isOwner ? 'Delete this home' : 'Leave this home'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Household Users & Access Permissions Section */}
      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-accent/20 text-accent">
              <Users className="size-5" />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-ink">
                {isOwner ? 'Authorized Members & Access Control' : 'Household Members'}
              </h3>
              <p className="text-xs text-mute">
                {isOwner
                  ? 'Manage accounts authorized to access this home and configure join approval permissions.'
                  : 'View members authorized in this home. Account emails and IDs are protected by owner privacy.'}
              </p>
            </div>
          </div>
          <span className="rounded-full bg-panel2 border border-line px-3 py-1 text-xs font-bold text-ink">
            {membersList.length} Authorized {membersList.length === 1 ? 'User' : 'Users'}
          </span>
        </div>

        {/* Join Permission Toggle (Owner only) */}
        {isOwner && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-line bg-panel2/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-accent" />
                <h4 className="text-sm font-bold text-ink">Require Owner Approval to Join with Room Key</h4>
              </div>
              <p className="text-xs text-mute max-w-xl">
                When enabled, users entering your household invite code cannot join automatically. A permission request is sent to you to approve or reject.
              </p>
            </div>
            <button
              onClick={handleToggleApproval}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
                requireApproval
                  ? 'bg-on/15 text-on border border-on/30'
                  : 'bg-panel border border-line text-mute hover:text-ink'
              }`}
            >
              {requireApproval ? <ToggleRight className="size-5 text-on" /> : <ToggleLeft className="size-5" />}
              {requireApproval ? 'Approval Required (ON)' : 'Direct Join (OFF)'}
            </button>
          </div>
        )}

        {/* Pending Join Requests (Owner only) */}
        {isOwner && joinRequests.length > 0 && (
          <div className="mt-5 rounded-xl border border-accent/40 bg-accent/5 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-ink">
              <UserPlus className="size-4 text-accent" />
              <span>Pending Join Requests ({joinRequests.length})</span>
            </div>
            <p className="mt-0.5 text-xs text-mute">
              These users entered your room key / invite code and are waiting for your approval to access the home.
            </p>

            <div className="mt-3 space-y-2.5">
              {joinRequests.map((req) => {
                const isBusy = processingJoinUid === req.uid
                return (
                  <div
                    key={req.uid}
                    className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-bold text-ink">
                        <Mail className="size-4 text-accent" />
                        <span>{req.email}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-mute">
                        <span className="flex items-center gap-1 font-mono">
                          <Fingerprint className="size-3.5 text-mute" />
                          UID: {req.uid}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {timeAgo(Math.floor((Date.now() - req.createdAt) / 1000))} ago
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        disabled={isBusy}
                        onClick={() => handleApproveJoin(req)}
                        className="flex items-center gap-1.5 rounded-lg bg-on px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
                      >
                        <CheckCircle2 className="size-3.5" />
                        Approve Access
                      </button>
                      <button
                        disabled={isBusy}
                        onClick={() => handleRejectJoin(req)}
                        className="flex items-center gap-1.5 rounded-lg border border-line bg-panel2 px-3 py-1.5 text-xs font-semibold text-bad hover:bg-bad/10 disabled:opacity-50"
                      >
                        <XCircle className="size-3.5" />
                        Decline
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Authorized Members Section */}
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-mute">
              {isOwner ? 'Active Household Accounts' : 'Authorized Members'}
            </h4>
            <span className="text-xs font-medium text-mute">
              Total: {membersList.length} {membersList.length === 1 ? 'user' : 'users'}
            </span>
          </div>

          {!isOwner && (
            <div className="mt-3 flex items-start gap-3 rounded-xl border border-line bg-panel2/50 p-3.5 text-xs text-mute">
              <EyeOff className="size-4 shrink-0 text-accent mt-0.5" />
              <div>
                <p className="font-semibold text-ink">Owner Privacy Active</p>
                <p className="mt-0.5">
                  Only the owner of this smart home can see member emails, login IDs, and manage accounts. You can see the total number of members in this household ({membersList.length} {membersList.length === 1 ? 'user' : 'users'}).
                </p>
              </div>
            </div>
          )}

          <div className="mt-3 divide-y divide-line/60 rounded-xl border border-line bg-panel overflow-hidden">
            {isOwner ? (
              // Owner sees full details of all accounts
              membersList.map((m) => {
                const isCurrentUser = m.uid === user?.uid
                const isMemberOwner = m.role === 'owner'
                const initial = (m.email || 'U').charAt(0).toUpperCase()
                return (
                  <div
                    key={m.uid}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-panel2/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand to-accent text-xs font-bold text-white shadow-sm">
                        {initial}
                      </span>
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-ink">{m.email}</span>
                          {isMemberOwner ? (
                            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent">
                              Owner
                            </span>
                          ) : (
                            <span className="rounded-full bg-panel2 border border-line px-2 py-0.5 text-[11px] font-semibold text-mute">
                              Member
                            </span>
                          )}
                          {isCurrentUser && (
                            <span className="rounded-full bg-on/15 px-2 py-0.5 text-[11px] font-bold text-on">
                              You
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-mute">
                          <span className="flex items-center gap-1 font-mono text-[11px]">
                            <Fingerprint className="size-3 text-mute" />
                            {m.uid}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyText(m.uid, (v) => setCopiedMemberUid(v ? m.uid : null))}
                            className="text-[11px] text-accent hover:underline"
                          >
                            {copiedMemberUid === m.uid ? 'Copied UID' : 'Copy UID'}
                          </button>
                          {m.joinedAt > 0 && (
                            <>
                              <span>·</span>
                              <span>Joined {formatDateTime(m.joinedAt)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions for Owner */}
                    {!isMemberOwner && !isCurrentUser && (
                      <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                        <button
                          type="button"
                          onClick={() => setMemberToTransfer(m)}
                          className="flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/20 transition-colors cursor-pointer"
                          title={`Transfer ownership of this home to ${m.email}`}
                        >
                          <Crown className="size-3.5 text-accent" />
                          Transfer Ownership
                        </button>
                        <button
                          type="button"
                          onClick={() => setMemberToRemove(m)}
                          className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-bad hover:bg-bad/10 transition-colors cursor-pointer"
                          title={`Remove ${m.email} from this home`}
                        >
                          <UserMinus className="size-3.5" />
                          Remove Account
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            ) : (
              // Non-owner member view: privacy protected
              <>
                {/* Current User Row */}
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between bg-panel2/30">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand to-accent text-xs font-bold text-white shadow-sm">
                      {(user?.email || 'U').charAt(0).toUpperCase()}
                    </span>
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-ink">{user?.email}</span>
                        <span className="rounded-full bg-on/15 px-2 py-0.5 text-[11px] font-bold text-on">
                          You (Member)
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-mute">
                        <span className="flex items-center gap-1 font-mono text-[11px]">
                          <Fingerprint className="size-3 text-mute" />
                          {user?.uid}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Privacy summary row for other members */}
                {membersList.length > 1 && (
                  <div className="flex items-center gap-3 p-4 text-xs text-mute">
                    <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-panel2 border border-line text-mute">
                      <Users className="size-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-ink">
                        + {membersList.length - 1} other {membersList.length - 1 === 1 ? 'member' : 'members'}
                      </p>
                      <p className="text-[11px] text-mute">
                        Account emails and login IDs are hidden for privacy. Only the owner can view account details.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Multi-Room & Home Management Card */}
        <div className="mt-5 rounded-xl border border-line bg-panel2/40 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <h4 className="text-sm font-bold text-ink flex items-center gap-2">
                <HomeIcon className="size-4 text-accent" />
                Manage Multiple Rooms & Homes
              </h4>
              <p className="text-xs text-mute max-w-xl">
                You can create your own private smart home at any time to have full owner control, or join another room with an invite code.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 transition-colors"
              >
                <Plus className="size-3.5" />
                Create Own Room / Home
              </button>
              <button
                type="button"
                onClick={() => setShowJoinModal(true)}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-semibold text-ink hover:bg-panel2 transition-colors"
              >
                <KeyRound className="size-3.5 text-accent" />
                Join with Room Code
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Create Home Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-ink flex items-center gap-2">
              <HomeIcon className="size-5 text-accent" />
              Create Your Own Room / Home
            </h3>
            <p className="mt-1 text-xs text-mute">
              You will be the owner of this smart home with full administrator rights, device control, and invite code generation.
            </p>

            <form onSubmit={handleCreateHomeSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-mute">Home Name</label>
                <input
                  type="text"
                  placeholder="e.g. My Apartment, Living Space"
                  value={newHomeName}
                  onChange={(e) => setNewHomeName(e.target.value)}
                  maxLength={40}
                  className="mt-1 w-full rounded-xl border border-line bg-panel2 px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={creatingHome}
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-line px-4 py-2 text-xs font-semibold text-mute hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingHome || !newHomeName.trim()}
                  className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
                >
                  {creatingHome ? 'Creating...' : 'Create Home'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Home Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-ink flex items-center gap-2">
              <KeyRound className="size-5 text-accent" />
              Join Room with Code
            </h3>
            <p className="mt-1 text-xs text-mute">
              Enter the household invite code shared by the room owner (format: HOME-XXXXXX).
            </p>

            <form onSubmit={handleJoinHomeSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-mute">Room / Invite Code</label>
                <input
                  type="text"
                  placeholder="HOME-XXXXXX"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={20}
                  className="mt-1 w-full font-mono text-center tracking-widest uppercase rounded-xl border border-line bg-panel2 px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={joiningHome}
                  onClick={() => setShowJoinModal(false)}
                  className="rounded-lg border border-line px-4 py-2 text-xs font-semibold text-mute hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joiningHome || !joinCode.trim()}
                  className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
                >
                  {joiningHome ? 'Joining...' : 'Join Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Removing Member */}
      <ConfirmationModal
        open={Boolean(memberToRemove)}
        danger
        title="Remove Member from Home?"
        message={`Are you sure you want to remove ${memberToRemove?.email} (UID: ${memberToRemove?.uid})? They will immediately lose access to all switches, rooms, and devices in this home.`}
        confirmLabel="Remove Account"
        onCancel={() => setMemberToRemove(null)}
        onConfirm={confirmRemoveMember}
      />

      {/* Confirmation Modal for Transferring Ownership */}
      <ConfirmationModal
        open={Boolean(memberToTransfer)}
        danger
        title="Transfer House Ownership?"
        message={`Are you sure you want to transfer primary ownership of "${currentHome?.name || 'this home'}" to ${memberToTransfer?.email} (UID: ${memberToTransfer?.uid})? They will become the primary owner with full administrator control over all rooms, appliances, and member permissions. Your account will remain in this home as an authorized member.`}
        confirmLabel={transferring ? 'Transferring...' : 'Transfer Ownership'}
        onCancel={() => !transferring && setMemberToTransfer(null)}
        onConfirm={confirmTransferOwnership}
      />

      <section className={card}>
        <h3 className="font-bold">Rooms and appliances</h3>
        <p className="mt-1 text-sm text-mute">
          Rename rooms, add or delete rooms, and edit the lights and fans inside them on the{' '}
          <Link to="/rooms" className="font-semibold text-accent hover:underline">
            Rooms page
          </Link>
          .
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={card}>
          <h3 className="font-bold">ESP32 connection</h3>
          <Row label="Status">
            <span className={device.online ? 'text-on' : 'text-bad'}>
              {device.online ? 'Online' : 'Offline'}
            </span>
          </Row>
          <Row label="Last heartbeat">
            {device.hasHeartbeat ? `${timeAgo(device.ageSec)} (${formatDateTime(device.lastSeen)})` : 'Never'}
          </Row>
          <Row label="IP address">{device.ip || '—'}</Row>
          <Row label="Wi-Fi signal">{device.rssi != null ? `${device.rssi} dBm` : '—'}</Row>
          <Row label="Uptime">{formatUptime(device.uptimeSec)}</Row>
          <Row label="Firmware">{device.firmware || '—'}</Row>
        </section>

        <section className={card}>
          <h3 className="font-bold">Firebase</h3>
          <Row label="Connection">{connection.status}</Row>
          <Row label="Project">{firebaseInfo.projectId}</Row>
          <Row label="Auth domain">{firebaseInfo.authDomain}</Row>
          <Row label="Database">
            <span className="break-all text-xs">{firebaseInfo.databaseURL}</span>
          </Row>
          <p className="mt-3 text-xs text-mute">Keys and passwords are never shown here.</p>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={card}>
          <h3 className="font-bold">Switch to GPIO map</h3>
          <p className="mb-2 text-sm text-mute">
            Set in the ESP32 firmware. It can only be changed there, not from this page.
          </p>
          <div className="grid grid-cols-2 gap-x-6">
            {RELAYS.map((r) => (
              <Row key={r.id} label={`Switch ${r.number}`}>
                GPIO {r.gpio}
              </Row>
            ))}
          </div>
        </section>

        <section className={card}>
          <h3 className="font-bold">Temperature warnings</h3>
          <form onSubmit={saveThresholds} className="mt-3 space-y-3">
            <label className="flex items-center justify-between gap-4 text-sm">
              Warning at (°C)
              <input
                type="number"
                step="0.5"
                value={warn}
                onChange={(e) => setWarn(e.target.value)}
                className={`${input} w-28`}
              />
            </label>
            <label className="flex items-center justify-between gap-4 text-sm">
              Critical at (°C)
              <input
                type="number"
                step="0.5"
                value={critical}
                onChange={(e) => setCritical(e.target.value)}
                className={`${input} w-28`}
              />
            </label>
            {err && <p role="alert" className="text-xs text-bad">{err}</p>}
            <button className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:brightness-110">
              <Save className="size-4" />
              Save thresholds
            </button>
          </form>

          <h3 className="mt-6 font-bold">Appearance</h3>
          <div className="mt-3 flex gap-3">
            {[
              ['dark', Moon, 'Dark'],
              ['light', Sun, 'Light'],
            ].map(([key, Icon, label]) => (
              <button
                key={key}
                onClick={() => setTheme(key)}
                aria-pressed={theme === key}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold ${
                  theme === key ? 'border-accent text-accent' : 'border-line text-mute'
                }`}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={refresh}
            className="mt-6 flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-panel2"
          >
            <RefreshCw className="size-4" />
            Refresh dashboard
          </button>
        </section>
      </div>
    </div>
  )
}
