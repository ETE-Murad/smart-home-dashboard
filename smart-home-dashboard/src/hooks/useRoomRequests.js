import { useEffect, useMemo, useState } from 'react'
import { listen, friendlyError, homePath } from '../services/firebaseService'

export function useRoomRequests(customHomeId) {
  const [raw, setRaw] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!customHomeId || customHomeId === 'default') {
      setRaw({})
      setLoading(false)
      return
    }

    setLoading(true)
    const unsub = listen(
      homePath('roomRequests', customHomeId),
      (data) => {
        setRaw(data && typeof data === 'object' ? data : {})
        setLoading(false)
      },
      (err) => {
        setError(friendlyError(err))
        setLoading(false)
      },
    )

    return () => unsub()
  }, [customHomeId])

  const requests = useMemo(() => {
    return Object.entries(raw)
      .map(([id, item]) => ({
        id,
        type: item?.type || 'unknown',
        status: item?.status || 'pending',
        requesterUid: item?.requesterUid || '',
        requesterEmail: item?.requesterEmail || 'Member',
        createdAt: typeof item?.createdAt === 'number' ? item.createdAt : 0,
        reviewedAt: typeof item?.reviewedAt === 'number' ? item.reviewedAt : null,
        reason: item?.reason || '',
        details: item?.details || {},
      }))
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [raw])

  const pendingRequests = useMemo(() => {
    return requests.filter((r) => r.status === 'pending')
  }, [requests])

  return {
    requests,
    pendingRequests,
    pendingCount: pendingRequests.length,
    loading,
    error,
  }
}
