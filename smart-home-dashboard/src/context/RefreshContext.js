import { createContext, useContext } from 'react'

// Calling this re-creates every listener (see App.jsx).
export const RefreshContext = createContext(() => {})
export const useRefresh = () => useContext(RefreshContext)
