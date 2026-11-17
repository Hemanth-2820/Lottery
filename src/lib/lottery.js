// ---------- lottery list, draw times and rules ----------
export const LOTS = [
  { k: 'Dear', h: [13, 18, 20] },
  { k: 'Kerala', h: [15] },
  { k: 'Punjab', h: [17] },
  { k: 'Sikkim', h: [18] },
  { k: 'Goa Queen', h: [12, 17, 19] },
]
export let CLOSE = 180            // booking closes this many seconds before a draw
export const PRICE = [12, 12, 30]   // Single, Double, Triple
export const WIN = [100, 1000, 15000]
export let APPROVAL = 15000       // wins of this size wait for owner approval
export const LAST = [500, 50]       // Triple: last two digits / last digit match
// TODO: put the owner's real UPI ID and display name here. Wallet recharges are paid to this ID.
export const UPI = { id: 'yourupi@bank', name: 'Murugan' }
export const UPIS = []              // all UPI IDs the owner turned on (from the server)

// every draw time of the day, with the lotteries that draw then
export const DRAWS = [...new Set(LOTS.flatMap(l => l.h))].sort((a, b) => a - b)
  .map(h => ({ h, lot: LOTS.filter(l => l.h.includes(h)).map(l => l.k).join(' + ') }))

// ---------- India time ----------
export const ist = () => { const d = new Date(); return new Date(d.getTime() + (d.getTimezoneOffset() + 330) * 60000) }
export const hrs = () => { const d = ist(); return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600 }
export const lbl = h => (h > 12 ? h - 12 : h) + ':00 ' + (h >= 12 ? 'PM' : 'AM')
export const sh12 = h => (h > 12 ? h - 12 : h) + ' ' + (h >= 12 ? 'PM' : 'AM')
export const closeLbl = h => { const c = h - 1; return (c > 12 ? c - 12 : c) + ':57 ' + (c >= 12 ? 'PM' : 'AM') }
const f2 = x => String(x).padStart(2, '0')
export const hms = s => f2(s / 3600 | 0) + ':' + f2(s / 60 % 60 | 0) + ':' + f2(s % 60)
export const inr = n => '₹' + Math.round(n).toLocaleString('en-IN')

export function nextDraw() {
  const h = hrs(), i = DRAWS.findIndex(d => d.h > h)
  if (i < 0) return { i: 0, d: DRAWS[0], left: Math.round((24 - h + DRAWS[0].h) * 3600), tom: true }
  return { i, d: DRAWS[i], left: Math.round((DRAWS[i].h - h) * 3600) }
}

// the show the player is booking: the one tapped on a card, else the next draw
export function resolveShow(sel) {
  const h = hrs(); let x = sel
  if (!x || x.h <= h) { const n = nextDraw(); x = { lot: LOTS.find(l => l.h.includes(n.d.h)).k, h: n.d.h } }
  return { d: x, left: Math.round((x.h > h ? x.h - h : 24 - h + x.h) * 3600) }
}

// ---------- game rules ----------
// BOX: every different order of the digits (580 → 6, 100 → 3)
export const perms = v => {
  const o = new Set;
  (function p(a, r) { if (!r.length) o.add(a); for (let i = 0; i < r.length; i++) p(a + r[i], r.slice(0, i) + r.slice(i + 1)) })('', v)
  return [...o]
}

// what is in the three tubes right now
export const current = (tubes, mode) => {
  const pos = ['A', 'B', 'C'].filter((_, i) => tubes[i] !== null).join(''), v = tubes.filter(x => x !== null).join(''), n = pos.length
  return { pos, v, n, ok: mode === 0 ? n > 0 : n === mode + 1 }
}

// one ticket line against a result like "335"
export function lineWin(x, r) {
  const ix = [...x.pos].map(p => 'ABC'.indexOf(p)), hit = ix.map((k, j) => x.v[j] === r[k]); let w = 0
  if (x.pos.length < 3) { if (hit.every(Boolean)) w = x.pos.length === 1 ? WIN[0] : WIN[1] }
  else w = hit.every(Boolean) ? WIN[2] : hit[1] && hit[2] ? LAST[0] : hit[2] ? LAST[1] : 0
  return { hit, w: w * x.q }
}

// ---------- results: one per slot (date + lottery + draw time) ----------
export const dayKey = (off = 0) => { const d = ist(); d.setDate(d.getDate() - off); return d.getFullYear() + '-' + f2(d.getMonth() + 1) + '-' + f2(d.getDate()) }
export const dayName = off => { if (off < 2) return off ? 'Yesterday' : 'Today'; const d = ist(); d.setDate(d.getDate() - off); return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) }
export const dayLabel = day => day === dayKey(0) ? 'Today' : day === dayKey(1) ? 'Yesterday' : day.split('-').reverse().join('/')
export const slotKey = (day, lot, h) => day + '|' + lot + '|' + h
// the 9 slots of a day, in time order
export const SLOTS = DRAWS.flatMap(d => LOTS.filter(l => l.h.includes(d.h)).map(l => ({ lot: l.k, h: d.h })))
// Settings from the server (owner's admin Settings page). Arrays are changed in place so every screen sees them.
const fill = (arr, items) => { arr.splice(0, arr.length, ...items) }
export function applyConfig(c) {
  if (!c) return
  if (Array.isArray(c.lots) && c.lots.length) fill(LOTS, c.lots.map(l => ({ k: l.k, h: l.h.map(Number) })))
  if (Array.isArray(c.price) && c.price.length === 3) fill(PRICE, c.price.map(Number))
  if (Array.isArray(c.win) && c.win.length === 3) fill(WIN, c.win.map(Number))
  if (Array.isArray(c.last) && c.last.length === 2) fill(LAST, c.last.map(Number))
  if (c.close != null) CLOSE = +c.close
  if (c.approval != null) APPROVAL = +c.approval
  if (c.upi) Object.assign(UPI, c.upi)
  if (Array.isArray(c.upis)) fill(UPIS, c.upis.filter(u => u.on !== false && u.id))
  fill(DRAWS, [...new Set(LOTS.flatMap(l => l.h))].sort((a, b) => a - b).map(h => ({ h, lot: LOTS.filter(l => l.h.includes(h)).map(l => l.k).join(' + ') })))
  fill(SLOTS, DRAWS.flatMap(d => LOTS.filter(l => l.h.includes(d.h)).map(l => ({ lot: l.k, h: d.h }))))
}

export const LOTC = { Dear: '#ff3d6a', Kerala: '#19d48a', Punjab: '#ff9a1f', Sikkim: '#3d8bff', 'Goa Queen': '#d24dff' }

// TODO(backend): sample result for a finished slot. Replace with the result the owner published for that slot.
export const past = (h, k = '', day = dayKey(0)) => {
  const [, m, d] = day.split('-').map(Number)
  let x = d * 97 + h * 31 + (m - 1) * 7 + 11 + k.length * 53 + (k.charCodeAt(0) || 0) * 3
  return [0, 1, 2].map(() => { x = (Math.imul(x, 1103515245) + 12345) & 0x7fffffff; return (x >> 16) % 10 }).join('')
}

export const LIVE_RESULTS = true

// result of one slot, or null if it is not out yet. `published` holds results published during this session (demo).
export function resultOf(day, lot, h, published = {}) {
  const p = published[slotKey(day, lot, h)]; if (p) return p
  if (LIVE_RESULTS || import.meta.env.VITE_API_URL) return null   // live app: ONLY real results from the server, never made-up ones
  const today = dayKey(0)
  return day < today || (day === today && h <= hrs()) ? past(h, lot, day) : null
}

// the slot whose result came out most recently
export function latestSlot() {
  const h = hrs(), done = SLOTS.filter(s => s.h <= h), s = done.length ? done[done.length - 1] : SLOTS[SLOTS.length - 1]
  return { day: dayKey(done.length ? 0 : 1), lot: s.lot, h: s.h }
}

// check a whole ticket against its slot's result: wins of APPROVAL or more are held for the owner
export function settle(items, res) {
  const lines = items.map(x => lineWin(x, res)); let tot = 0, held = 0
  lines.forEach(c => { if (c.w >= APPROVAL) held += c.w; else tot += c.w })
  return { lines, tot, held }
}

// ---------- drawing helpers ----------
export const skyMode = h => h < 14 ? 0 : h < 16 ? 1 : h < 19 ? 2 : 3          // noon, backwater, sunset, night
export const skyElev = h => h === 17 ? .15 : h === 19 ? .05 : h === 12 ? .1 : 0
export const pt = (t, r = 145) => { const a = Math.PI * (1 - (Math.min(21, Math.max(10, t)) - 10) / 11); return [180 + r * Math.cos(a), 190 - r * Math.sin(a)] }
export const arc = (a, b) => { const p = pt(a), q = pt(b); return `M${p[0].toFixed(1)} ${p[1].toFixed(1)}A145 145 0 0 1 ${q[0].toFixed(1)} ${q[1].toFixed(1)}` }
export const COL = [['#ffd0d8', '#ff2d55', '#5c0518'], ['#fff6cf', '#ffb703', '#6b3c00'], ['#d2e2ff', '#2f6bff', '#061a5c'], ['#d0ffe6', '#12c97a', '#03452a'], ['#ecd8ff', '#9b4dff', '#2c0a66'], ['#ffe2cc', '#ff7a1a', '#6b2400'], ['#d4fbff', '#12c4e0', '#03404f'], ['#ffd0d8', '#e0245e', '#5c0518'], ['#fff0c0', '#e09a00', '#6b3c00'], ['#d2e2ff', '#3d5cff', '#061a5c']]
export const GREY = ['#8d86a8', '#3a3358', '#15102a']
export const wait = ms => new Promise(r => setTimeout(r, ms))
