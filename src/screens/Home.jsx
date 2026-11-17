import React, { Fragment, useEffect, useState } from 'react'
import Ball from '../components/Ball.jsx'
import { Led } from '../components/Clocks.jsx'
import { MACH } from '../art.js'
import { CLOSE, COL, DRAWS, GREY, LOTS, PRICE, WIN, inr, arc, closeLbl, hms, hrs, lbl, nextDraw, past, pt, sh12, skyElev, skyMode } from '../lib/lottery.js'

const PRIZES = (
  <>
    <span><b>Single</b> {inr(PRICE[0])} wins <em>{inr(WIN[0])}</em></span><span><b>Double</b> {inr(PRICE[1])} wins <em>{inr(WIN[1])}</em></span>
    <span><b>Triple</b> {inr(PRICE[2])} wins <em>{inr(WIN[2])}</em></span><span>Booking closes <b>{Math.round(CLOSE / 60)} minutes</b> before every draw</span>
  </>
)

export default function Home({ liveRef, led, machSpin, onShake, onPlay, onPick }) {
  const [intro, setIntro] = useState(true)                    // machine drop-in runs once
  useEffect(() => { const t = setTimeout(() => setIntro(false), 1100); return () => clearTimeout(t) }, [])

  const h = hrs(), n = nextDraw(), now = Math.min(21, Math.max(10, h)), p = pt(now), locked = n.left <= CLOSE

  // one card per lottery, soonest draw first
  const cards = LOTS.map(L => { const nx = L.h.find(x => x > h), last = L.h.filter(x => x <= h).pop(); return { L, nx, last, key: nx || 99 } }).sort((a, b) => a.key - b.key)

  return (
    <section className="st" id="s-home">
      <div className="rig">
        {/* the day as a dial: light runs to "now", red tips are the 3 closed minutes */}
        <svg viewBox="0 0 360 352" id="dial" className="intro">
          <defs>
            <linearGradient id="pg" x1="0" x2="1"><stop offset="0" stopColor="#19e3d2" /><stop offset=".6" stopColor="#ffd35a" /><stop offset="1" stopColor="#ff2da0" /></linearGradient>
            <filter id="gb"><feGaussianBlur stdDeviation="5" /></filter>
          </defs>
          <path d={arc(10, 21)} stroke="rgba(255,255,255,.11)" strokeWidth="12" fill="none" strokeLinecap="round" />
          {now > 10.02 && <>
            <path d={arc(10, now)} stroke="url(#pg)" strokeWidth="12" fill="none" strokeLinecap="round" filter="url(#gb)" opacity=".8" />
            <path className="prog" pathLength="1" d={arc(10, now)} stroke="url(#pg)" strokeWidth="6" fill="none" strokeLinecap="round" />
            <path className="run" pathLength="1" d={arc(10, now)} stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray=".07 .93" opacity=".9" />
          </>}
          {DRAWS.filter(d => d.h > h).map(d => <path key={d.h} d={arc(d.h - .25, d.h)} stroke="#ff3d5e" strokeWidth="12" fill="none" />)}
          <circle cx={p[0]} cy={p[1]} r="13" fill="#ffd35a" opacity=".5" filter="url(#gb)" /><circle cx={p[0]} cy={p[1]} r="7" fill="#fff" /><circle cx={p[0]} cy={p[1]} r="3.5" fill="#ff7a1a" />
        </svg>
        <div id="stops">
          {DRAWS.map((d, i) => {
            const q = pt(d.h), done = d.h <= h, isN = !n.tom && i === n.i, end = i === DRAWS.length - 1
            return (
              <Fragment key={d.h}>
                <div className="stop" style={{ left: q[0] / 3.6 + '%', top: q[1] }}>
                  {done ? <Ball n="✓" size={26} color={COL[3]} style={{ fontSize: 11 }} /> : isN ? <Ball n="?" size={42} color={COL[0]} cls="next" /> : <Ball n="" size={22} color={GREY} style={{ opacity: .8 }} />}
                </div>
                <div className="sl" style={{ left: (end ? Math.min(334, q[0] + 4) : q[0]) / 3.6 + '%', top: end ? q[1] + 28 : q[1] - (isN ? 34 : 25) }}><b>{sh12(d.h)}</b></div>
              </Fragment>
            )
          })}
          <div className="ping" style={{ left: p[0] / 3.6 + '%', top: p[1] }} />
        </div>

        <div className="rays" /><div className="rings"><i /><i /><i /></div>
        <img className={'mach' + (intro ? ' in' : '') + (machSpin ? ' spin' : '')} alt="Lottery machine" src={MACH} />
        <canvas id="live" ref={liveRef} />
        <button className="machhit" aria-label="Shake the machine" onClick={onShake} />
        <div className="base"><Led text={led || hms(n.left)} /></div>
      </div>

      <div className="nxt">{(n.tom ? 'TOMORROW' : 'NEXT') + ' · ' + lbl(n.d.h) + ' · ' + n.d.lot.toUpperCase()}</div>
      <span className={'cl' + (locked ? ' shut' : '')}><i /><span>{locked ? 'Booking closed for ' + lbl(n.d.h) : 'Booking closes ' + closeLbl(n.d.h) + ', 3 minutes before the draw'}</span></span>
      <button className="cta" onClick={onPlay}>{'Pick numbers for ' + lbl(n.d.h) + ' ›'}</button>
      <div className="prize"><div>{PRIZES}{PRIZES}</div></div>

      <div className="strip" id="strip">
        {cards.map(({ L, nx, last }, i) => {
          const st = !nx ? 'done' : (nx - h) * 3600 <= CLOSE ? 'shut' : 'open', hh = nx || L.h[0], sk = nx || last, m = skyMode(sk), ft = i === 0
          const res = last ? [...past(last, L.k)].map((x, j) => <Ball key={j} n={x} size={ft || !nx ? 26 : 20} cls="rb" style={{ animationDelay: (1.7 + i * .12 + j * .1) + 's' }} />) : null
          return (
            <div key={L.k} className={`dc ${st} s${m} ${ft ? 'feat' : ''}`} style={{ '--i': i }} role="button" tabIndex={0} onClick={() => onPick(L.k, nx || 0)}>
              <span className={'sc ' + ['sun', 'wave', 'set', 'moon'][m]}><i /></span>
              <canvas className="sky" data-m={m} data-v={i * 3.7 + sk} data-e={skyElev(sk)} />
              <span className="dcl">{L.k.toUpperCase()}</span>
              <span className="dcs">{st === 'open' ? <><s />OPEN</> : st === 'shut' ? 'CLOSED' : 'DONE TODAY'}</span>
              <span className="dct">{hh > 12 ? hh - 12 : hh}<small>{(hh >= 12 ? 'PM' : 'AM') + (nx ? '' : ' tomorrow')}</small></span>
              <span className="dch">
                {L.h.map(x => <i key={x} className={x <= h ? 'dn' : x === nx ? 'nx' : ''} onClick={e => { e.stopPropagation(); onPick(L.k, x) }}>{sh12(x)}{x <= h ? ' ✓' : ''}</i>)}
              </span>
              <span className="dcf">
                {st === 'open' ? <><b className="cd2">{hms(Math.max(0, Math.round((nx - h) * 3600)))}</b>{ft && res && <span className="lr">{sh12(last)} result {res}</span>}<em>Book ›</em></>
                  : st === 'shut' ? 'Booking closed · draw starting'
                    : <span className="lr">{sh12(last)} result {res}</span>}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}