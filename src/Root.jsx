import React, { useState, useEffect } from 'react'
import App from './App.jsx'
import Login from './screens/Login.jsx'
import InstallGate, { mustInstall } from './screens/InstallGate.jsx'
import Splash from './screens/Splash.jsx'
import { applyConfig } from './lib/lottery.js'
import { setBonus } from './screens/Refer.jsx'
import { api, LIVE } from './lib/api.js'

// Flow:
// 0. On opening / refreshing: plays the 3D prize wheel onboarding splash screen (tap to skip).
// 1. In browser (or app) while opening the link: shows the Login screen.
// 2. After login: if inside normal web browser, forces installation and blocks the app.
// 3. Only when running as the installed standalone app can the user see and play the game.
export default function Root() {
  const [splash, setSplash] = useState(true)
  const [user, setUser] = useState(() => {
    try { return localStorage.getItem('l3user') || null } catch { return null }
  })

  // owner's prices, wins and draw times from the server (loads while the opening screen plays)
  const [cfg, setCfg] = useState(!LIVE)
  useEffect(() => {
    if (!LIVE) return
    api('config').then(r => {
      applyConfig(r.config)
      if (r.config.ref_bonus != null) setBonus(r.config.ref_bonus)
    }, () => {}).finally(() => setCfg(true))
  }, [])

  const login = email => {
    try { localStorage.setItem('l3user', email) } catch { /* private mode */ }
    setUser(email)
  }
  const logout = () => {
    try { localStorage.removeItem('l3user') } catch { /* private mode */ }
    setUser(null)
  }

  // Step 0: Onboarding splash screen
  if (splash) return <Splash onDone={() => setSplash(false)} />

  if (mustInstall()) return <InstallGate />   // phone browser: only the install screen, the game never opens here

  if (!cfg) return null

  // Step 1: User not signed in -> show Login screen
  if (!user) {
    return <Login onLogin={login} />
  }

  // Step 2: User signed in -> show app
  return <App user={user} onLogout={logout} />
}
