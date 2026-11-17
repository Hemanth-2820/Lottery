// Put this file in the React app as src/lib/api.js. It talks to the PHP backend.
// Set VITE_API_URL in Vercel (Settings > Environment Variables), e.g. https://api.fashionsnap.in/api.php
const URL = import.meta.env.VITE_API_URL || 'https://api.fashionsnap.in/api.php'
export const isLive = Boolean(URL)
export const LIVE = isLive
export const API_URL = URL

let token = (() => { try { return localStorage.getItem('l3token') || '' } catch { return '' } })()
export const setToken = t => { token = t || ''; try { t ? localStorage.setItem('l3token', t) : localStorage.removeItem('l3token') } catch { /* private mode */ } }
export const getToken = () => token

export async function api(action, data) {
  const r = await fetch(URL + '?a=' + action, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(data || {}),
  })
  const j = await r.json().catch(() => ({ ok: false, error: 'Server error' }))
  if (r.status === 401) setToken('')
  if (!j.ok) { const e = new Error(j.error || 'Something went wrong'); e.data = j; e.status = r.status; throw e }
  return j
}
// Excel download link for the analytics page
export const excelUrl = month => URL + '?a=analytics_excel&month=' + month + '&token=' + encodeURIComponent(token)
