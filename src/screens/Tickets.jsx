import React, { Fragment, useState } from 'react'
import { useAnimatedNumber } from '../hooks/hooks.js'
import Ball from '../components/Ball.jsx'
import { LOTC, dayLabel, hms, hrs, inr, lbl } from '../lib/lottery.js'

const FILTERS = [['all', 'All'], ['wait', 'Waiting'], ['won', 'Won'], ['lost', 'No win']]
const stateOf = t => t.status === 'wait' ? 'wait' : (t.tot || 0) + (t.held || 0) ? 'won' : 'lost'

// My tickets: a full page. Each ticket is drawn as the machine's three tubes (A, B, C):
// the result on top, the player's balls in the tubes below, matched balls ringed in green.
export default function Tickets({ cart, tickets, show, drawing, onDel, onPay, onOpen, onDemo, onPlay }) {
  const [f, setF] = useState('all')
  const won = tickets.reduce((a, t) => a + (t.tot || 0) + (t.held || 0), 0), waiting = tickets.filter(t => t.status === 'wait').length
  const list = tickets.filter(t => f === 'all' || stateOf(t) === f)
  const days = [...new Set(list.map(t => t.day))]
  const total = cart.reduce((a, x) => a + x.q * x.price, 0)
  const wonShown = useAnimatedNumber(won, 1400)
  let n = 0

  return (
    <section className="st" id="s-tix">
      <div className="tfx" aria-hidden="true">{[...Array(14)].map((_, k) => <i key={k} style={{ '--x': (k * 37) % 100 + '%', '--d': (k % 5) * 1.3 + 's', '--h': k * 26 + 'deg' }} />)}</div>
      <div className="tstats">
        <div className="ts a"><small>Tickets</small><b>{tickets.length}</b></div>
        <div className="ts b"><small>Total won</small><b>{inr(wonShown)}</b></div>
        <div className="ts c"><small>Waiting</small><b>{waiting}</b></div>
      </div>

      {/* numbers added but not paid yet */}
      {cart.length > 0 && (
        <div className="draft">
          <h5>Not paid yet · {show.d.lot} {lbl(show.d.h)}</h5>
          <div className="tkn">{cart.map((x, i) => <span className="ln2" key={x.pos + x.v}><em>{x.pos}</em>{[...x.v].map((d, j) => <Ball key={j} n={d} size={22} />)}{x.q > 1 && <i>×{x.q}</i>}<button aria-label={`Remove ${x.pos} ${x.v}`} onClick={() => onDel(i)}>✕</button></span>)}</div>
          <button className="pay wide" onClick={onPay}>Pay now {inr(total)}</button>
        </div>
      )}

      <div className="dtabs">{FILTERS.map(([k, l]) => <button key={k} className={k === f ? 'on' : ''} onClick={() => setF(k)}>{l}</button>)}</div>

      {list.length > 0 && <div className="legend"><span><i className="lg hit" />Matched the result</span><span><i className="lg miss" />Missed</span><span><i className="lg q">?</i>Result not out</span></div>}

      {!list.length && <>
        <div className="note" style={{ padding: '18px 0 6px' }}>{tickets.length ? 'No tickets in this list.' : 'No tickets yet. Pick numbers and pay to get your first ticket.'}</div>
        <button className="cta" onClick={onPlay}>Pick numbers ›</button>
      </>}

      {days.map(day => (
        <Fragment key={day + f}>
          <h5 className="tday"><span>{dayLabel(day)}</span></h5>
          {list.filter(t => t.day === day).map(t => {
            const s = stateOf(t), w = (t.tot || 0) + (t.held || 0), i = n++
            const C2 = { Dear: '#ffb703', Kerala: '#19c3ff', Punjab: '#ff3d6a', Sikkim: '#7dffc0', 'Goa Queen': '#ff7ac8' }[t.lot]
            const top = t.items.some(x => x.pos.length === 3) ? 15000 : t.items.some(x => x.pos.length === 2) ? 1000 : 100
            return (
              <div key={t.id} className={'bt ' + s} style={{ '--c': LOTC[t.lot], '--c2': C2, '--i': i }} role="button" tabIndex={0} onClick={() => onOpen(t)}>
                {s === 'won' && <div className="bt-halo" />}
                <div className="bt-in">
                  <div className="bt-head">
                    <span className="bt-ball">{t.lot[0]}</span>
                    <div className="bt-name"><b>{t.lot}</b><small>{lbl(t.h)} · {dayLabel(t.day)}</small></div>
                    <em className="bt-st">{s === 'wait' ? <><s />LIVE</> : s === 'won' ? '★ WINNER' : 'NO WIN'}</em>
                  </div>

                  {/* the ticket as the machine's three tubes: result on top, the player's balls in the lanes below */}
                  <div className="bt-board">
                    {[0, 1, 2].map(k => <div key={k} className="lane" style={{ '--k': k }}><i /></div>)}
                    <div className="bt-row caps"><span />{['A', 'B', 'C'].map(l => <span key={l} className="bt-cell"><b className={'cap2 c' + l}>{l}</b></span>)}<span /></div>
                    <div className="bt-row res">
                      <span className="bt-lab">RESULT</span>
                      {[0, 1, 2].map(k => <span key={k} className="bt-cell"><span className="slot">{t.res ? <Ball n={t.res[k]} size={32} cls="drop2" style={{ animationDelay: (.6 + i * .1 + k * .18) + 's' }} /> : <i className="spin">?</i>}</span></span>)}
                      <span className="bt-won">{s === 'wait' ? <b className="cd3">{hms(Math.max(0, Math.round((t.h - hrs()) * 3600)))}</b> : ''}</span>
                    </div>
                    {t.items.map((x, j) => {
                      const c = t.lines && t.lines[j]
                      return (
                        <div className={'bt-row' + (c && c.w ? ' w' : '')} key={j} style={{ '--j': j }}>
                          <span className="bt-lab"><em>{x.pos}</em><small>{['Single', 'Double', 'Triple'][x.pos.length - 1]}{x.q > 1 ? ' ×' + x.q : ''}</small></span>
                          {[...'ABC'].map(p => { const k = x.pos.indexOf(p); return <span key={p} className="bt-cell">{k < 0 ? <i className="dot" /> : <span className={'pb' + (c ? (c.hit[k] ? ' hit' : ' miss') : '')}><Ball n={x.v[k]} size={27} />{c && c.hit[k] && <u>✓</u>}</span>}</span> })}
                          <span className="bt-won">{c ? (c.w ? <b>+{inr(c.w)}</b> : <i>—</i>) : ''}</span>
                        </div>
                      )
                    })}
                  </div>

                  <div className="bt-foot">
                    <div className="bt-id"><span className="bc" /><span>{t.id}{t.sample ? ' · SAMPLE' : ''}<br />Paid {inr(t.t)} · {s === 'wait' ? 'result at ' + lbl(t.h) : t.lines.filter(c => c.w).length + ' of ' + t.items.length + ' lines won'}</span></div>
                    {s === 'wait' ? <button className="demo" disabled={drawing} onClick={e => { e.stopPropagation(); onDemo(t) }}>Demo result</button> : null}
                    <div className="bt-tot"><small>{s === 'wait' ? 'WIN UP TO' : w ? 'YOU WON' : 'RESULT'}</small><b>{s === 'wait' ? inr(top) : w ? inr(w) : 'No win'}</b></div>
                  </div>
                </div>
              </div>
            )
          })}
        </Fragment>
      ))}
      {tickets.some(t => t.held > 0) && <div className="note">Wins of ₹15,000 or more wait for owner approval before they reach the wallet.</div>}
    </section>
  )
}
