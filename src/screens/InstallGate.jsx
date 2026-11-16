import React, { useEffect, useState } from 'react'

const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent)

export const isStandalone = () => {
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://')
    )
  } catch {
    return false
  }
}

let deferred = null
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()
    deferred = e
  })
}

export default function InstallGate({ user, onLogout, onInstalled }) {
  const [canPrompt, setCanPrompt] = useState(!!deferred)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const onPrompt = e => {
      e.preventDefault()
      deferred = e
      setCanPrompt(true)
    }
    const onAppInstalled = () => {
      setInstalled(true)
      onInstalled?.()
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [onInstalled])

  const install = async () => {
    if (!deferred) return
    deferred.prompt()
    const r = await deferred.userChoice.catch(() => ({}))
    deferred = null
    setCanPrompt(false)
    if (r.outcome === 'accepted') {
      setInstalled(true)
      onInstalled?.()
    }
  }

  return (
    <div className="ig">
      <div className="ig-card">
        <div className="ig-icon">
          <img src="/app-logo.png" alt="Murugan" style={{ width: '100%', borderRadius: 22 }} />
        </div>
        <h2>{installed ? 'Installed! 🎉' : 'App Installation Required'}</h2>
        <p>
          {installed
            ? 'Murugan is now installed! Open Murugan from your phone home screen to play.'
            : 'To view your wallet and play lottery games, you must install the Murugan app on your phone home screen.'}
        </p>

        {!installed && (
          isIOS() ? (
            <ol className="ig-steps">
              <li>Tap the <b>Share</b> button <span className="ig-share">⎋</span> in Safari</li>
              <li>Scroll down and tap <b>Add to Home Screen</b></li>
              <li>Tap <b>Add</b>, then open <b>Murugan</b> from your home screen</li>
            </ol>
          ) : canPrompt ? (
            <button className="ig-btn" onClick={install}>⬇ Install Murugan App</button>
          ) : (
            <ol className="ig-steps">
              <li>Tap the <b>⋮</b> (menu) at the top right of Chrome</li>
              <li>Tap <b>Install app</b> or <b>Add to Home screen</b></li>
              <li>Open <b>Murugan</b> from your home screen to start playing</li>
            </ol>
          )
        )}

        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <div style={{ fontSize: 12.5, color: '#ffd700' }}>
            Signed in as <b>{user}</b>
          </div>
          <button
            type="button"
            className="lnk"
            onClick={onLogout}
            style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Sign out / Change account
          </button>
        </div>
      </div>
    </div>
  )
}
