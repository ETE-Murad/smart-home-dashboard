import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
} from 'firebase/auth'
import { auth } from '../firebase'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        // An anonymous session (e.g. left by an older page) does not count as signed in.
        setUser(u && !u.isAnonymous ? u : null)
        setLoading(false)
      }),
    [],
  )

  const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password)
  const signUp = (email, password) => createUserWithEmailAndPassword(auth, email, password)
  const signOut = () => fbSignOut(auth)

  return <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>{children}</AuthContext.Provider>
}
