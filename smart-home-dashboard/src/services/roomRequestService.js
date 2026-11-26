import { ref, push, set, update, remove } from 'firebase/database'
import { db } from '../firebase'
import { withTimeout, homePath } from './firebaseService'
import {
  createRoom,
  renameRoom,
  deleteRoom,
  addDevice,
  updateDevice,
  deleteDevice,
  seedSuggestedRooms,
} from './roomService'

const TIMEOUT_MS = 8000
const guard = (promise) => withTimeout(promise, TIMEOUT_MS, 'Could not reach Firebase.')

/**
 * Submit a request from a member to change rooms or devices.
 * Types:
 * - 'create_room': { name }
 * - 'rename_room': { roomId, oldName, newName }
 * - 'delete_room': { roomId, roomName }
 * - 'add_device': { roomId, roomName, device: { name, type, relay } }
 * - 'update_device': { roomId, roomName, deviceId, device: { name, type, relay }, oldDevice }
 * - 'delete_device': { roomId, roomName, deviceId, deviceName }
 * - 'seed_rooms': {}
 */
export function submitRoomRequest(homeId, { type, details, requesterUid, requesterEmail }) {
  if (!homeId) throw new Error('Home ID is required.')
  if (!requesterUid) throw new Error('User must be signed in.')

  const requestsRef = ref(db, homePath('roomRequests', homeId))
  const newRef = push(requestsRef)

  const payload = {
    type,
    status: 'pending',
    requesterUid,
    requesterEmail: requesterEmail || 'Member',
    createdAt: Date.now(),
    details: details || {},
  }

  return guard(set(newRef, payload))
}

/**
 * Admin / Owner approves a pending request and applies the change to settings/rooms.
 */
export async function approveRoomRequest(homeId, request, currentRooms) {
  if (!homeId || !request) throw new Error('Missing request data.')

  const { type, details } = request

  switch (type) {
    case 'create_room':
      await createRoom(details.name, currentRooms, homeId, details.devices || [])
      break

    case 'rename_room':
      await renameRoom(details.roomId, details.newName, currentRooms, homeId)
      break

    case 'delete_room':
      await deleteRoom(details.roomId, homeId)
      break

    case 'add_device':
      await addDevice(details.roomId, details.device, currentRooms, homeId)
      break

    case 'update_device':
      await updateDevice(details.roomId, details.deviceId, details.device, currentRooms, homeId)
      break

    case 'delete_device':
      await deleteDevice(details.roomId, details.deviceId, homeId)
      break

    case 'seed_rooms':
      await seedSuggestedRooms(homeId)
      break

    default:
      throw new Error(`Unknown request type: ${type}`)
  }

  // Mark request as approved
  const reqRef = ref(db, homePath(`roomRequests/${request.id}`, homeId))
  return guard(update(reqRef, {
    status: 'approved',
    reviewedAt: Date.now(),
  }))
}

/**
 * Admin / Owner rejects a pending request.
 */
export function rejectRoomRequest(homeId, requestId, reason = '') {
  if (!homeId || !requestId) throw new Error('Missing request data.')
  const reqRef = ref(db, homePath(`roomRequests/${requestId}`, homeId))
  return guard(update(reqRef, {
    status: 'rejected',
    reviewedAt: Date.now(),
    reason: String(reason || '').trim(),
  }))
}

/**
 * Dismiss / delete a request from history.
 */
export function dismissRoomRequest(homeId, requestId) {
  if (!homeId || !requestId) return Promise.resolve()
  const reqRef = ref(db, homePath(`roomRequests/${requestId}`, homeId))
  return guard(remove(reqRef))
}
