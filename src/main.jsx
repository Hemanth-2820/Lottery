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

createRoot(document.getElementById('root')).render(<Root />)

// needed so phones can install the app on the home screen, and auto-update when new version deploys
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('/sw.js').then(reg => {
    reg.update().catch(() => {})
  }).catch(() => {})
  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true
      window.location.reload()
    }
  })
}
