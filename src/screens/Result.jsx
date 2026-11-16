import React, { useEffect, useRef, useState } from 'react'
import Ball from '../components/Ball.jsx'
import { CLOSE, LOTC, SLOTS, dayKey, dayName, hms, hrs, inr, lbl, resultOf, slotKey } from '../lib/lottery.js'

const LEFT = [22, 50.2, 78.8], DAYS = [0, 1, 2]

// Results by slot. The domes show the selected slot; the list below has every slot of the chosen day.
export default function Result({ tickets, published, rsel, drawing, onSelect, onDemo }) {
  const [off, setOff] = useState(0), top = useRef()
  useEffect(() => { const o = DAYS.find(x => dayKey(x) === rsel.day); if (o !== undefined) setOff(o); top.current?.scrollTo({ top: 0, behavior: 'smooth' }) }, [rsel])

  const day = dayKey(off), h = hrs()
  const res = resultOf(rsel.day, rsel.lot, rsel.h, published), sk = slotKey(rsel.day, rsel.lot, rsel.h)
  const selOff = DAYS.find(x => dayKey(x) === rsel.day) ?? 0
  const mine = t => s => s.day === t.day && s.lot === t.lot && s.h === t.h
  const myTickets = tickets.filter(mine(rsel))

  return (
    <section className="st" id="s-res" ref={top}>
      <div className="chute metal" />
      <div className="tubes big" id="rtubes">
        {['A', 'B', 'C'].map((l, i) => (
          <div key={l} className="tube" style={{ left: LEFT[i] + '%' }}>
            <button className="glass" aria-label={'Dome ' + l}>{res && <Ball key={sk + i} n={res[i]} size={66} cls="fall" style={{ animationDelay: i * .3 + 's', animationFillMode: 'backwards' }} />}</button>
          </div>
        ))}
      </div>
      <div className="rcap">
        <b style={{ color: LOTC[rsel.lot] }}>{rsel.lot.toUpperCase()}</b> · {lbl(rsel.h)} · {dayName(selOff)}
        <small>{res ? 'Result ' + [...res].join(' ') + (published[sk] ? ' (demo)' : '') : 'Result not out yet. Draw at ' + lbl(rsel.h)}</small>
      </div>

      {/* the player's tickets for this slot, checked line by line under A, B, C */}
      {myTickets.map(t => (
        <div className="tk gl" key={t.id}>
          <div className="th"><span>YOUR TICKET</span><span className="hd"><i>A</i><i>B</i><i>C</i></span><span>WON</span></div>
          {t.items.map((x, i) => {
            const c = t.lines && t.lines[i], d = { transitionDelay: i * .22 + 's' }
            return (
              <div className="tr" key={i}>
                <em>{x.pos}{x.q > 1 ? '×' + x.q : ''}</em>
                <div className="cells">
                  {[...'ABC'].map(p => { const k = x.pos.indexOf(p); return k < 0 ? <span key={p} className="cell off">·</span> : <span key={p} style={d} className={'cell' + (c ? (c.hit[k] ? ' ok' : ' no') : '')}>{x.v[k]}</span> })}
                </div>
                <b style={c && !c.w ? { color: 'rgba(255,255,255,.35)' } : undefined}>{c ? (c.w ? '+ ' + inr(c.w) : '—') : ''}</b>
              </div>
            )
          })}
          {t.status === 'done' ? <>
            <div className="tot"><span>{t.tot ? 'Added to wallet' : 'No instant win this time'}</span><b>{inr(t.tot)}</b></div>
            {t.held > 0 && <div className="hold">{inr(t.held)} is waiting for owner approval before it reaches your wallet.</div>}
          </> : (
            <div className="twait"><span>{t.id} · waiting for the result</span>{onDemo && <button className="demo" disabled={drawing} onClick={() => onDemo(t)}>Publish demo result</button>}</div>
          )}
        </div>
      ))}

      <div className="dtabs">{DAYS.map(o => <button key={o} className={o === off ? 'on' : ''} onClick={() => setOff(o)}>{dayName(o)}</button>)}</div>

      <div className="rlist" key={day}>
        {SLOTS.map((s, i) => {
          const r = resultOf(day, s.lot, s.h, published), left = Math.round((s.h - h) * 3600), my = tickets.filter(mine({ day, ...s }))
          const won = my.reduce((a, t) => a + (t.tot || 0) + (t.held || 0), 0), waiting = my.some(t => t.status === 'wait')
          return (
            <button key={s.lot + s.h} className={'rs' + (sk === slotKey(day, s.lot, s.h) ? ' sel' : '') + (r ? '' : ' pend')} style={{ '--c': LOTC[s.lot], '--i': i }} onClick={() => onSelect({ day, lot: s.lot, h: s.h })}>
              <span className="rst">{s.h > 12 ? s.h - 12 : s.h}<small>{s.h >= 12 ? 'PM' : 'AM'}</small></span>
              <span className="rsm">
                <b>{s.lot}</b>
                <small>{r ? 'Result out' + (published[slotKey(day, s.lot, s.h)] ? ' (demo)' : '') : left <= CLOSE ? 'Booking closed · result soon' : 'Result at ' + lbl(s.h) + ' · in ' + hms(left)}</small>
                {my.length > 0 && <em className={waiting ? 'g' : won ? 'w' : ''}>{waiting ? 'YOUR TICKET · WAITING' : won ? 'YOU WON ' + inr(won) : 'YOUR TICKET · NO WIN'}</em>}
              </span>
              <span className="rsb">
                {r ? [...r].map((x, j) => <Ball key={j} n={x} size={30} cls="rb" style={{ animationDelay: (i * .05 + j * .08) + 's' }} />) : [0, 1, 2].map(j => <i key={j} className="q">?</i>)}
              </span>
            </button>
          )
        })}
      </div>
      <div className="note">Results shown here are sample numbers until the owner portal is connected.</div>
    </section>
  )
}
