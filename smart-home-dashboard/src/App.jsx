import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Loader2, TriangleAlert } from 'lucide-react'
import { initError } from './firebase'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { DashboardDataProvider, useDashboard } from './context/DashboardData'
import { RefreshContext } from './context/RefreshContext'
import { HomeProvider, useHome } from './context/HomeContext'
import HomeOnboarding from './components/HomeOnboarding'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import ConnectionBanner from './components/ConnectionBanner'
import Dashboard from './pages/Dashboard'
import RelayControls from './pages/RelayControls'
import TemperatureMonitoring from './pages/TemperatureMonitoring'
import VoltageMonitoring from './pages/VoltageMonitoring'
import CurrentMonitoring from './pages/CurrentMonitoring'
import Rooms from './pages/Rooms'
import Settings from './pages/Settings'
import Login from './pages/Login'
import NotAuthorized from './pages/NotAuthorized'

function Shell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { connection, device, relayState } = useDashboard()

  if (relayState.permissionDenied) return <NotAuthorized />

  return (
    <div className="min-h-screen lg:pl-72 flex flex-col justify-between">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex-1 flex flex-col">
        <ConnectionBanner firebaseStatus={connection.status} device={device} />
        <Header onMenu={() => setMenuOpen(true)} />
        <main className="flex-1 px-4 py-6 sm:px-8 max-w-[1600px] w-full mx-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/relays" element={<RelayControls />} />
            <Route path="/rooms" element={<Rooms />} />
            <Route path="/temperature" element={<TemperatureMonitoring />} />
            <Route path="/voltage" element={<VoltageMonitoring />} />
            <Route path="/current" element={<CurrentMonitoring />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <footer className="border-t border-line/50 bg-panel/50 backdrop-blur-sm px-4 py-3.5 sm:px-8 text-xs text-mute flex flex-col sm:flex-row items-center justify-between gap-2">
        <span className="font-medium">
          &copy; {new Date().getFullYear()} Sifat&apos;s Home Automation &bull; Smart IoT Dashboard
        </span>
        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span className="text-on flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-on animate-pulse" />
            Gateway Link Stable
          </span>
          <span className="text-mute/40">&bull;</span>
          <span className="text-accent">ESP32 Firmware v2.4</span>
        </div>
      </footer>
    </div>
  )
}

function HomeGate() {
  const { currentHomeId, loading, error, hasNoHomes, fallbackToDefault } = useHome()
  const { signOut } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)

  // Maximum safety timeout: if still loading after 3 seconds, auto fallback
  useEffect(() => {
    if (!loading && (currentHomeId || hasNoHomes)) return
    const timer = setTimeout(() => {
      fallbackToDefault?.()
    }, 3000)
    return () => clearTimeout(timer)
  }, [loading, currentHomeId, hasNoHomes, fallbackToDefault])

  if (hasNoHomes) {
    return <HomeOnboarding />
  }

  if (error && !currentHomeId) {
    return (
      <main className="grid min-h-screen place-items-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-6 shadow-2xl">
          <TriangleAlert className="size-8 text-warn" />
          <h2 className="mt-3 text-lg font-bold">Home Setup Notice</h2>
          <p className="mt-2 text-sm text-mute">{error}</p>
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => fallbackToDefault?.()}
              className="flex-1 rounded-xl bg-brand py-2.5 text-xs font-bold text-white hover:brightness-110 cursor-pointer"
            >
              Continue to Dashboard
            </button>
            <button
              onClick={signOut}
              className="rounded-xl border border-line px-4 py-2.5 text-xs font-bold text-mute hover:bg-panel2 cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      </main>
    )
  }

  if (loading && !currentHomeId) {
    return (
      <div className="grid min-h-screen place-items-center p-4 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 -left-40 size-80 rounded-full bg-cyan-600/10 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-40 -right-40 size-80 rounded-full bg-blue-600/15 blur-[100px]" />
        <div className="flex flex-col items-center gap-4 text-center z-10 glass-panel rounded-3xl p-8 shadow-2xl">
          <div className="relative">
            <div className="size-12 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            <div className="absolute inset-0 size-12 rounded-full bg-accent/20 blur-md pointer-events-none" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-ink tracking-tight">Initializing Sifat&apos;s Home Automation</h3>
            <p className="mt-1 text-xs text-mute">Connecting to Cloud Telemetry &amp; Actuation Bus…</p>
          </div>
          <button
            onClick={() => fallbackToDefault?.()}
            className="mt-2 text-xs font-semibold text-accent hover:underline cursor-pointer"
          >
            Taking a moment? Continue to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <RefreshContext.Provider value={() => setRefreshKey((k) => k + 1)}>
      <DashboardDataProvider key={`${currentHomeId || 'default'}-${refreshKey}`}>
        <Shell />
      </DashboardDataProvider>
    </RefreshContext.Provider>
  )
}

function Gate() {
  const { user, loading } = useAuth()

  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="size-8 animate-spin text-accent" /></div>
  if (!user) return <Login />
  return (
    <HomeProvider>
      <HomeGate />
    </HomeProvider>
  )
}

export default function App() {
  if (initError) {
    return (
      <main className="grid min-h-screen place-items-center p-4">
        <div className="max-w-lg rounded-2xl border border-bad/50 bg-panel p-8">
          <TriangleAlert className="size-9 text-bad" />
          <h1 className="mt-3 text-xl font-extrabold">Firebase could not start</h1>
          <p className="mt-2 text-sm text-mute">{initError}</p>
          <p className="mt-2 text-sm text-mute">Check your <code>.env</code> file, then restart <code>npm run dev</code>.</p>
        </div>
      </main>
    )
  }
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
