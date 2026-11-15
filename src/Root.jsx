import React, { useState } from 'react'
import App from './App.jsx'
import Login from './screens/Login.jsx'

// Shows the sign-in screen until the player is signed in. The email is remembered on this phone.
export default function Root() {
  const [user, setUser] = useState(() => { try { return localStorage.getItem('l3user') || null } catch { return null } })
  const login = email => { try { localStorage.setItem('l3user', email) } catch { /* private mode */ } setUser(email) }
  const logout = () => { try { localStorage.removeItem('l3user') } catch { /* private mode */ } setUser(null) }
  return user ? <App user={user} onLogout={logout} /> : <Login onLogin={login} />
}
