import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Menu,
  RefreshCw,
  Cloud,
  CircuitBoard,
  House,
  ShieldAlert,
  UserPlus,
  Sun,
  Moon,
  Zap,
  Radio,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useDashboard } from '../context/DashboardData'
import { useHome } from '../context/HomeContext'
import { useRefresh } from '../context/RefreshContext'
import { useTheme } from '../hooks/useTheme'
import { isSoundEnabled, setSoundEnabled } from '../utils/sound'

export default function Header({ onMenu }) {
  const { user } = useAuth()
  const { connection, device, relayState, home, roomRequests, roomView } = useDashboard()
  const { joinRequestsCount } = useHome()
  const { theme, setTheme } = useTheme()
  const refresh = useRefresh()
  const [now, setNow] = useState(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled())
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFsChange)
    return () => {
      clearInterval(t)
      document.removeEventListener('fullscreenchange', onFsChange)
    }
  }, [])

  const handleToggleSound = () => {
    const next = !soundOn
    setSoundOn(next)
    setSoundEnabled(next)
  }

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {})
    } else {
      document.exitFullscreen?.().catch(() => {})
    }
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    refresh?.()
    setTimeout(() => setIsRefreshing(false), 700)
  }

  const name = (user?.email || '').split('@')[0]
  const activeDevicesCount = useMemo(() => {
    if (!roomView?.rooms) return 0
    return roomView.rooms.reduce(
      (acc, room) => acc + (room.devices || []).filter((d) => d.relay?.actual === true).length,
      0
    )
  }, [roomView])
  const fb = connection.status
  const pendingRequestsCount = home?.isOwner ? (roomRequests?.pendingCount || 0) : 0
  const pendingJoinCount = home?.isOwner ? (joinRequestsCount || 0) : 0

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-panel/85 px-4 py-3.5 backdrop-blur-md sm:px-8 transition-colors">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Mobile trigger & Titles / Breadcrumbs */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenu}
            aria-label="Open menu"
            className="grid size-10 place-items-center rounded-xl border border-line bg-panel2 text-mute hover:text-ink lg:hidden cursor-pointer"
          >
            <Menu className="size-5" />
          </button>

          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-accent/90">
                Sifat&apos;s Home Automation
              </span>
              {home?.name && (
                <>
                  <span className="text-mute/40">/</span>
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-panel2 border border-line px-2.5 py-0.5 text-xs font-bold text-ink">
                    <House className="size-3 text-accent" />
                    {home.name}
                  </span>
                </>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <h1 className="text-lg font-extrabold tracking-tight sm:text-xl">
                Command Center
              </h1>
              <span className="hidden sm:inline-block text-xs font-medium text-mute">
                • Logged in as <span className="font-semibold text-ink">{name || 'Operator'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right: Telemetry status pills, theme toggle, time & refresh */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Cloud Sync Status */}
          <div
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
              fb === 'connected'
                ? 'border-on/30 bg-on/10 text-on'
                : fb === 'connecting'
                ? 'border-warn/30 bg-warn/10 text-warn animate-pulse'
                : 'border-bad/30 bg-bad/10 text-bad'
            }`}
            title={`Firebase synchronization: ${fb}`}
          >
            <span
              className={`size-2 rounded-full ${
                fb === 'connected' ? 'bg-on shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-current'
              }`}
            />
            <Cloud className="size-3.5" />
            <span>{fb === 'connected' ? 'Cloud Synced' : fb === 'connecting' ? 'Connecting…' : 'Offline'}</span>
          </div>

          {/* ESP32 Hardware Status */}
          <div
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
              device.online
                ? 'border-on/30 bg-on/10 text-on'
                : 'border-bad/30 bg-bad/10 text-bad'
            }`}
            title={device.online ? 'ESP32 Gateway operating normally' : 'ESP32 Gateway is offline'}
          >
            <span
              className={`size-2 rounded-full ${
                device.online ? 'bg-on shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse' : 'bg-bad'
              }`}
            />
            <CircuitBoard className="size-3.5" />
            <span>ESP32 {device.online ? 'Online' : 'Offline'}</span>
          </div>

          {/* Quick Active Load Pill */}
          <div className="hidden md:inline-flex items-center gap-2 rounded-xl border border-line bg-panel2 px-3 py-1.5 text-xs font-medium text-mute">
            <Zap className={`size-3.5 ${activeDevicesCount > 0 ? 'text-warn animate-pulse' : 'text-mute'}`} />
            <span>
              <strong className="font-bold text-ink">{activeDevicesCount}</strong> active {activeDevicesCount === 1 ? 'device' : 'devices'}
            </span>
          </div>

          {/* Notification Badges */}
          {pendingRequestsCount > 0 && (
            <Link
              to="/rooms"
              className="inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/15 px-3 py-1.5 text-xs font-bold text-accent hover:brightness-110 animate-pulse transition-all"
              title={`${pendingRequestsCount} room change request(s) awaiting review`}
            >
              <ShieldAlert className="size-3.5" />
              <span>{pendingRequestsCount} request{pendingRequestsCount > 1 ? 's' : ''}</span>
            </Link>
          )}

          {pendingJoinCount > 0 && (
            <Link
              to="/settings"
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand/40 bg-brand/15 px-3 py-1.5 text-xs font-bold text-brand hover:brightness-110 animate-pulse transition-all"
              title={`${pendingJoinCount} new user join request(s) waiting for approval`}
            >
              <UserPlus className="size-3.5" />
              <span>{pendingJoinCount} join{pendingJoinCount > 1 ? 's' : ''}</span>
            </Link>
          )}

          {/* Live Date/Time display */}
          <div className="hidden xl:flex flex-col text-right text-xs">
            <span className="font-semibold text-ink font-mono">
              {now.toLocaleTimeString([], { hour12: false })}
            </span>
            <span className="text-[11px] text-mute">
              {now.toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' })}
            </span>
          </div>

          {/* Sound FX Toggle */}
          <button
            type="button"
            onClick={handleToggleSound}
            aria-label={soundOn ? 'Mute switch audio chimes' : 'Enable tactile switch audio chimes'}
            title={soundOn ? 'Tactile switch audio enabled (Click to mute)' : 'Switch audio muted (Click to enable)'}
            className={`grid size-9 place-items-center rounded-xl border transition-colors cursor-pointer ${
              soundOn
                ? 'border-accent/40 bg-accent/15 text-accent'
                : 'border-line bg-panel2 text-mute hover:text-ink'
            }`}
          >
            {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            aria-label={isFullscreen ? 'Exit full screen cockpit' : 'Enter full screen cockpit'}
            title={isFullscreen ? 'Exit full screen cockpit' : 'Enter full screen cockpit'}
            className="hidden sm:grid size-9 place-items-center rounded-xl border border-line bg-panel2 text-mute hover:text-ink hover:border-accent/40 transition-colors cursor-pointer"
          >
            {isFullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
          </button>

          {/* Theme Switcher Button */}
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="grid size-9 place-items-center rounded-xl border border-line bg-panel2 text-mute hover:text-ink hover:border-accent/40 transition-colors cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="size-4 text-warn" /> : <Moon className="size-4 text-brand" />}
          </button>

          {/* Dashboard Refresh Button */}
          <button
            type="button"
            onClick={handleRefresh}
            aria-label="Refresh dashboard data"
            title="Refresh dashboard data"
            className="grid size-9 place-items-center rounded-xl border border-line bg-panel2 text-mute hover:text-ink hover:border-accent/40 transition-colors cursor-pointer"
          >
            <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin text-accent' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  )
}
