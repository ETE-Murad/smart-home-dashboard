import { useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Layers,
  LayoutDashboard,
  ToggleRight,
  DoorOpen,
  Thermometer,
  Zap,
  Activity,
  Settings,
  LogOut,
  X,
  Cpu,
  Wifi,
  ShieldCheck,
  ChevronRight,
  Radio,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useDashboard } from '../context/DashboardData'
import { useHome } from '../context/HomeContext'
import HomeSelector from './HomeSelector'

const NAV_GROUPS = [
  {
    title: 'OVERVIEW',
    items: [
      { to: '/', label: 'Dashboard', Icon: LayoutDashboard, badge: null },
      { to: '/relays', label: 'Switch Controls', Icon: ToggleRight, badge: 'relays' },
      { to: '/rooms', label: 'Room Management', Icon: DoorOpen, badge: 'rooms' },
    ],
  },
  {
    title: 'TELEMETRY & SENSORS',
    items: [
      { to: '/temperature', label: 'Climate & Temperature', Icon: Thermometer, badge: null },
      { to: '/voltage', label: 'Voltage Grid', Icon: Zap, badge: null },
      { to: '/current', label: 'Current & Power', Icon: Activity, badge: null },
    ],
  },
  {
    title: 'ADMINISTRATION',
    items: [
      { to: '/settings', label: 'System & Security', Icon: Settings, badge: 'settings' },
    ],
  },
]

export default function Sidebar({ open, onClose }) {
  const { user, signOut } = useAuth()
  const { roomRequests, home, relayState, device, roomView } = useDashboard()
  const { joinRequestsCount } = useHome()

  const pendingRoomChanges = home?.isOwner ? (roomRequests?.pendingCount || 0) : 0
  const pendingJoin = home?.isOwner ? (joinRequestsCount || 0) : 0
  const activeRelaysCount = useMemo(() => {
    if (!roomView?.rooms) return 0
    return roomView.rooms.reduce(
      (acc, room) => acc + room.devices.filter((d) => d.relay?.actual === true).length,
      0
    )
  }, [roomView])

  const userInitial = (user?.email || 'U').charAt(0).toUpperCase()
  const userRole = home?.isOwner ? 'Facility Owner' : 'Authorized User'

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-line bg-panel transition-transform duration-300 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b border-line/60 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="relative grid size-10 place-items-center rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-500 text-white shadow-md shadow-cyan-500/20">
              <Layers className="size-5" />
              <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-on ring-2 ring-panel animate-pulse" />
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-extrabold tracking-tight text-ink">Sifat&apos;s Home</span>
                <span className="rounded bg-accent/20 px-1.5 py-0.2 text-[10px] font-black uppercase tracking-wider text-accent">
                  PRO
                </span>
              </div>
              <p className="text-[11px] font-medium text-mute">Home Automation System</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-lg p-1 text-mute hover:bg-panel2 hover:text-ink lg:hidden cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Multi-Home Facility Switcher */}
        <div className="border-b border-line/40 px-3 py-3">
          <HomeSelector />
        </div>

        {/* Navigation Categories */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Main">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="px-3 pb-2 text-[11px] font-bold tracking-wider text-mute/70 uppercase">
                {group.title}
              </p>
              <div className="space-y-1">
                {group.items.map(({ to, label, Icon, badge }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all ${
                        isActive
                          ? 'bg-gradient-to-r from-accent/20 to-brand/10 text-accent shadow-xs border border-accent/30'
                          : 'text-mute hover:bg-panel2 hover:text-ink border border-transparent'
                      }`
                    }
                  >
                    <Icon className="size-4.5 transition-transform group-hover:scale-110" />
                    <span className="flex-1 truncate">{label}</span>

                    {/* Dynamic badges */}
                    {badge === 'relays' && activeRelaysCount > 0 && (
                      <span className="rounded-full bg-on/20 px-2 py-0.5 text-[11px] font-bold text-on">
                        {activeRelaysCount} ON
                      </span>
                    )}

                    {badge === 'rooms' && pendingRoomChanges > 0 && (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-white shadow-xs animate-pulse">
                        {pendingRoomChanges}
                      </span>
                    )}

                    {badge === 'settings' && pendingJoin > 0 && (
                      <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white shadow-xs animate-pulse">
                        {pendingJoin}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Hardware Status Widget */}
        <div className="border-t border-line/60 p-3">
          <div className="rounded-xl border border-line bg-panel2/70 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-ink">
                <Cpu className="size-3.5 text-accent" />
                ESP32 Gateway
              </span>
              <span
                className={`flex items-center gap-1 text-[11px] font-bold ${
                  device.online ? 'text-on' : 'text-bad'
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    device.online ? 'bg-on animate-ping' : 'bg-bad'
                  }`}
                />
                {device.online ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-mute">
              <span>Hardware Bus: Expandable</span>
              <span className="font-mono text-accent">Multi-Node</span>
            </div>
          </div>
        </div>

        {/* User Account Drawer */}
        <div className="border-t border-line bg-panel2/40 p-3.5">
          <div className="flex items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-tr from-brand to-accent text-xs font-black text-white shadow-xs">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-bold text-ink">{user?.email}</p>
              <p className="truncate text-[11px] font-medium text-mute">{userRole}</p>
            </div>
            <button
              onClick={signOut}
              title="Sign out of system"
              aria-label="Sign out"
              className="rounded-lg p-2 text-mute hover:bg-bad/15 hover:text-bad transition-colors cursor-pointer"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
