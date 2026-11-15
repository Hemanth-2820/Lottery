import React from 'react'
import Ball from '../components/Ball.jsx'
import { FlipClock } from '../components/Clocks.jsx'
import { CLOSE, LOTS, PRICE, closeLbl, current, hms, hrs, inr, lbl, past, perms, sh12, skyElev, skyMode } from '../lib/lottery.js'

const NOTE = 'Tickets will not be available to purchase 3 minutes before the draw  ★  '
const LEFT = [22, 50.2, 78.8]   // where the three domes sit on the stage picture (%)

export default function Play({ show, mode, tubes, shown, target, qty, cart, bump, glassRefs, btRef,
  onMode, onBall, onTube, onQty, onAdd, onDel, onPay, onTicket }) {
  const shut = show.left <= CLOSE, k = show.d.h
  const L = LOTS.find(x => x.k === show.d.lot), last = L.h.filter(x => x <= hrs()).pop()
  const { pos, v, n, ok } = current(tubes, mode), full = mode === 1 && n >= 2
  const pm = mode === 2 && n === 3 ? perms(v) : []
  const cost = (mode === 0 ? PRICE[0] * n : PRICE[mode]) * qty
  const count = cart.reduce((a, x) => a + x.q, 0), total = cart.reduce((a, x) => a + x.q * x.price, 0)
  // spark position on the fuse: 0-86% is time until booking closes (3 h scale), the last 14% is the closed zone
  const fuse = (shut ? .86 + .14 * (1 - show.left / CLOSE) : .86 * (1 - Math.min(1, (show.left - CLOSE) / 10800))) * 100

  return (
    <section className={'st' + (shut ? ' lock' : '')} id="s-play">
      <div className="pnote"><div>{NOTE.repeat(4)}</div></div>

      <div className={'pinfo' + (show.left <= 600 ? ' soon' : '') + (shut ? ' shut' : '')} id="pinfo">
        <canvas className="sky" id="psky" data-m={skyMode(k)} data-v={k * 1.3} data-e={skyElev(k)} />
        <div className="prow">
          <div className="pl">
            <small>NOW BOOKING</small><b id="plot">{show.d.lot} Lottery</b>
            <span>{last ? <>Last {sh12(last)} {[...past(last, show.d.lot)].map((x, j) => <Ball key={j} n={x} size={22} />)}</> : 'No result yet today'}</span>
          </div>
          <div className="pr"><small>{shut ? 'Booking closed' : 'Time remaining'}</small><FlipClock text={hms(shut ? 0 : show.left)} /></div>
        </div>
        <div className="fz" style={{ '--p': fuse.toFixed(2) + '%' }}><i className="burn" /><i className="red" /><i className="spark" /></div>
        <div className="fl"><span>Booking closes {closeLbl(k)}</span><span>Draw {lbl(k)}</span></div>
      </div>
      <div className="pclosed">Booking closed for this draw. Tickets stop 3 minutes before the draw.</div>

      <div className="lamps" id="lamps">
        {[['Single ₹12', 'A, B or C · win ₹100'], ['Double ₹12', 'AB, AC, BC · win ₹1,000'], ['Triple ₹30', 'ABC · win ₹15,000']].map(([t, s], i) =>
          <button key={i} className={i === mode ? 'on' : ''} onClick={() => onMode(i)}><b>{t}</b>{s}</button>)}
      </div>

      <div className="tubes" id="tubes">
        {['A', 'B', 'C'].map((l, i) => (
          <div key={l} className={'tube' + (!full && i === target && tubes[i] === null ? ' tg' : '')} style={{ left: LEFT[i] + '%', opacity: full && tubes[i] === null ? .35 : 1 }} onClick={() => onTube(i)}>
            <button className="glass" aria-label={'Dome ' + l} ref={el => (glassRefs.current[i] = el)}>
              {shown[i] !== null && <Ball n={shown[i]} size={66} cls="land" />}
            </button>
          </div>
        ))}
      </div>

      <div className="say">
        {mode === 0 ? (n ? <><b>{[...pos].map((p, j) => p + '=' + v[j]).join('  ')}</b> · {n} Single bet{n > 1 ? 's' : ''} · win <em>₹100</em> each</> : 'Single: every tube is its own ₹12 bet. Tap a ball.')
          : mode === 1 ? (ok ? <><b>{pos} = {v}</b> · Double · win <em>₹1,000</em></> : 'Double: fill any two tubes (AB, AC or BC).')
            : (ok ? <><b>ABC = {v}</b> · Triple · win <em>₹15,000</em><small>BOX adds {pm.join(' ')}</small></> : 'Triple: fill all three tubes. BOX adds every order.')}
      </div>

      <div className="tray gl">
        {[...Array(10)].map((_, d) => <button key={d} className={tubes.includes(d) ? 'sel' : ''} aria-label={'Ball ' + d} onClick={e => onBall(d, e.currentTarget)}><Ball n={d} size={46} /></button>)}
      </div>

      {/* the player's numbers, each removable */}
      <div className="perm">
        {cart.length ? cart.map((x, i) => <span key={x.pos + x.v}>{x.pos} {x.v} ×{x.q}<button aria-label={`Remove ${x.pos} ${x.v}`} onClick={() => onDel(i)}>✕</button></span>)
          : <small>Your numbers will show here. You can remove any of them.</small>}
      </div>

      <div className="act">
        <div className="qty gl"><button aria-label="Less" onClick={() => onQty(-1)}>−</button><b>{qty}</b><button aria-label="More" onClick={() => onQty(1)}>+</button></div>
        <button className="add" disabled={!ok} onClick={() => onAdd(false)}>{ok ? 'ADD ' + inr(cost) : 'ADD'}</button>
        {mode === 2 && <button className="add box" disabled={!ok} onClick={() => onAdd(true)}>{ok ? `BOX ${pm.length} · ${inr(PRICE[2] * pm.length * qty)}` : 'BOX'}</button>}
      </div>

      <div key={bump} className={'bar gl' + (bump ? ' bump' : '')}>
        <button style={{ textAlign: 'left' }} onClick={onTicket}><small>{count ? count + ' number' + (count > 1 ? 's' : '') + ' in ticket' : 'Ticket is empty'}</small><b ref={btRef}>{inr(total)}</b></button>
        <button className="pay" onClick={onPay}>Pay now</button>
      </div>
    </section>
  )
}