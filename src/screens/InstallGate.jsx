import React, { useEffect, useState } from 'react'

// On a phone the game only opens from the installed home-screen app.
// In a phone browser only this install screen shows: no login, no game, no "continue in browser".
// Android Chrome: one tap installs it. iPhone Safari: shows the 3 Share-menu steps.
const isPhone = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent)
const installed = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true } catch { return false } }
export const mustInstall = () => isPhone() && !installed()

let deferred = null   // Chrome's install prompt, saved when the browser offers it
if (typeof window !== 'undefined') window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e })

export default function InstallGate() {
  const [show] = useState(() => isPhone() && !installed())
  const [canPrompt, setCanPrompt] = useState(!!deferred), [done, setDone] = useState(false)

  useEffect(() => {
    const on = e => { e.preventDefault(); deferred = e; setCanPrompt(true) }
    const ok = () => setDone(true)   // stays on this screen: the game only opens from the home-screen app
    window.addEventListener('beforeinstallprompt', on); window.addEventListener('appinstalled', ok)
    return () => { window.removeEventListener('beforeinstallprompt', on); window.removeEventListener('appinstalled', ok) }
  }, [])
  if (!show) return null

  const install = async () => {
    if (!deferred) return
    deferred.prompt()
    const r = await deferred.userChoice.catch(() => ({}))
    deferred = null; setCanPrompt(false)
    if (r.outcome === 'accepted') setDone(true)
  }

  return (
    <div className="ig">
      <div className="ig-card">
        <div className="ig-icon"><img src={import.meta.env.BASE_URL + 'app-logo.png'} alt="Murugan" /></div>
        <h2>{done ? 'Installed! 🎉' : 'Install the Murugan app'}</h2>
        <p>{done ? 'Close this browser and open the Murugan app from your home screen to play.' : 'Get the full-screen app on your phone. It opens instantly from your home screen, like any other app.'}</p>
        {!done && (isIOS() ? (
          <ol className="ig-steps">
            <li>Tap the <b>Share</b> button <span className="ig-share">⎋</span> at the bottom of Safari</li>
            <li>Scroll and tap <b>Add to Home Screen</b></li>
            <li>Tap <b>Add</b>, then open Murugan from your home screen</li>
          </ol>
        ) : canPrompt ? (
          <button className="ig-btn" onClick={install}>⬇ Install app</button>
        ) : (
          <ol className="ig-steps">
            <li>Tap the <b>⋮</b> menu at the top right of Chrome</li>
            <li>Tap <b>Install app</b> or <b>Add to Home screen</b></li>
            <li>Open Murugan from your home screen</li>
          </ol>
        ))}
      </div>
    </div>
  )
}
