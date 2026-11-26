import { createContext, useContext, useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { ref, set, get, update, remove, onValue } from 'firebase/database'
import { db } from '../firebase'
import { useAuth } from './AuthContext'
import { setActiveHomeId, friendlyError, withTimeout } from '../services/firebaseService'

const HomeContext = createContext(null)
export const useHome = () => useContext(HomeContext)

const STORAGE_KEY = 'shd_current_home_id'
const DB_TIMEOUT_MS = 3500

function generateHomeId() {
  return `home_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`
}

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `HOME-${code}`
}

export function HomeProvider({ children }) {
  const { user } = useAuth()
  const [userHomeKeys, setUserHomeKeys] = useState(null)
  const [homesData, setHomesData] = useState({})
  const [currentHomeId, setCurrentHomeId] = useState(() => localStorage.getItem(STORAGE_KEY) || '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isUsingFallback, setIsUsingFallback] = useState(false)
  const isCreatingRef = useRef(false)
  const initTimerRef = useRef(null)

  const fallbackHome = useMemo(() => {
    const namePrefix = user?.email ? user.email.split('@')[0] : 'My'
    return {
      id: 'default',
      name: `${namePrefix}'s Smart Home`,
      owner: user?.uid || '',
      isOwner: true,
      role: 'owner',
      inviteCode: 'DEFAULT',
      requireApproval: true,
      members: user ? { [user.uid]: { role: 'owner', email: user.email, joinedAt: Date.now() } } : {},
      memberCount: 1,
      isDefault: true,
      createdAt: Date.now(),
    }
  }, [user])

  const fallbackToDefault = useCallback(() => {
    setIsUsingFallback(true)
    setCurrentHomeId('default')
    localStorage.setItem(STORAGE_KEY, 'default')
    setActiveHomeId('default')
    setLoading(false)
  }, [])

  // 1. Listen to userHomes/<uid> with timeout protection
  useEffect(() => {
    if (!user) {
      setUserHomeKeys(null)
      setHomesData({})
      setCurrentHomeId('')
      setActiveHomeId(null)
      setIsUsingFallback(false)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    // Hard fallback timer: if Firebase doesn't respond in 4s, fallback to default home
    if (initTimerRef.current) clearTimeout(initTimerRef.current)
    initTimerRef.current = setTimeout(() => {
      if (loading) {
        console.warn('userHomes loading timed out; falling back to default home.')
        fallbackToDefault()
      }
    }, 4000)

    let unsub = () => {}
    try {
      const userHomesRef = ref(db, `userHomes/${user.uid}`)
      unsub = onValue(
        userHomesRef,
        (snapshot) => {
          if (initTimerRef.current) clearTimeout(initTimerRef.current)
          const val = snapshot.val()
          if (val && typeof val === 'object') {
            setUserHomeKeys(Object.keys(val))
          } else {
            setUserHomeKeys([])
          }
        },
        (err) => {
          console.warn('Could not read userHomes (rules may need updating):', err)
          if (initTimerRef.current) clearTimeout(initTimerRef.current)
          fallbackToDefault()
        },
      )
    } catch (err) {
      console.warn('Failed to attach userHomes listener:', err)
      fallbackToDefault()
    }

    return () => {
      if (initTimerRef.current) clearTimeout(initTimerRef.current)
      unsub()
    }
  }, [user, fallbackToDefault])

  // 2. Process signup choice or prepare onboarding for users with no homes
  useEffect(() => {
    if (!user || userHomeKeys === null || userHomeKeys.length > 0 || isCreatingRef.current || isUsingFallback) {
      return
    }

    // Check if there was an explicit setup choice from signup
    const pendingActionRaw = sessionStorage.getItem('shd_signup_action')
    if (pendingActionRaw) {
      try {
        const pending = JSON.parse(pendingActionRaw)
        sessionStorage.removeItem('shd_signup_action')

        if (pending.action === 'join' && pending.joinCode) {
          isCreatingRef.current = true
          joinHome(pending.joinCode)
            .catch((err) => console.warn('Signup join failed:', err))
            .finally(() => {
              isCreatingRef.current = false
              setLoading(false)
            })
          return
        }

        if (pending.action === 'create') {
          isCreatingRef.current = true
          const customName = pending.homeName || `${(user.email || 'My').split('@')[0]}'s Smart Home`
          createHome(customName)
            .catch((err) => console.warn('Signup create failed:', err))
            .finally(() => {
              isCreatingRef.current = false
              setLoading(false)
            })
          return
        }
      } catch (err) {
        console.warn('Failed to parse signup action:', err)
      }
    }

    // No signup action stored and user has 0 homes: ready for onboarding screen
    setLoading(false)
  }, [user, userHomeKeys, isUsingFallback])

  // 3. Listen to each home that the user belongs to
  useEffect(() => {
    if (!user || !userHomeKeys || userHomeKeys.length === 0 || isUsingFallback) {
      if (userHomeKeys && userHomeKeys.length === 0 && !isUsingFallback) {
        setLoading(false)
        return
      }
      setLoading(false)
      return
    }

    let loadedCount = 0
    const unsubs = userHomeKeys.map((hid) => {
      return onValue(
        ref(db, `homes/${hid}`),
        (snap) => {
          const val = snap.val()
          setHomesData((prev) => ({
            ...prev,
            [hid]: val,
          }))
          loadedCount++
          if (loadedCount >= userHomeKeys.length) {
            setLoading(false)
          }
        },
        (err) => {
          console.warn(`Failed reading home ${hid}:`, err)
          loadedCount++
          if (loadedCount >= userHomeKeys.length) {
            setLoading(false)
          }
        },
      )
    })

    return () => {
      unsubs.forEach((u) => u())
    }
  }, [user, userHomeKeys, isUsingFallback])

  // 4. Construct list of homes
  const homes = useMemo(() => {
    if (isUsingFallback || !userHomeKeys || userHomeKeys.length === 0) {
      return [fallbackHome]
    }
    const list = userHomeKeys
      .map((hid) => {
        const h = homesData[hid]
        const info = h?.info || {}
        const members = h?.members || {}
        const myMember = members[user?.uid]
        return {
          id: hid,
          name: info.name || 'Unnamed Home',
          owner: info.owner || '',
          isOwner: info.owner === user?.uid || myMember?.role === 'owner',
          role: myMember?.role || (info.owner === user?.uid ? 'owner' : 'member'),
          inviteCode: info.inviteCode || '',
          requireApproval: info.requireApproval !== false,
          members,
          memberCount: Object.keys(members).length || 1,
          createdAt: info.createdAt || 0,
        }
      })
      .filter((h) => homesData[h.id] !== undefined)

    return list.length > 0 ? list : [fallbackHome]
  }, [userHomeKeys, homesData, user, isUsingFallback, fallbackHome])

  // 4b. Listen to joinRequests for active home if user is the owner
  const [joinRequests, setJoinRequests] = useState([])

  useEffect(() => {
    if (!user || !currentHomeId || currentHomeId === 'default') {
      setJoinRequests([])
      return
    }

    const currentH = homes.find((h) => h.id === currentHomeId)
    if (!currentH?.isOwner) {
      setJoinRequests([])
      return
    }

    const unsub = onValue(
      ref(db, `homes/${currentHomeId}/joinRequests`),
      (snap) => {
        const val = snap.val()
        if (val && typeof val === 'object') {
          const list = Object.entries(val).map(([uid, req]) => ({
            uid,
            email: req?.email || 'User',
            createdAt: req?.createdAt || Date.now(),
            status: req?.status || 'pending',
          })).sort((a, b) => b.createdAt - a.createdAt)
          setJoinRequests(list)
        } else {
          setJoinRequests([])
        }
      },
      () => setJoinRequests([]),
    )

    return () => unsub()
  }, [user, currentHomeId, homes])

  // 5. Select active home
  useEffect(() => {
    if (homes.length === 0) return
    const exists = homes.some((h) => h.id === currentHomeId)
    if (!exists) {
      const fallbackId = homes[0].id
      setCurrentHomeId(fallbackId)
      localStorage.setItem(STORAGE_KEY, fallbackId)
      setActiveHomeId(fallbackId)
    } else {
      setActiveHomeId(currentHomeId)
    }
    setLoading(false)
  }, [homes, currentHomeId])

  const currentHome = useMemo(() => {
    return homes.find((h) => h.id === currentHomeId) || homes[0] || fallbackHome
  }, [homes, currentHomeId, fallbackHome])

  const switchHome = (homeId) => {
    if (homes.some((h) => h.id === homeId)) {
      setCurrentHomeId(homeId)
      localStorage.setItem(STORAGE_KEY, homeId)
      setActiveHomeId(homeId)
    }
  }

  const createHome = async (name) => {
    if (!user) throw new Error('You must be signed in.')
    const cleanName = String(name || '').trim()
    if (!cleanName) throw new Error('Home name cannot be empty.')
    if (cleanName.length > 40) throw new Error('Home name must be 40 characters or fewer.')

    const newId = generateHomeId()
    const inviteCode = generateInviteCode()

    const initialHome = {
      info: {
        name: cleanName,
        owner: user.uid,
        createdAt: Date.now(),
        inviteCode,
        requireApproval: true,
      },
      members: {
        [user.uid]: {
          role: 'owner',
          email: user.email || '',
          joinedAt: Date.now(),
        },
      },
      relays: {
        relay1: false,
        relay2: false,
        relay3: false,
        relay4: false,
        relay5: false,
        relay6: false,
        relay7: false,
        relay8: false,
      },
    }

    await withTimeout(set(ref(db, `homes/${newId}`), initialHome), 5000, 'Could not create home. Check Firebase database rules.')
    await withTimeout(set(ref(db, `userHomes/${user.uid}/${newId}`), true), 3000, 'Could not link home.')
    try {
      await withTimeout(set(ref(db, `inviteCodes/${inviteCode}`), newId), 3000, 'Could not register invite code.')
    } catch {
      /* optional */
    }

    setIsUsingFallback(false)
    setCurrentHomeId(newId)
    localStorage.setItem(STORAGE_KEY, newId)
    setActiveHomeId(newId)
    return newId
  }

  const joinHome = async (rawCode) => {
    if (!user) throw new Error('You must be signed in.')
    let code = String(rawCode || '').trim().toUpperCase()
    if (!code.startsWith('HOME-') && !code.includes('-')) {
      code = `HOME-${code}`
    }

    const codeSnap = await withTimeout(get(ref(db, `inviteCodes/${code}`)), 4000, 'Could not reach Firebase. Check connection.')
    if (!codeSnap.exists() || !codeSnap.val()) {
      throw new Error(`Invite code "${code}" was not found. Please check and try again.`)
    }

    const targetHomeId = codeSnap.val()

    // If user is already a member of this home, simply switch to it
    if (userHomeKeys && userHomeKeys.includes(targetHomeId)) {
      setIsUsingFallback(false)
      setCurrentHomeId(targetHomeId)
      localStorage.setItem(STORAGE_KEY, targetHomeId)
      setActiveHomeId(targetHomeId)
      return { status: 'switched', homeId: targetHomeId }
    }

    // Check if the home requires owner approval (default is true)
    let requiresApproval = true
    let targetHomeName = 'Smart Home'
    try {
      const infoSnap = await withTimeout(get(ref(db, `homes/${targetHomeId}/info`)), 3000, '')
      if (infoSnap.exists()) {
        const info = infoSnap.val()
        if (info?.name) targetHomeName = info.name
        if (info?.requireApproval === false) {
          requiresApproval = false
        }
      }
    } catch {
      /* default to requiring approval */
    }

    if (requiresApproval) {
      // Submit join request to owner
      await withTimeout(
        set(ref(db, `homes/${targetHomeId}/joinRequests/${user.uid}`), {
          uid: user.uid,
          email: user.email || '',
          createdAt: Date.now(),
          status: 'pending',
        }),
        4000,
        'Could not submit join request. Please try again.',
      )
      return { status: 'pending', homeName: targetHomeName, homeId: targetHomeId }
    }

    // Direct join if approval is not required
    await Promise.all([
      withTimeout(
        set(ref(db, `homes/${targetHomeId}/members/${user.uid}`), {
          role: 'member',
          email: user.email || '',
          joinedAt: Date.now(),
        }),
        4000,
        'Could not join home. Please verify database rules.',
      ),
      withTimeout(
        set(ref(db, `userHomes/${user.uid}/${targetHomeId}`), true),
        4000,
        'Could not link home to your account.',
      ),
    ])

    setIsUsingFallback(false)
    setCurrentHomeId(targetHomeId)
    localStorage.setItem(STORAGE_KEY, targetHomeId)
    setActiveHomeId(targetHomeId)
    return { status: 'joined', homeId: targetHomeId }
  }

  const removeMember = async (homeId, memberUid) => {
    if (!user) throw new Error('You must be signed in.')
    const target = homes.find((h) => h.id === homeId)
    if (!target || !target.isOwner) throw new Error('Only the home owner can remove members.')
    if (memberUid === user.uid) throw new Error('Owner cannot remove their own account.')

    await Promise.all([
      withTimeout(remove(ref(db, `homes/${homeId}/members/${memberUid}`)), 4000, 'Failed to remove member from home.'),
      withTimeout(remove(ref(db, `userHomes/${memberUid}/${homeId}`)), 4000, 'Failed to unlink home.').catch(() => {}),
    ])
  }

  const toggleRequireApproval = async (homeId, requireApproval) => {
    if (!user) throw new Error('You must be signed in.')
    const target = homes.find((h) => h.id === homeId)
    if (!target || !target.isOwner) throw new Error('Only the home owner can change approval settings.')
    await withTimeout(set(ref(db, `homes/${homeId}/info/requireApproval`), Boolean(requireApproval)), 4000, 'Failed to update approval setting')
  }

  const approveJoinRequest = async (homeId, requesterUid, requesterEmail) => {
    if (!user) throw new Error('You must be signed in.')
    const target = homes.find((h) => h.id === homeId)
    if (!target || !target.isOwner) throw new Error('Only the home owner can approve join requests.')

    await Promise.all([
      withTimeout(set(ref(db, `homes/${homeId}/members/${requesterUid}`), {
        role: 'member',
        email: requesterEmail || '',
        joinedAt: Date.now(),
      }), 4000, 'Failed to add member to home.'),
      withTimeout(set(ref(db, `userHomes/${requesterUid}/${homeId}`), true), 4000, 'Failed to link home to member.').catch(() => {}),
      withTimeout(remove(ref(db, `homes/${homeId}/joinRequests/${requesterUid}`)), 4000, 'Failed to clear join request.').catch(() => {}),
    ])
  }

  const rejectJoinRequest = async (homeId, requesterUid) => {
    if (!user) throw new Error('You must be signed in.')
    const target = homes.find((h) => h.id === homeId)
    if (!target || !target.isOwner) throw new Error('Only the home owner can reject join requests.')

    await withTimeout(remove(ref(db, `homes/${homeId}/joinRequests/${requesterUid}`)), 4000, 'Failed to reject request.')
  }

  const leaveHome = async (homeId) => {
    if (!user) return
    const target = homes.find((h) => h.id === homeId)
    if (!target) return

    if (target.isOwner && target.memberCount <= 1) {
      await Promise.all([
        remove(ref(db, `homes/${homeId}`)),
        remove(ref(db, `inviteCodes/${target.inviteCode}`)),
        remove(ref(db, `userHomes/${user.uid}/${homeId}`)),
      ]).catch(() => {})
    } else {
      await Promise.all([
        remove(ref(db, `homes/${homeId}/members/${user.uid}`)),
        remove(ref(db, `userHomes/${user.uid}/${homeId}`)),
      ]).catch(() => {})
    }

    const remaining = homes.filter((h) => h.id !== homeId)
    if (remaining.length > 0) {
      switchHome(remaining[0].id)
    } else {
      fallbackToDefault()
    }
  }

  const updateHomeName = async (homeId, newName) => {
    const clean = String(newName || '').trim()
    if (!clean) throw new Error('Home name cannot be empty.')
    if (homeId === 'default') {
      // Local fallback rename
      return
    }
    await withTimeout(set(ref(db, `homes/${homeId}/info/name`), clean), 4000, 'Failed to update name')
  }

  const regenerateInviteCode = async (homeId) => {
    const target = homes.find((h) => h.id === homeId)
    if (!target || !target.isOwner) throw new Error('Only the owner can regenerate invite codes.')
    if (homeId === 'default') throw new Error('Cannot regenerate invite code in default single-home mode.')

    const oldCode = target.inviteCode
    const newCode = generateInviteCode()

    const updates = {
      [`homes/${homeId}/info/inviteCode`]: newCode,
      [`inviteCodes/${newCode}`]: homeId,
    }
    if (oldCode) {
      updates[`inviteCodes/${oldCode}`] = null
    }

    await withTimeout(update(ref(db), updates), 4000, 'Failed to update invite code')
    return newCode
  }

  const transferOwnership = async (homeId, newOwnerUid) => {
    if (!user) throw new Error('You must be signed in.')
    const target = homes.find((h) => h.id === homeId)
    if (!target || !target.isOwner) throw new Error('Only the current home owner can transfer ownership.')
    if (newOwnerUid === user.uid) throw new Error('You are already the owner of this home.')

    const currentMembers = target.members || (homesData[homeId]?.members || {})
    if (!currentMembers[newOwnerUid]) {
      throw new Error('Target user must be an active member of this home to become owner.')
    }

    const updates = {
      [`homes/${homeId}/info/owner`]: newOwnerUid,
      [`homes/${homeId}/members/${newOwnerUid}/role`]: 'owner',
      [`homes/${homeId}/members/${user.uid}/role`]: 'member',
    }

    await withTimeout(update(ref(db), updates), 4000, 'Failed to transfer home ownership.')
  }

  return (
    <HomeContext.Provider
      value={{
        homes,
        currentHome,
        currentHomeId,
        loading: loading && !currentHomeId,
        hasNoHomes: Boolean(user && userHomeKeys !== null && userHomeKeys.length === 0 && !isUsingFallback),
        error,
        isUsingFallback,
        joinRequests,
        joinRequestsCount: joinRequests.length,
        switchHome,
        createHome,
        joinHome,
        leaveHome,
        removeMember,
        transferOwnership,
        toggleRequireApproval,
        approveJoinRequest,
        rejectJoinRequest,
        updateHomeName,
        regenerateInviteCode,
        fallbackToDefault,
      }}
    >
      {children}
    </HomeContext.Provider>
  )
}
