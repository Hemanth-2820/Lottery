import React, { useEffect, useMemo, useRef, useState } from 'react'
import Home from './screens/Home.jsx'
import Play from './screens/Play.jsx'
import Result from './screens/Result.jsx'
import Tickets from './screens/Tickets.jsx'
import Refer, { BONUS } from './screens/Refer.jsx'
import Wallet from './screens/Wallet.jsx'
import { ballHTML, fly } from './components/Ball.jsx'
import { LOGO } from './art.js'
import { useAnimatedNumber, useNow, useStateRef } from './hooks/hooks.js'
import useMachine from './hooks/useMachine.js'
import useSkies from './hooks/useSkies.js'
import { CLOSE, PRICE, current, dayKey, hrs, inr, ist, latestSlot, lbl, past, perms, resolveShow, resultOf, settle, sh12, slotKey, wait } from './lib/lottery.js'
import { api, isLive } from './lib/api.js'

const TTL = { res: 'Result', play: 'Pick numbers', tix: 'My tickets' }, IDX = { home: 0, res: 1, play: 2, tix: 3 }
const NONE = [null, null, null]

// Four example tickets from earlier days so the history is not empty. They are marked "sample" and never touch the wallet.
function sampleTickets() {
  const d1 = dayKey(1), d2 = dayKey(2), a = past(18, 'Dear', d1), b = past(15, 'Kerala', d1), c = past(19, 'Goa Queen', d2), e = past(17, 'Punjab', d2)
  const off = (x, k) => String((+x + k) % 10)
  const mk = (id, lot, h, day, items) => { const res = past(h, lot, day); return { id, lot, h, day, items, t: items.reduce((s, x) => s + x.q * x.price, 0), status: 'done', res, sample: true, ...settle(items, res) } }
  return [
    mk('L3-104512', 'Dear', 18, d1, [{ pos: 'A', v: a[0], q: 1, price: 12 }, { pos: 'B', v: off(a[1], 3), q: 1, price: 12 }, { pos: 'ABC', v: off(a[0], 2) + a[1] + off(a[2], 5), q: 1, price: 30 }]),
    mk('L3-104377', 'Kerala', 15, d1, [{ pos: 'AB', v: off(b[0], 1) + b[1], q: 2, price: 12 }, { pos: 'C', v: off(b[2], 4), q: 1, price: 12 }]),
    mk('L3-103860', 'Goa Queen', 19, d2, [{ pos: 'AB', v: c[0] + c[1], q: 1, price: 12 }, { pos: 'C', v: off(c[2], 6), q: 3, price: 12 }]),
    mk('L3-103641', 'Punjab', 17, d2, [{ pos: 'ABC', v: off(e[0], 3) + off(e[1], 1) + off(e[2], 7), q: 1, price: 30 }, { pos: 'B', v: off(e[1], 2), q: 1, price: 12 }]),
  ]
}

export default function App({ user = 'player@example.com', onLogout }) {
  const now = useNow()                                                // tick every second
  // ---- which screen ----
  const [st, setSt] = useState('home'), stRef = useRef('home')
  const go = s => { stRef.current = s; setSt(s) }
  // ---- booking ----
  const [sel, setSel] = useState(null)                       // show tapped on a card: {lot, h}
  const [mode, setMode] = useState(0)                        // 0 Single, 1 Double, 2 Triple
  const [tubes, setTubes, tubesRef] = useStateRef(NONE)      // digits chosen for A, B, C
  const [shown, setShown] = useState(NONE)                   // balls that have landed in the domes
  const [target, setTarget] = useState(0)
  const [qty, setQty] = useState(1)
  const [cart, setCart, cartRef] = useStateRef([])           // [{pos, v, q, price}]
  const [bump, setBump] = useState(0)
  // ---- wallet ----
  const [wallet, setWallet, walletRef] = useStateRef(isLive ? 0 : 1000)
  const [held, setHeld] = useState(0)                        // wins waiting for owner approval
  const [hit, setHit] = useState(0)
  const [recharges, setRecharges] = useState([])             // UPI recharge requests: {id, amt, utr, status}
  const [withdrawals, setWithdrawals] = useState([])
  const walletShown = useAnimatedNumber(wallet)
  // ---- ticket and result ----
  const [order, setOrder] = useState(null)                   // the ticket just paid (for the receipt)
  const [tickets, setTickets, ticketsRef] = useStateRef(isLive ? [] : sampleTickets)   // every booked ticket, newest first
  const [published, setPublished] = useState({})             // results published in this session (demo), by slot
  const [rsel, setRsel] = useState(latestSlot)               // slot shown in the result domes: {day, lot, h}
  const [drawing, setDrawing, drawingRef] = useStateRef(false)
  const holdRef = useRef(new Set())                          // slots whose ball-drop is still playing
  // ---- overlays ----
  const [sheet, setSheet] = useState(null)                   // 'w' wallet, 'p' profile, 'r' refer & earn
  const [refUsed, setRefUsed] = useState(() => { try { return localStorage.getItem('l3ref:' + user) || '' } catch { return '' } })

  const refresh = () => {
    if (!isLive) return
    api('me').then(res => {
      if (res.user) {
        setWallet(res.user.wallet || 0)
        setHeld(res.user.held || 0)
        if (res.user.ref_used) setRefUsed(res.user.ref_used)
      }
    }).catch(() => {})
    api('tickets').then(res => {
      if (res.tickets) {
        setTickets(res.tickets.map(t => {
          const resVal = t.result || ''
          const s = settle(t.items || [], resVal)
          return {
            id: t.code,
            lot: t.lot,
            h: t.h,
            day: t.day,
            time: lbl(t.h),
            items: t.items || [],
            t: t.total,
            status: t.status === 'booked' ? 'wait' : 'done',
            res: resVal,
            won: t.won || s.tot,
            held: t.held || s.held,
            ...s
          }
        }))
      }
    }).catch(() => {})
    api('recharges').then(res => {
      if (res.recharges) setRecharges(res.recharges.map(r => ({ id: r.id, amt: r.amount, utr: r.utr, status: r.status })))
    }).catch(() => {})
    api('withdrawals').then(res => {
      if (res.withdrawals) setWithdrawals(res.withdrawals)
    }).catch(() => {})
    api('results').then(res => {
      if (res.results) {
        const p = {}
        res.results.forEach(r => { p[slotKey(r.day, r.lot, r.h)] = r.digits })
        setPublished(p)
      }
    }).catch(() => {})
  }

  useEffect(() => {
    refresh()
  }, [user])
  const [rcpt, setRcpt] = useState(false)
  const [toastS, setToastS] = useState({ m: '', on: false }), toastT = useRef()
  const [led, setLed] = useState(null), [machSpin, setMachSpin] = useState(false)

  const liveRef = useRef(), fxRef = useRef(), btRef = useRef(), glassRefs = useRef([]), mixRef = useRef(.5)
  const burst = useMachine(liveRef, mixRef)
  useSkies(stRef)

  const show = resolveShow(sel)
  const toast = m => { setToastS({ m, on: true }); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToastS(t => ({ ...t, on: false })), 2200) }
  const changeWallet = v => { setWallet(v); setHit(x => x + 1) }

  // ---------- home ----------
  const shake = () => {
    if (drawingRef.current) return
    mixRef.current = 2.6; burst(); setMachSpin(true)
    setTimeout(() => setMachSpin(false), 700); setTimeout(() => { if (!drawingRef.current) mixRef.current = .5 }, 1500)
  }
  const pickShow = (lot, h) => {
    if (h <= hrs()) return toast(h ? 'That draw is finished' : 'No more ' + lot + ' draws today')
    if ((h - hrs()) * 3600 <= CLOSE) return toast('Booking is closed for ' + lbl(h))
    setSel({ lot, h }); go('play')
  }

  // ---------- pick numbers ----------
  const pickMode = m => { setMode(m); setTubes(NONE); setShown(NONE); setTarget(0) }
  const pickBall = async (d, el) => {
    const t = tubesRef.current
    if (mode === 1 && t.filter(x => x !== null).length >= 2) return toast('Double uses two tubes. Tap a tube to empty it.')
    let i = target
    if (t[i] !== null) { i = t.indexOf(null); if (i < 0) return toast('All tubes are full. Tap a tube to empty it.') }
    const nt = [...t]; nt[i] = d; setTubes(nt)
    const free = nt.indexOf(null); setTarget(free < 0 ? i : free)
    await fly(ballHTML(d, 50), el, glassRefs.current[i], 1.3, 420)
    if (tubesRef.current[i] === d) setShown(s => { const c = [...s]; c[i] = d; return c })
  }
  const tapTube = i => {
    if (tubesRef.current[i] !== null) { setTubes(tubesRef.current.map((x, j) => j === i ? null : x)); setShown(s => s.map((x, j) => j === i ? null : x)) }
    setTarget(i)
  }
  const addLines = box => {
    const { pos, v, ok } = current(tubesRef.current, mode); if (!ok) return
    if (mode !== 2) box = false
    const q = qty
    const list = mode === 0 ? [...pos].map((p, j) => ({ pos: p, v: v[j], price: PRICE[0] })) : (box ? perms(v) : [v]).map(x => ({ pos, v: x, price: PRICE[mode] }))
    tubesRef.current.forEach((d, i) => { if (d !== null) fly(ballHTML(d, 66), glassRefs.current[i], btRef.current, .3, 480 + i * 90) })
    setTubes(NONE); setShown(NONE); setTarget(0); setQty(1)
    toast(box ? `Boxed ${v}: ${list.length} numbers added` : list.length > 1 ? list.length + ' Single bets added' : `${pos} ${v} added`)
    setTimeout(() => {
      setCart(cur => { const next = cur.map(c => ({ ...c })); list.forEach(x => { const ex = next.find(c => c.pos === x.pos && c.v === x.v); ex ? ex.q += q : next.push({ ...x, q }) }); return next })
      setBump(b => b + 1)
    }, 520)
  }
  const pay = async () => {
    const items = cartRef.current, t = items.reduce((a, x) => a + x.q * x.price, 0)
    if (!items.length) return toast('Add a number first')
    if (show.left <= CLOSE) return toast('Booking is closed for ' + lbl(show.d.h))
    if (walletRef.current < t) { toast('Low balance. Add money to continue.'); return setSheet('w') }
    if (isLive) {
      try {
        const res = await api('book', { lot: show.d.lot, h: show.d.h, items })
        changeWallet(res.wallet)
        const tk = { id: res.ticket.code, lot: res.ticket.lot, h: res.ticket.h, day: res.ticket.day, time: lbl(res.ticket.h), items: res.ticket.items, t: res.ticket.total, status: 'wait' }
        setTickets([tk, ...ticketsRef.current]); setOrder(tk)
        setCart([]); setSheet(null); setRcpt(true)
      } catch (err) {
        toast(err.message || 'Booking failed')
        if (err.data?.need_recharge) setSheet('w')
      }
    } else {
      changeWallet(walletRef.current - t)
      const tk = { id: 'L3-' + (Date.now() % 1e6), lot: show.d.lot, h: show.d.h, day: dayKey(0), time: lbl(show.d.h), items, t, status: 'wait' }
      setTickets([tk, ...ticketsRef.current]); setOrder(tk)
      setCart([]); setSheet(null); setRcpt(true)
    }
  }

  // ---------- results and settlement ----------
  // Every second: any waiting ticket whose slot now has a result is checked, and wins go to the wallet.
  // TODO(backend): the server does this when the owner publishes a result.
  useEffect(() => {
    let credit = 0, hold = 0, msg = '', changed = false
    const next = ticketsRef.current.map(t => {
      if (t.status !== 'wait' || holdRef.current.has(slotKey(t.day, t.lot, t.h))) return t
      const res = resultOf(t.day, t.lot, t.h, published); if (!res) return t
      const s = settle(t.items, res); credit += s.tot; hold += s.held; changed = true
      msg = t.lot + ' ' + sh12(t.h) + ' result ' + res + ': ' + (s.tot + s.held ? 'you won ' + inr(s.tot + s.held) : 'no win this time')
      return { ...t, status: 'done', res, ...s }
    })
    if (!changed) return
    setTickets(next); toast(msg)
    if (hold) setHeld(h => h + hold)
    if (credit || hold) { confetti(); if (credit) changeWallet(walletRef.current + credit) }
  }, [now, published])

  const openTicket = t => { setRsel({ day: t.day, lot: t.lot, h: t.h }); setSheet(null); go('res') }

  // Demo only: stands in for the owner publishing this slot's result. The first line of the ticket always wins.
  const demoPublish = async t => {
    if (drawingRef.current) return
    setDrawing(true); setSheet(null)
    const r = [0, 1, 2].map(() => Math.random() * 10 | 0), x = t.items[0], key = slotKey(t.day, t.lot, t.h)
    ;[...x.pos].forEach((p, j) => (r['ABC'.indexOf(p)] = +x.v[j]))
    go('home'); mixRef.current = 2.2; setMachSpin(true); setLed('DRAWING'); burst(); await wait(1900)
    holdRef.current.add(key); setRsel({ day: t.day, lot: t.lot, h: t.h }); go('res'); await wait(700)
    setPublished(p => ({ ...p, [key]: r.join('') })); await wait(2200)        // balls drop into A, B, C
    mixRef.current = .5; setMachSpin(false); setLed(null)
    holdRef.current.delete(key); setDrawing(false)                           // now the ticket gets checked
  }

  // ---------- confetti ----------
  const parts = useRef([])
  const confetti = () => {
    const fx = fxRef.current, fc = fx.getContext('2d'), cs = ['#ffd35a', '#ff2da0', '#19e3d2', '#7dffc0', '#fff', '#9b4dff']
    fx.width = fx.clientWidth; fx.height = fx.clientHeight
    const fresh = !parts.current.length
    for (let i = 0; i < 140; i++) parts.current.push({ x: fx.width / 2, y: fx.height * .3, vx: (Math.random() - .5) * 14, vy: -Math.random() * 13 - 3, r: Math.random() * 5 + 3, c: cs[i % 6], a: Math.random() * 6, l: 1 })
    if (fresh) (function f() {
      fc.clearRect(0, 0, fx.width, fx.height); parts.current = parts.current.filter(p => p.l > 0)
      for (const p of parts.current) { p.vy += .35; p.x += p.vx; p.y += p.vy; p.vx *= .985; p.a += .2; p.l -= .008; fc.save(); fc.translate(p.x, p.y); fc.rotate(p.a); fc.globalAlpha = Math.max(0, p.l); fc.fillStyle = p.c; fc.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); fc.restore() }
      if (parts.current.length) requestAnimationFrame(f); else fc.clearRect(0, 0, fx.width, fx.height)
    })()
  }

  // background: three blurred balls and soft coloured lights (positions fixed for the session)
  const boks = useMemo(() => [...Array(12)].map((_, i) => { const s = 20 + Math.random() * 50; return { left: Math.random() * 100 + '%', top: Math.random() * 90 + '%', width: s, height: s, background: ['#ff2da0', '#19e3d2', '#ffd35a', '#9b4dff'][i % 4], animationDelay: -Math.random() * 14 + 's' } }), [])
  const closeAll = () => { setRcpt(false); setSheet(null) }

  return (
    <div id="app" data-st={st}>
      <div className="bg" />
      <div id="boks">
        {[[8, 6, 58], [72, 2, 3], [84, 52, 6]].map(([x, y, n], i) => <i key={i} className={`b im d${n} fb`} style={{ '--s': 44 + i * 10 + 'px', left: x + '%', top: y + '%', animationDelay: -i * 4 + 's' }} />)}
        {boks.map((b, i) => <div key={i} className="bok" style={b} />)}
      </div>

      <div className="top">
        <button className="av" aria-label="Profile" onClick={() => setSheet('p')}><b>{user[0].toUpperCase()}</b></button>
        <div className="hi">
          <small>{st === 'home' ? ist().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' }) : st === 'res' ? 'Checked line by line' : st === 'tix' ? tickets.length + ' tickets' : show.d.lot + ' · ' + lbl(show.d.h) + ' draw' + (show.left <= CLOSE ? ' · CLOSED' : '')}</small>
          <b id="ttl">{st === 'home' ? <img alt="Lucky3" src={LOGO} /> : TTL[st]}</b>
        </div>
        <button className="gift-chip" aria-label="Refer and earn" onClick={() => setSheet('r')}><span>🎁</span><b>₹{BONUS}</b></button>
        <button key={hit} className={'bal gl' + (hit ? ' hit' : '')} aria-label="Wallet" onClick={() => setSheet('w')}><i>₹</i><span>{Math.round(walletShown).toLocaleString('en-IN')}</span><em>+</em></button>
      </div>

      {/* three floors of one machine; the camera slides between them */}
      <div id="world"><div className="cam" style={{ transform: `translateY(-${IDX[st] * 25}%)` }}>
        <Home liveRef={liveRef} led={led} machSpin={machSpin} onShake={shake} onPlay={() => { setSel(null); go('play') }} onPick={pickShow} />
        <Result tickets={tickets} published={published} rsel={rsel} drawing={drawing} onSelect={setRsel} onDemo={isLive ? null : demoPublish} />
        <Play show={show} mode={mode} tubes={tubes} shown={shown} target={target} qty={qty} cart={cart} bump={bump} glassRefs={glassRefs} btRef={btRef}
          onMode={pickMode} onBall={pickBall} onTube={tapTube} onQty={d => setQty(q => Math.min(99, Math.max(1, q + d)))} onAdd={addLines}
          onDel={i => setCart(c => c.filter((_, j) => j !== i))} onPay={pay} onTicket={() => go('tix')} />
        <Tickets cart={cart} tickets={tickets} show={show} drawing={drawing} onDel={i => setCart(c => c.filter((_, j) => j !== i))} onPay={pay} onOpen={openTicket} onDemo={isLive ? null : demoPublish} onPlay={() => go('play')} />
      </div></div>

      {/* bottom bar: the picture is the bar, these are the tap areas */}
      <nav className="dock gl">
        <button className={'ni' + (st === 'home' ? ' on' : '')} onClick={() => go('home')}>Home</button>
        <button className={'ni' + (st === 'res' ? ' on' : '')} onClick={() => go('res')}>Result</button>
        <button className="orb" onClick={() => go('play')}>PLAY</button>
        <button className={'ni' + (st === 'tix' ? ' on' : '')} onClick={() => go('tix')}>Ticket</button>
        <button className="ni" onClick={() => setSheet('w')}>Wallet</button>
      </nav>

      <div className={'shade' + (sheet || rcpt ? ' on' : '')} onClick={closeAll} />

      <div className={'sheet tall' + (sheet === 'w' ? ' on' : '')}>
        <Wallet shown={walletShown} held={held} recharges={recharges} toast={toast} withdrawals={withdrawals}
          onWithdraw={isLive ? (amount, upi) => api('withdraw', { amount, upi }).then(r => { changeWallet(r.wallet); toast(inr(amount) + ' withdrawal requested. The owner will send it to ' + upi); refresh() }, x => { toast(x.message); throw x }) : undefined}
          onRequest={async (amt, utr, upiId) => {
            if (isLive) {
              try {
                const res = await api('recharge', { amount: amt, utr, upi: upiId })
                setRecharges(r => [{ id: res.id, amt, utr, status: 'pending' }, ...r])
                toast('Payment sent for checking')
              } catch (err) {
                toast(err.message || 'Could not send recharge')
              }
            } else {
              setRecharges(r => [{ id: Date.now(), amt, utr, status: 'pending' }, ...r])
              toast('Payment sent for checking')
            }
          }}
          onConfirm={isLive ? null : id => {
            const r = recharges.find(x => x.id === id); if (!r || r.status !== 'pending') return
            setRecharges(rs => rs.map(x => x.id === id ? { ...x, status: 'added' } : x)); changeWallet(walletRef.current + r.amt); toast(inr(r.amt) + ' added to wallet')
          }} />
      </div>

      <div className={'sheet tall' + (sheet === 'r' ? ' on' : '')}>
        <Refer user={user} redeemed={refUsed} toast={toast} onRedeem={async c => {
          if (isLive) {
            try {
              await api('redeem_ref', { code: c })
              setRefUsed(c)
              changeWallet(walletRef.current + BONUS)
              toast('₹' + BONUS + ' referral bonus added to wallet')
            } catch (err) {
              toast(err.message || 'Could not redeem code')
            }
          } else {
            try { localStorage.setItem('l3ref:' + user, c) } catch { /* private mode */ }
            setTimeout(() => { setRefUsed(c); changeWallet(walletRef.current + BONUS); toast('₹' + BONUS + ' referral bonus added to wallet') }, 900)
          }
        }} />
      </div>

      <div className={'sheet' + (sheet === 'p' ? ' on' : '')}>
        <h3>Profile</h3>
        <p>Signed in as</p><div className="pemail">{user}</div>
        <button className="pay wide refbtn" onClick={() => setSheet('r')}>🎁 Refer &amp; Earn: friends get ₹{BONUS}</button>
        <button className="pay wide" style={{ background: 'linear-gradient(135deg,#ff7a8a,#ff3d5e)', color: '#fff', boxShadow: '0 0 20px rgba(255,61,94,.5)' }} onClick={onLogout}>Log out</button>
      </div>

      <div className={'rcpt' + (rcpt ? ' on' : '')} onClick={closeAll}>
        {order && <>
          <div className="stamp">BOOKED</div><h4>lucky3</h4><small>{order.lot} · {order.time} draw · {order.id}</small><div style={{ height: 10 }} />
          {order.items.map((x, i) => <div className="l" key={i}><span>{x.pos} {x.v} × {x.q}</span><span>{inr(x.q * x.price)}</span></div>)}
          <div className="l" style={{ fontSize: 16 }}><span>PAID</span><span>{inr(order.t)}</span></div><small>Paid from wallet. Tap to close.</small>
        </>}
      </div>

      <canvas id="fx" ref={fxRef} />
      <div className={'toast' + (toastS.on ? ' on' : '')}>{toastS.m}</div>
    </div>
  )
}
