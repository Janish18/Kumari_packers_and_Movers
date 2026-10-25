import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { authApi } from '../../api/authApi'
import { refreshSession, setAccessToken, setAuthFailureHandler } from '../../api/client'
import { roleHome } from '../../utils/format'
import { Spinner } from '../../components/common/Feedback'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setAuthFailureHandler(() => { setAccessToken(null); setUser(null) })
    // Restore the session from the HttpOnly refresh cookie (silent 401 when logged out).
    refreshSession().then((d) => setUser(d.user)).catch(() => setUser(null)).finally(() => setLoading(false))
  }, [])

  const login = useCallback(async ({ identifier, password, remember_me }) => {
    const res = await authApi.login({ identifier, password, remember_me })
    setAccessToken(res.access)
    // Always take the role from the server's profile, never from anything the client chose.
    const me = await authApi.me()
    setUser(me)
    return me
  }, [])

  const logout = useCallback(async () => {
    try { await authApi.logout() } catch { /* cookie is cleared server-side when reachable */ }
    setAccessToken(null)
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => setUser(await authApi.me()), [])

  const value = useMemo(() => ({ user, loading, login, logout, refreshUser }), [user, loading, login, logout, refreshUser])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** UX-level guard only. The API enforces roles and ownership on every request regardless of this. */
export function RequireRole({ roles, children }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <div className="grid min-h-screen place-items-center"><Spinner className="h-8 w-8" /></div>
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  if (!roles.includes(user.role)) return <Navigate to={roleHome(user.role)} replace />
  return children
}

export function GuestOnly({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="grid min-h-screen place-items-center"><Spinner className="h-8 w-8" /></div>
  if (user) return <Navigate to={roleHome(user.role)} replace />
  return children
}
