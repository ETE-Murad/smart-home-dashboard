import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  Save,
  Trash2,
  Sparkles,
  DoorOpen,
  Send,
  ShieldAlert,
  Lock,
  Cpu,
  Users,
} from 'lucide-react'
import ConfirmationModal from '../components/ConfirmationModal'
import RoomRequestsPanel from '../components/RoomRequestsPanel'
import { useAuth } from '../context/AuthContext'
import { useDashboard } from '../context/DashboardData'
import { useToast } from '../context/ToastContext'
import { friendlyError } from '../services/firebaseService'
import {
  createRoom,
  renameRoom,
  deleteRoom,
  addDevice,
  updateDevice,
  deleteDevice,
  seedSuggestedRooms,
  validateLabel,
  validateDevice,
} from '../services/roomService'
import { submitRoomRequest } from '../services/roomRequestService'
import { APPLIANCE_ICONS, getApplianceIcon } from '../icons'
import { RELAYS } from '../config'

const card = 'glass-panel rounded-2xl p-6 shadow-[var(--shadow)] transition-all'
const input = 'rounded-xl border border-line bg-panel2 px-3.5 py-2 text-xs text-ink min-w-0 focus:border-accent focus:outline-none transition-colors'
const btn = 'flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all cursor-pointer'

/** Relay dropdown: relays used by another device are shown but cannot be picked. */
function RelaySelect({ value, onChange, rooms, ownDeviceId, label, extraUsedRelays = [] }) {
  const owner = {}
  rooms.forEach((room) =>
    room.devices.forEach((d) => {
      if (d.id !== ownDeviceId) owner[d.relay] = `${room.name} · ${d.name}`
    }),
  )
  extraUsedRelays.forEach((comp) => {
    owner[comp.relay] = `New room · ${comp.name}`
  })
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={input}
    >
      {RELAYS.map((r) => (
        <option key={r.id} value={r.id} disabled={Boolean(owner[r.id])}>
          Switch {r.number} (GPIO {r.gpio}){owner[r.id] ? ` – used by ${owner[r.id]}` : ''}
        </option>
      ))}
    </select>
  )
}

const TypeSelect = ({ value, onChange, label }) => (
  <select
    aria-label={label}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={input}
  >
    {Object.entries(APPLIANCE_ICONS).map(([key, { label: text }]) => (
      <option key={key} value={key}>
        {text}
      </option>
    ))}
  </select>
)

function DeviceRow({ room, device, rooms, onRemove, isOwner, homeId, user }) {
  const { notify } = useToast()
  const [name, setName] = useState(device.name)
  const [type, setType] = useState(device.type)
  const [relay, setRelay] = useState(device.relay)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(device.name)
    setType(device.type)
    setRelay(device.relay)
  }, [device.name, device.type, device.relay])

  const changed = name !== device.name || type !== device.type || relay !== device.relay

  async function save() {
    setErr('')
    const trimmedName = name.trim()
    if (type === 'plug' && !trimmedName) {
      setErr('Please enter the name of the device for "Others".')
      return
    }
    const finalName = trimmedName || APPLIANCE_ICONS[type]?.label || 'Device'

    setSaving(true)
    try {
      if (isOwner) {
        await updateDevice(room.id, device.id, { name: finalName, type, relay }, rooms, homeId)
        notify('success', 'Device saved')
      } else {
        const clean = validateDevice({ name: finalName, type, relay }, rooms, device.id)
        await submitRoomRequest(homeId, {
          type: 'update_device',
          details: {
            roomId: room.id,
            roomName: room.name,
            deviceId: device.id,
            device: clean,
            oldDevice: { name: device.name, type: device.type, relay: device.relay },
          },
          requesterUid: user?.uid,
          requesterEmail: user?.email,
        })
        notify('success', 'Permission request sent to owner for approval')
      }
    } catch (e) {
      setErr(e.message || friendlyError(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border-t border-line/60 py-3 space-y-1">
      <div className="grid items-center gap-2 sm:grid-cols-[1fr_11rem_13rem_auto_auto]">
        <div className="relative">
          <input
            aria-label="Device name"
            value={name}
            maxLength={30}
            placeholder={
              type === 'plug'
                ? 'Type custom device name (e.g. Router, Charger)...'
                : `Device name (${APPLIANCE_ICONS[type]?.label || 'Device'})`
            }
            onChange={(e) => {
              setName(e.target.value)
              if (err) setErr('')
            }}
            className={`${input} w-full ${type === 'plug' && !name.trim() ? 'border-accent ring-1 ring-accent/40 bg-accent/5' : ''}`}
          />
          {type === 'plug' && !name.trim() && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-accent uppercase tracking-wider">
              Name Required
            </span>
          )}
        </div>
        <TypeSelect label="Device type" value={type} onChange={setType} />
        <RelaySelect label="Switch" value={relay} onChange={setRelay} rooms={rooms} ownDeviceId={device.id} />
        <button
          disabled={!changed || saving}
          onClick={save}
          className={`${btn} ${isOwner ? 'bg-brand' : 'bg-accent'} text-white hover:brightness-110 disabled:opacity-40`}
        >
          {isOwner ? <Save className="size-4" /> : <Send className="size-4" />}
          {isOwner ? 'Save' : 'Request Save'}
        </button>
        <button
          onClick={() => onRemove(device)}
          aria-label={isOwner ? `Remove ${device.name}` : `Request removal of ${device.name}`}
          title={isOwner ? 'Remove device' : 'Request owner to remove device'}
          className={`${btn} border border-line text-bad hover:bg-bad/10`}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      {type === 'plug' && !name.trim() && (
        <p className="text-[11px] font-semibold text-accent pl-1">
          ⚡ You selected &quot;Others&quot; &mdash; please specify the custom device name.
        </p>
      )}
      {err && <p role="alert" className="text-xs font-semibold text-bad pl-1">{err}</p>}
    </div>
  )
}

function AddDevice({ room, rooms, isOwner, homeId, user }) {
  const { notify } = useToast()
  const used = new Set(rooms.flatMap((r) => r.devices.map((d) => d.relay)))
  const firstFree = RELAYS.find((r) => !used.has(r.id))?.id
  const [name, setName] = useState('')
  const [type, setType] = useState('light')
  const [relay, setRelay] = useState(firstFree || 'relay1')
  const [err, setErr] = useState('')
  const [adding, setAdding] = useState(false)
  const nameInputRef = useRef(null)

  useEffect(() => {
    if (firstFree && used.has(relay)) setRelay(firstFree)
  }, [firstFree, used, relay])

  if (!firstFree) {
    return (
      <p className="border-t border-line/60 pt-3 text-xs text-mute">
        All {RELAYS.length} switches are assigned. Remove a device to free one.
      </p>
    )
  }

  const handleTypeChange = (newType) => {
    setType(newType)
    if (err) setErr('')
    if (newType === 'plug') {
      setTimeout(() => nameInputRef.current?.focus(), 60)
    }
  }

  async function add(e) {
    e.preventDefault()
    setErr('')
    const trimmedName = name.trim()
    if (type === 'plug' && !trimmedName) {
      setErr('Please enter the name of the device for "Others".')
      nameInputRef.current?.focus()
      return
    }

    setAdding(true)
    try {
      const devName = trimmedName || APPLIANCE_ICONS[type]?.label || 'Device'
      const dev = { name: devName, type, relay }
      if (isOwner) {
        await addDevice(room.id, dev, rooms, homeId)
        setName('')
        notify('success', `Device "${devName}" added`)
      } else {
        const clean = validateDevice(dev, rooms)
        await submitRoomRequest(homeId, {
          type: 'add_device',
          details: {
            roomId: room.id,
            roomName: room.name,
            device: clean,
          },
          requesterUid: user?.uid,
          requesterEmail: user?.email,
        })
        setName('')
        notify('success', 'Permission request sent to owner for approval')
      }
    } catch (error) {
      setErr(error.message || friendlyError(error))
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="border-t border-line/60 pt-3 space-y-2">
      <form onSubmit={add} className="grid items-center gap-2 sm:grid-cols-[1fr_11rem_13rem_auto]">
        <div className="relative">
          <input
            ref={nameInputRef}
            aria-label="New device name"
            placeholder={
              type === 'plug'
                ? 'Type custom device name (e.g. Air Purifier, Router)...'
                : `Device name (optional, defaults to "${APPLIANCE_ICONS[type]?.label || 'Device'}")`
            }
            value={name}
            maxLength={30}
            onChange={(e) => {
              setName(e.target.value)
              if (err) setErr('')
            }}
            className={`${input} w-full ${type === 'plug' ? 'border-accent ring-1 ring-accent/40 bg-accent/5' : ''}`}
          />
          {type === 'plug' && !name.trim() && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-accent uppercase tracking-wider">
              Name Required
            </span>
          )}
        </div>
        <TypeSelect label="New device type" value={type} onChange={handleTypeChange} />
        <RelaySelect label="Switch for new device" value={relay} onChange={setRelay} rooms={rooms} ownDeviceId={null} />
        <button
          disabled={adding}
          className={`${btn} border border-accent bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-50`}
        >
          {isOwner ? <Plus className="size-4" /> : <Send className="size-4" />}
          {isOwner ? 'Add device' : 'Request Add Device'}
        </button>
      </form>
      {type === 'plug' && (
        <p className="text-[11px] font-semibold text-accent flex items-center gap-1.5 pl-1 animate-in fade-in duration-200">
          <span>⚡</span> You selected &quot;Others&quot; &mdash; please specify the custom device name in the input box above.
        </p>
      )}
      {err && <p role="alert" className="text-xs font-semibold text-bad pl-1">{err}</p>}
    </div>
  )
}

function RoomCard({ room, rooms, onDeleteRoom, onRemoveDevice, isOwner, homeId, user }) {
  const { notify } = useToast()
  const [name, setName] = useState(room.name)
  const [err, setErr] = useState('')
  const [renaming, setRenaming] = useState(false)

  useEffect(() => setName(room.name), [room.name])

  async function save() {
    setErr('')
    setRenaming(true)
    try {
      if (isOwner) {
        await renameRoom(room.id, name, rooms, homeId)
        notify('success', 'Room renamed')
      } else {
        const clean = validateLabel(name, 'Room name')
        if (rooms.some((r) => r.id !== room.id && r.name.toLowerCase() === clean.toLowerCase())) {
          throw new Error('A room with that name already exists.')
        }
        await submitRoomRequest(homeId, {
          type: 'rename_room',
          details: {
            roomId: room.id,
            oldName: room.name,
            newName: clean,
          },
          requesterUid: user?.uid,
          requesterEmail: user?.email,
        })
        notify('success', 'Permission request sent to owner for approval')
      }
    } catch (e) {
      setErr(e.message || friendlyError(e))
    } finally {
      setRenaming(false)
    }
  }

  return (
    <section className={card}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Room name"
          value={name}
          maxLength={30}
          onChange={(e) => setName(e.target.value)}
          className={`${input} flex-1 text-base font-bold`}
        />
        <button
          disabled={name === room.name || renaming}
          onClick={save}
          className={`${btn} ${isOwner ? 'bg-brand' : 'bg-accent'} text-white hover:brightness-110 disabled:opacity-40`}
        >
          {isOwner ? <Save className="size-4" /> : <Send className="size-4" />}
          {isOwner ? 'Rename' : 'Request Rename'}
        </button>
        <button
          onClick={() => onDeleteRoom(room)}
          className={`${btn} border border-line text-bad hover:bg-bad/10`}
          title={isOwner ? 'Delete room' : 'Request owner to delete room'}
        >
          <Trash2 className="size-4" />
          {isOwner ? 'Delete room' : 'Request Delete'}
        </button>
      </div>
      {err && <p role="alert" className="mt-2 text-xs text-bad">{err}</p>}
      <div className="mt-3">
        {room.devices.length === 0 && <p className="py-2 text-sm text-mute">No devices in this room yet.</p>}
        {room.devices.map((d) => (
          <DeviceRow
            key={d.id}
            room={room}
            device={{ ...d, relay: d.relayId }}
            rooms={rooms}
            onRemove={(dev) => onRemoveDevice(room, dev)}
            isOwner={isOwner}
            homeId={homeId}
            user={user}
          />
        ))}
        <AddDevice room={room} rooms={rooms} isOwner={isOwner} homeId={homeId} user={user} />
      </div>
    </section>
  )
}

export default function Rooms() {
  const { user } = useAuth()
  const { roomView, roomsData, home, homeId, roomRequests } = useDashboard()
  const { notify } = useToast()
  const [newRoom, setNewRoom] = useState('')
  const [err, setErr] = useState('')
  const [addingRoom, setAddingRoom] = useState(false)
  const [confirm, setConfirm] = useState(null) // { kind: 'room'|'device', room, device? }

  const [showAddComponent, setShowAddComponent] = useState(false)
  const [pendingComponents, setPendingComponents] = useState([])
  const [compName, setCompName] = useState('')
  const [compType, setCompType] = useState('light')
  const [compRelay, setCompRelay] = useState('relay1')
  const [compErr, setCompErr] = useState('')
  const compInputRef = useRef(null)

  const isOwner = Boolean(home?.isOwner)

  // Flat shape the service validators expect: devices carry their relay id in `relay`.
  const rooms = roomsData.rooms
  const viewRooms = roomView.rooms

  // Auto-select first available unused relay when rooms or components change
  useEffect(() => {
    const used = new Set()
    rooms.forEach((r) => r.devices.forEach((d) => used.add(d.relay)))
    pendingComponents.forEach((c) => used.add(c.relay))
    const firstFree = RELAYS.find((r) => !used.has(r.id))
    if (firstFree) setCompRelay(firstFree.id)
  }, [rooms, pendingComponents])

  function handleAddPendingComponent(e) {
    if (e) e.preventDefault()
    setCompErr('')
    try {
      const trimmed = compName.trim()
      if (compType === 'plug' && !trimmed) {
        compInputRef.current?.focus()
        throw new Error('Please enter the name of the device for "Others".')
      }
      const rawName = trimmed || APPLIANCE_ICONS[compType]?.label || 'Device'
      const clean = validateLabel(rawName, 'Component name')
      let tempRooms = [...rooms]
      for (const comp of pendingComponents) {
        tempRooms = [
          ...tempRooms,
          { id: 'temp', name: newRoom || 'New Room', devices: [comp] },
        ]
      }
      const valid = validateDevice({ name: clean, type: compType, relay: compRelay }, tempRooms)
      setPendingComponents((prev) => [
        ...prev,
        { id: Date.now().toString(), ...valid },
      ])
      setCompName('')
    } catch (err) {
      setCompErr(err.message || friendlyError(err))
    }
  }

  function removePendingComponent(id) {
    setPendingComponents((prev) => prev.filter((c) => c.id !== id))
  }

  async function add(e) {
    e.preventDefault()
    setErr('')
    setAddingRoom(true)
    try {
      const cleanRoomName = validateLabel(newRoom, 'Room name')
      if (rooms.some((r) => r.name.toLowerCase() === cleanRoomName.toLowerCase())) {
        throw new Error('A room with that name already exists.')
      }

      let tempRooms = [...rooms]
      const validComponents = []
      for (const comp of pendingComponents) {
        const validated = validateDevice(comp, tempRooms)
        validComponents.push(validated)
        tempRooms = [
          ...tempRooms,
          { id: 'temp', name: cleanRoomName, devices: [validated] },
        ]
      }

      if (isOwner) {
        await createRoom(cleanRoomName, rooms, homeId, validComponents)
        setNewRoom('')
        setPendingComponents([])
        setShowAddComponent(false)
        notify(
          'success',
          validComponents.length > 0
            ? `Room "${cleanRoomName}" added with ${validComponents.length} component(s)`
            : `Room "${cleanRoomName}" added`
        )
      } else {
        await submitRoomRequest(homeId, {
          type: 'create_room',
          details: {
            name: cleanRoomName,
            devices: validComponents,
          },
          requesterUid: user?.uid,
          requesterEmail: user?.email,
        })
        setNewRoom('')
        setPendingComponents([])
        setShowAddComponent(false)
        notify(
          'success',
          validComponents.length > 0
            ? `Permission request to create room with ${validComponents.length} component(s) sent to owner for approval`
            : 'Permission request to create room sent to owner for approval'
        )
      }
    } catch (error) {
      setErr(error.message || friendlyError(error))
    } finally {
      setAddingRoom(false)
    }
  }

  async function seed() {
    try {
      if (isOwner) {
        await seedSuggestedRooms(homeId)
        notify('success', 'Suggested rooms created')
      } else {
        await submitRoomRequest(homeId, {
          type: 'seed_rooms',
          details: {},
          requesterUid: user?.uid,
          requesterEmail: user?.email,
        })
        notify('success', 'Permission request sent to owner for approval')
      }
    } catch (error) {
      notify('error', friendlyError(error))
    }
  }

  async function confirmed() {
    const c = confirm
    setConfirm(null)
    try {
      if (isOwner) {
        if (c.kind === 'room') await deleteRoom(c.room.id, homeId)
        else await deleteDevice(c.room.id, c.device.id, homeId)
        notify('success', c.kind === 'room' ? 'Room deleted' : 'Device removed')
      } else {
        if (c.kind === 'room') {
          await submitRoomRequest(homeId, {
            type: 'delete_room',
            details: {
              roomId: c.room.id,
              roomName: c.room.name,
              deviceCount: c.room.devices.length,
            },
            requesterUid: user?.uid,
            requesterEmail: user?.email,
          })
          notify('success', `Permission request to delete "${c.room.name}" sent to owner`)
        } else {
          await submitRoomRequest(homeId, {
            type: 'delete_device',
            details: {
              roomId: c.room.id,
              roomName: c.room.name,
              deviceId: c.device.id,
              deviceName: c.device.name,
            },
            requesterUid: user?.uid,
            requesterEmail: user?.email,
          })
          notify('success', `Permission request to remove "${c.device.name}" sent to owner`)
        }
      }
    } catch (error) {
      notify('error', friendlyError(error))
    }
  }

  const stillOn = (devs) =>
    devs.filter(
      (d) =>
        viewRooms.flatMap((r) => r.devices).find((x) => x.id === d.id)?.relay?.actual === true,
    ).length

  const deleteText = () => {
    if (!confirm) return ''
    const devs = confirm.kind === 'room' ? confirm.room.devices : [confirm.device]
    const on = stillOn(devs)
    const baseAction = isOwner
      ? (confirm.kind === 'room'
          ? `"${confirm.room.name}" and its ${devs.length} device(s) will be removed from the website.`
          : `"${confirm.device.name}" will be removed from "${confirm.room.name}".`)
      : (confirm.kind === 'room'
          ? `A permission request will be sent to the home owner to delete room "${confirm.room.name}". The room will only be deleted once the owner approves.`
          : `A permission request will be sent to the home owner to remove device "${confirm.device.name}". The device will only be removed once the owner approves.`)

    return (
      `${baseAction} ` +
      'The switch itself is not switched. ' +
      (on
        ? `${on} of them ${on === 1 ? 'is' : 'are'} ON right now and will stay ON; the switch will become available again to reassign to a new appliance.`
        : 'The switch will become available again to assign to a new appliance.')
    )
  }

  if (roomsData.loading) return <p className="text-mute">Loading rooms…</p>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold">Rooms</h2>
          <p className="text-sm text-mute">
            Group your appliances by room. Each device (light, fan, …) is linked to one of the physical switches.
          </p>
        </div>
        {isOwner ? (
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel2 px-3.5 py-1.5 text-xs font-semibold text-mute hover:text-accent hover:border-accent/40 transition-colors"
          >
            <Users className="size-3.5 text-brand" />
            <span>Household Accounts &amp; Ownership</span>
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel2 px-3 py-1 text-xs font-semibold text-mute">
            <Lock className="size-3.5 text-accent" />
            Member View · Admin Approval Required
          </span>
        )}
      </div>

      {roomsData.error && (
        <p role="alert" className="rounded-xl bg-bad/15 p-3 text-sm text-bad">
          {roomsData.error}
        </p>
      )}

      {/* Member Notice */}
      {!isOwner && (
        <div className="flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent/10 p-4 text-xs text-ink">
          <ShieldAlert className="size-5 shrink-0 text-accent mt-0.5" />
          <div>
            <p className="font-bold text-sm text-accent">Member Mode · Admin Approval Required</p>
            <p className="text-mute mt-0.5">
              Only the home admin can modify rooms and devices directly. When you propose adding, renaming, or removing rooms and devices, a permission message will be sent to the owner for approval.
            </p>
          </div>
        </div>
      )}

      {/* Pending / Change Requests Panel */}
      <RoomRequestsPanel
        homeId={homeId}
        isOwner={isOwner}
        user={user}
        roomRequests={roomRequests}
        currentRooms={rooms}
      />

      {/* Add / Request Room Card */}
      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-accent/20 text-accent">
              <DoorOpen className="size-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-ink">
                {isOwner ? 'Add a New Room' : 'Request a New Room'}
              </h3>
              <p className="text-xs text-mute">
                {isOwner
                  ? 'Create a room and optionally attach components directly.'
                  : 'Propose a new room to the household owner with optional components (lights, fans, etc.) and wait for approval.'}
              </p>
            </div>
          </div>
          {!isOwner && (
            <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-bold text-accent">
              Requires Owner Approval
            </span>
          )}
        </div>

        <form onSubmit={add} className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              aria-label="New room name"
              placeholder="Room name (e.g. Balcony, Study, Garage)"
              value={newRoom}
              maxLength={30}
              onChange={(e) => setNewRoom(e.target.value)}
              className={`${input} flex-1 text-sm`}
            />

            <button
              type="button"
              onClick={() => setShowAddComponent((prev) => !prev)}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-panel2 px-3 py-2 text-xs font-semibold text-ink hover:bg-panel hover:border-accent transition-colors"
            >
              <Cpu className="size-3.5 text-accent" />
              {showAddComponent ? 'Hide Components Option' : '+ Add Components (Optional)'}
              {pendingComponents.length > 0 && (
                <span className="rounded-full bg-accent px-1.5 py-0.2 text-[10px] font-bold text-white">
                  {pendingComponents.length}
                </span>
              )}
            </button>

            <button
              type="submit"
              disabled={addingRoom || !newRoom.trim()}
              className={`${btn} ${isOwner ? 'bg-brand' : 'bg-accent'} text-white hover:brightness-110 disabled:opacity-50`}
            >
              {isOwner ? <Plus className="size-4" /> : <Send className="size-4" />}
              {isOwner
                ? (pendingComponents.length > 0 ? `Add Room with ${pendingComponents.length} Component${pendingComponents.length === 1 ? '' : 's'}` : 'Add Room')
                : (pendingComponents.length > 0 ? `Request Room (${pendingComponents.length} Component${pendingComponents.length === 1 ? '' : 's'})` : 'Request Room')}
            </button>
          </div>

          {err && <p role="alert" className="text-xs text-bad">{err}</p>}

          {/* Pending Components List (if any attached) */}
          {pendingComponents.length > 0 && (
            <div className="space-y-2 rounded-xl border border-line/60 bg-panel2/40 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-ink">
                  Attached Components ({pendingComponents.length})
                </span>
                <span className="text-[11px] text-mute">
                  Will be {isOwner ? 'created' : 'requested'} with this room
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {pendingComponents.map((comp) => {
                  const Icon = getApplianceIcon(comp.type)
                  return (
                    <div
                      key={comp.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="grid size-7 place-items-center rounded-lg bg-panel2 text-accent">
                          <Icon className="size-3.5" />
                        </span>
                        <div>
                          <p className="font-semibold text-ink">{comp.name}</p>
                          <p className="text-[11px] text-mute">
                            {APPLIANCE_ICONS[comp.type]?.label || comp.type} · Switch {comp.relay.replace('relay', '')}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePendingComponent(comp.id)}
                        className="rounded p-1 text-mute hover:bg-bad/10 hover:text-bad transition-colors"
                        title="Remove component"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Component Creator Drawer */}
          {showAddComponent && (
            <div className="rounded-xl border border-dashed border-accent/40 bg-accent/5 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-accent">
                  Add Component to this Room
                </h4>
                <span className="text-[11px] text-mute">Pick an available switch &amp; appliance type</span>
              </div>

              <div className="grid items-center gap-2 sm:grid-cols-[1fr_11rem_13rem_auto]">
                <div className="relative">
                  <input
                    ref={compInputRef}
                    aria-label="Component name"
                    placeholder={
                      compType === 'plug'
                        ? 'Type custom device name (e.g. Air Purifier, Router)...'
                        : `Component name (e.g. ${APPLIANCE_ICONS[compType]?.label || 'Ceiling Light'})`
                    }
                    value={compName}
                    maxLength={30}
                    onChange={(e) => {
                      setCompName(e.target.value)
                      if (compErr) setCompErr('')
                    }}
                    className={`${input} w-full ${compType === 'plug' ? 'border-accent ring-1 ring-accent/40 bg-accent/5' : ''}`}
                  />
                  {compType === 'plug' && !compName.trim() && (
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-accent uppercase tracking-wider">
                      Name Required
                    </span>
                  )}
                </div>
                <TypeSelect
                  label="Component type"
                  value={compType}
                  onChange={(t) => {
                    setCompType(t)
                    if (compErr) setCompErr('')
                    if (t === 'plug') setTimeout(() => compInputRef.current?.focus(), 60)
                  }}
                />
                <RelaySelect
                  label="Switch for component"
                  value={compRelay}
                  onChange={setCompRelay}
                  rooms={rooms}
                  ownDeviceId={null}
                  extraUsedRelays={pendingComponents}
                />
                <button
                  type="button"
                  onClick={handleAddPendingComponent}
                  disabled={compType === 'plug' && !compName.trim()}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50 cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  Attach
                </button>
              </div>
              {compType === 'plug' && (
                <p className="text-[11px] font-semibold text-accent flex items-center gap-1.5 animate-in fade-in duration-200">
                  <span>⚡</span> You selected &quot;Others&quot; &mdash; please enter the custom device name in the input box above.
                </p>
              )}
              {compErr && <p role="alert" className="text-xs font-semibold text-bad pl-1">{compErr}</p>}
            </div>
          )}

          {!isOwner && (
            <p className="text-[11px] text-mute">
              * The request will appear under the owner's Pending Requests panel. Once approved by the owner, the new room and its configured components will be automatically activated in this home.
            </p>
          )}
        </form>
      </section>

      {/* Empty State */}
      {rooms.length === 0 && (
        <div className={`${card} text-center`}>
          <p className="font-semibold">No rooms yet</p>
          <p className="mt-1 text-sm text-mute">
            Add your own above, or start from Living Room, Bedroom, Kitchen, Bathroom and Other with pre-assigned switches.
          </p>
          <button
            onClick={seed}
            className={`${btn} mx-auto mt-4 border border-accent text-accent hover:bg-accent/10`}
          >
            {isOwner ? <Sparkles className="size-4" /> : <Send className="size-4" />}
            {isOwner ? 'Use suggested rooms' : 'Request suggested rooms'}
          </button>
        </div>
      )}

      {/* Rooms List */}
      {viewRooms.map((room) => (
        <RoomCard
          key={room.id}
          room={room}
          rooms={rooms}
          isOwner={isOwner}
          homeId={homeId}
          user={user}
          onDeleteRoom={(r) =>
            setConfirm({ kind: 'room', room: rooms.find((x) => x.id === r.id) })
          }
          onRemoveDevice={(r, d) =>
            setConfirm({
              kind: 'device',
              room: rooms.find((x) => x.id === r.id),
              device: { id: d.id, name: d.name },
            })
          }
        />
      ))}

      {/* Confirmation Modal */}
      <ConfirmationModal
        open={Boolean(confirm)}
        danger={isOwner}
        title={
          isOwner
            ? confirm?.kind === 'room'
              ? 'Delete this room?'
              : 'Remove this device?'
            : confirm?.kind === 'room'
            ? 'Request room deletion?'
            : 'Request device removal?'
        }
        message={deleteText()}
        confirmLabel={isOwner ? 'Delete' : 'Send Request to Owner'}
        onCancel={() => setConfirm(null)}
        onConfirm={confirmed}
      />
    </div>
  )
}
