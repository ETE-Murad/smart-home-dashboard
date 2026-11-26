// Rooms live at /settings/rooms/<roomId> = { name, createdAt, devices: { <deviceId>: { name, type, relay } } }
// A device is just a label + icon for ONE of the 8 hardware relays. Rooms never change what the ESP32 does.
import { ref, push, set, update, remove } from 'firebase/database'
import { db } from '../firebase'
import { RELAYS, SUGGESTED_ROOMS } from '../config'
import { APPLIANCE_ICONS } from '../icons'
import { withTimeout, homePath } from './firebaseService'

const WRITE_TIMEOUT_MS = 8000
const guard = (promise) => withTimeout(promise, WRITE_TIMEOUT_MS, 'Could not reach Firebase.')

export function validateLabel(value, what = 'Name') {
  const clean = String(value ?? '').trim()
  if (clean.length < 1) throw new Error(`${what} cannot be empty.`)
  if (clean.length > 30) throw new Error(`${what} must be 30 characters or fewer.`)
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f<>]/.test(clean)) throw new Error(`${what} contains characters that are not allowed.`)
  return clean
}

/** Checks a device and returns a clean copy. `rooms` is the current list, used to stop two devices sharing a relay. */
export function validateDevice({ name, type, relay }, rooms, ignoreDeviceId = null) {
  const clean = { name: validateLabel(name, 'Device name'), type, relay }
  if (!APPLIANCE_ICONS[type]) throw new Error('Choose a device type.')
  if (!RELAYS.some((r) => r.id === relay)) throw new Error('Choose a switch.')
  for (const room of rooms) {
    const clash = room.devices.find((d) => d.relay === relay && d.id !== ignoreDeviceId)
    if (clash) throw new Error(`Switch ${relay.replace('relay', '')} is already used by "${clash.name}" in ${room.name}.`)
  }
  return clean
}

export function createRoom(name, rooms, customHomeId, initialDevices = []) {
  const clean = validateLabel(name, 'Room name')
  if (rooms.some((r) => r.name.toLowerCase() === clean.toLowerCase())) {
    throw new Error('A room with that name already exists.')
  }
  const key = push(ref(db, homePath('settings/rooms', customHomeId))).key

  const devicesObj = {}
  if (Array.isArray(initialDevices) && initialDevices.length > 0) {
    let tempRooms = [...rooms]
    for (const d of initialDevices) {
      if (!d.name || !d.type || !d.relay) continue
      const valid = validateDevice(d, tempRooms)
      const dKey = push(ref(db, homePath(`settings/rooms/${key}/devices`, customHomeId))).key
      devicesObj[dKey] = valid
      tempRooms = [
        ...tempRooms,
        { id: key, name: clean, devices: [{ id: dKey, ...valid }] },
      ]
    }
  }

  const payload = {
    name: clean,
    createdAt: Date.now(),
  }
  if (Object.keys(devicesObj).length > 0) {
    payload.devices = devicesObj
  }

  return guard(set(ref(db, homePath(`settings/rooms/${key}`, customHomeId)), payload))
}

export function renameRoom(roomId, name, rooms, customHomeId) {
  const clean = validateLabel(name, 'Room name')
  if (rooms.some((r) => r.id !== roomId && r.name.toLowerCase() === clean.toLowerCase())) throw new Error('A room with that name already exists.')
  return guard(set(ref(db, homePath(`settings/rooms/${roomId}/name`, customHomeId)), clean))
}

export const deleteRoom = (roomId, customHomeId) => guard(remove(ref(db, homePath(`settings/rooms/${roomId}`, customHomeId))))

export function addDevice(roomId, device, rooms, customHomeId) {
  const clean = validateDevice(device, rooms)
  const key = push(ref(db, homePath(`settings/rooms/${roomId}/devices`, customHomeId))).key
  return guard(set(ref(db, homePath(`settings/rooms/${roomId}/devices/${key}`, customHomeId)), clean))
}

export function updateDevice(roomId, deviceId, device, rooms, customHomeId) {
  const clean = validateDevice(device, rooms, deviceId)
  return guard(set(ref(db, homePath(`settings/rooms/${roomId}/devices/${deviceId}`, customHomeId)), clean))
}

export const deleteDevice = (roomId, deviceId, customHomeId) => guard(remove(ref(db, homePath(`settings/rooms/${roomId}/devices/${deviceId}`, customHomeId))))

export function seedSuggestedRooms(customHomeId) {
  const now = Date.now()
  const rooms = {}
  const roomsPath = homePath('settings/rooms', customHomeId)
  SUGGESTED_ROOMS.forEach((room, i) => {
    const devices = {}
    room.devices.forEach((d) => { devices[push(ref(db, roomsPath)).key] = d })
    rooms[push(ref(db, roomsPath)).key] = { name: room.name, createdAt: now + i, devices }
  })
  return guard(update(ref(db, roomsPath), rooms))
}
