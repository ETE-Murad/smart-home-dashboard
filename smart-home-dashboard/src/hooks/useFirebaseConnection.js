import { useEffect, useRef, useState } from 'react'
import { ref, onValue } from 'firebase/database'
import { db } from '../firebase'

/** Is THIS browser connected to Firebase? (Not the same as the ESP32 being online.) */
export function useFirebaseConnection() {
  const [connected, setConnected] = useState(false)
  const [offsetMs, setOffsetMs] = useState(0)
  const [graceOver, setGraceOver] = useState(false)
  const everConnected = useRef(false)

  useEffect(() => {
    const unsubConn = onValue(ref(db, '.info/connected'), (snap) => {
      const value = snap.val() === true
      if (value) everConnected.current = true
      setConnected(value)
    })
    const unsubOffset = onValue(ref(db, '.info/serverTimeOffset'), (snap) => setOffsetMs(snap.val() || 0))
    const timer = setTimeout(() => setGraceOver(true), 8000)
    return () => {
      unsubConn()
      unsubOffset()
      clearTimeout(timer)
    }
  }, [])

  const status = connected ? 'connected' : everConnected.current || graceOver ? 'disconnected' : 'connecting'
  return { status, connected, offsetMs }
}
