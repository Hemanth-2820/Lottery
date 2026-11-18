import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { BALLS } from './art.js'
import Root from './Root.jsx'

// one CSS rule per ball image (.b.d0 … .b.d9)
const st = document.createElement('style')
st.textContent = BALLS.map(([g, src], n) => `.b.d${n}{--g:${g};background-image:url(${src})}`).join('')
document.head.appendChild(st)

// scale the home machine (designed 360px wide) down on narrower phones
const fit = () => document.documentElement.style.setProperty('--rz', Math.min(1, (Math.min(window.innerWidth, 430) - 32) / 360).toFixed(4))
fit(); window.addEventListener('resize', fit)

// invite link: save ?ref=CODE so the bonus is applied after the friend signs in (even after installing the app)
try { const rc = new URLSearchParams(location.search).get('ref'); if (rc && /^L3[0-9A-Z]{6}$/i.test(rc)) localStorage.setItem('l3pendingRef', rc.toUpperCase()) } catch {}

createRoot(document.getElementById('root')).render(<Root />)

// needed so phones can install the app on the home screen; updateViaCache 'none' = always check for a new sw.js
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(reg => {
    const check = () => reg.update().catch(() => {})
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check() })
    setInterval(check, 5 * 60 * 1000)
  }).catch(() => {})
}

// Auto-update: when the app is opened again (or every 2 minutes), ask the server for the newest page.
// If a new version was deployed, reload once so the player sees it — no clearing cache, no reinstall.
const myBuild = [...document.scripts].map(s => s.src).find(s => /\/assets\/index-.*\.js/.test(s)) || ''
let checking = false
const checkNewVersion = async () => {
  if (checking || !myBuild) return; checking = true
  try {
    const html = await (await fetch('/?v=' + Date.now(), { cache: 'no-store' })).text()
    const m = html.match(/\/assets\/index-[\w-]+\.js/)
    if (m && !myBuild.endsWith(m[0])) {
      let last = 0; try { last = +sessionStorage.getItem('mgReload') || 0 } catch {}
      if (Date.now() - last > 60000) { try { sessionStorage.setItem('mgReload', Date.now()) } catch {} location.reload() }   // never reload in a loop
    }
  } catch {} finally { checking = false }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkNewVersion() })
setInterval(checkNewVersion, 2 * 60 * 1000)
