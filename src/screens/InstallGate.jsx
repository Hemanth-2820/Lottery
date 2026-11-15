import React, { useEffect, useState } from 'react'
import { LOGO } from '../art.js'

// After sign-in on a phone: asks the player to install the app on the home screen.
// It keeps coming back until the app is installed (opened from the home-screen icon).
// Android Chrome: one tap installs it. iPhone Safari: shows the 3 Share-menu steps.
const isPhone = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent)
const installed = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true } catch { return false } }

let deferred = null   // Chrome's install prompt, saved when the browser offers it
if (typeof window !== 'undefined') window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e })

export default function InstallGate() {
  const [show, setShow] = useState(() => isPhone() && !installed())
  const [canPrompt, setCanPrompt] = useState(!!deferred), [later, setLater] = useState(false), [done, setDone] = useState(false)

  useEffect(() => {
    const on = e => { e.preventDefault(); deferred = e; setCanPrompt(true) }
    const ok = () => { setDone(true); setTimeout(() => setShow(false), 2500) }
    window.addEventListener('beforeinstallprompt', on); window.addEventListener('appinstalled', ok)
    const t = setTimeout(() => setLater(true), 15000)   // a way out if this browser can't install apps
    return () => { window.removeEventListener('beforeinstallprompt', on); window.removeEventListener('appinstalled', ok); clearTimeout(t) }
  }, [])
  if (!show) return null

  const install = async () => {
    if (!deferred) return
    deferred.prompt()
    const r = await deferred.userChoice.catch(() => ({}))
    deferred = null; setCanPrompt(false)
    if (r.outcome === 'accepted') { setDone(true); setTimeout(() => setShow(false), 2500) }
  }

  return (
    <div className="ig">
      <div className="ig-card">
        <div className="ig-icon"><img src={LOGO} alt="Lucky3" /></div>
        <h2>{done ? 'Installed! 🎉' : 'Install the Lucky3 app'}</h2>
        <p>{done ? 'Open Lucky3 from your home screen.' : 'Get the full-screen app on your phone. It opens instantly from your home screen, like any other app.'}</p>
        {!done && (isIOS() ? (
          <ol className="ig-steps">
            <li>Tap the <b>Share</b> button <span className="ig-share">⎋</span> at the bottom of Safari</li>
            <li>Scroll and tap <b>Add to Home Screen</b></li>
            <li>Tap <b>Add</b>, then open Lucky3 from your home screen</li>
          </ol>
        ) : canPrompt ? (
          <button className="ig-btn" onClick={install}>⬇ Install app</button>
        ) : (
          <ol className="ig-steps">
            <li>Tap the <b>⋮</b> menu at the top right of Chrome</li>
            <li>Tap <b>Install app</b> or <b>Add to Home screen</b></li>
            <li>Open Lucky3 from your home screen</li>
          </ol>
        ))}
        {later && !done && <button className="ig-later" onClick={() => setShow(false)}>Continue in browser</button>}
      </div>
    </div>
  )
}
