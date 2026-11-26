import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listen, friendlyError, isPermissionDenied, homePath } from '../services/firebaseService'
import { setRelayDesired, setManyRelaysDesired, validateRelayId } from '../services/relayService'
import { RELAYS, COMMAND_TIMEOUT_MS } from '../config'

/**
 * Three different ideas, kept apart on purpose:
 *   desired = /relays/relayN            what the user asked for
 *   actual  = /relayStatus/relayN/state what the ESP32 reports it really did
 *   command = local tracking of a request that is still waiting for confirmation
 * The switch only changes when `actual` changes. Nothing is shown as ON optimistically.
 */
export function useRelays({ homeId, deviceOnline, notify, labelFor = (id) => id }) {
  const [desired, setDesired] = useState({})
  const [status, setStatus] = useState({})
  const [commands, setCommands] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const inflight = useRef(new Set())
  const toasted = useRef(new Set())

  useEffect(() => {
    const fail = (err) => {
      setError(friendlyError(err))
      setPermissionDenied(isPermissionDenied(err))
      setLoading(false)
    }
    const unsubs = [
      listen(homePath('relays', homeId), (v) => { setDesired(v || {}); setError(null); setLoading(false) }, fail),
      listen(homePath('relayStatus', homeId), (v) => setStatus(v || {}), fail),
    ]
    return () => unsubs.forEach((u) => u())
  }, [homeId])

  // The ESP32 confirmed the requested state -> finish the command.
  useEffect(() => {
    for (const [id, cmd] of Object.entries(commands)) {
      if (cmd.phase !== 'submitting' && status[id]?.state === cmd.target) {
        inflight.current.delete(id)
        setCommands((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
        notify?.('success', `${labelFor(id)} is ${cmd.target ? 'ON' : 'OFF'}`)
      }
    }
  }, [status, commands, labelFor, notify])

  // No confirmation in time -> mark as failed so the user can retry.
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now()
      setCommands((prev) => {
        let changed = false
        const next = { ...prev }
        for (const [id, cmd] of Object.entries(prev)) {
          if (cmd.phase === 'waiting' && now - cmd.startedAt > COMMAND_TIMEOUT_MS) {
            next[id] = { ...cmd, phase: 'failed', error: 'The ESP32 did not confirm in time.' }
            inflight.current.delete(id)
            changed = true
          }
        }
        return changed ? next : prev
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // One toast per failed command.
  useEffect(() => {
    for (const [id, cmd] of Object.entries(commands)) {
      const key = `${id}:${cmd.startedAt}`
      if (cmd.phase === 'failed' && !toasted.current.has(key)) {
        toasted.current.add(key)
        notify?.('error', `${labelFor(id)}: ${cmd.error}`)
      }
    }
  }, [commands, labelFor, notify])

  const request = useCallback(async (id, target) => {
    validateRelayId(id)
    if (typeof target !== 'boolean') return
    if (inflight.current.has(id)) return // blocks double clicks
    inflight.current.add(id)
    setCommands((p) => ({ ...p, [id]: { phase: 'submitting', target, startedAt: Date.now() } }))
    try {
      await setRelayDesired(id, target, homeId)
      setCommands((p) => ({ ...p, [id]: { phase: 'waiting', target, startedAt: Date.now() } }))
    } catch (err) {
      inflight.current.delete(id)
      setCommands((p) => ({ ...p, [id]: { phase: 'failed', target, startedAt: Date.now(), error: friendlyError(err) } }))
    }
  }, [homeId])

  const relays = useMemo(
    () =>
      RELAYS.map((def) => {
        const d = typeof desired[def.id] === 'boolean' ? desired[def.id] : null
        const a = typeof status[def.id]?.state === 'boolean' ? status[def.id].state : null
        const cmd = commands[def.id]
        const busy = cmd?.phase === 'submitting' || cmd?.phase === 'waiting'
        const mismatch = d !== null && a !== null && d !== a
        return {
          ...def,
          name: `Switch ${def.number}`,
          icon: 'plug',
          desired: d,
          actual: a,
          updatedAt: status[def.id]?.updatedAt ?? null,
          phase: cmd?.phase ?? null,
          error: cmd?.phase === 'failed' ? cmd.error : null,
          target: cmd?.target ?? null,
          pending: busy || (mismatch && cmd?.phase !== 'failed'),
        }
      }),
    [desired, status, commands],
  )

  const retry = useCallback((id) => {
    const cmd = commands[id]
    if (!cmd) return
    inflight.current.delete(id)
    request(id, cmd.target)
  }, [commands, request])

  /** All ON / All OFF as one atomic write. */
  const setAll = useCallback(async (target, onlyIds = null) => {
    const pool = onlyIds ? relays.filter((r) => onlyIds.includes(r.id)) : relays
    const ids = pool.filter((r) => r.actual !== target && !inflight.current.has(r.id)).map((r) => r.id)
    if (ids.length === 0) {
      notify?.('info', `Everything is already ${target ? 'ON' : 'OFF'}.`)
      return
    }
    const startedAt = Date.now()
    ids.forEach((id) => inflight.current.add(id))
    setCommands((p) => ({ ...p, ...Object.fromEntries(ids.map((id) => [id, { phase: 'submitting', target, startedAt }])) }))
    try {
      await setManyRelaysDesired(ids, target, homeId)
      setCommands((p) => {
        const next = { ...p }
        ids.forEach((id) => { next[id] = { phase: 'waiting', target, startedAt: Date.now() } })
        return next
      })
    } catch (err) {
      ids.forEach((id) => inflight.current.delete(id))
      setCommands((p) => {
        const next = { ...p }
        ids.forEach((id) => { next[id] = { phase: 'failed', target, startedAt, error: friendlyError(err) } })
        return next
      })
    }
  }, [relays, notify, homeId])

  const counts = useMemo(() => {
    const on = relays.filter((r) => r.actual === true).length
    const off = relays.filter((r) => r.actual === false).length
    return { total: relays.length, on, off, unknown: relays.length - on - off }
  }, [relays])

  const anyPending = relays.some((r) => r.pending)
  return { relays, counts, loading, error, permissionDenied, request, retry, setAll, anyPending, deviceOnline }
}
