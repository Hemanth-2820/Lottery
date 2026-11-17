import React, { useState } from 'react'
import Ball from '../components/Ball.jsx'

export let BONUS = 100
export const setBonus = v => { BONUS = +v }
// Each player's own code comes from their email (TODO(backend): the server should issue and store codes)
export const codeFor = email => { let h = 7; for (const c of email.toLowerCase()) h = Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0; return 'L3' + h.toString(36).toUpperCase().slice(0, 6).padStart(6, '7') }
// Demo friends who joined with this player's code
const FRIENDS = [['Ravi K', 'Joined · got ₹100', '#ff2d8a'], ['Anjali S', 'Joined · got ₹100', '#12c4e0'], ['Mohan R', 'Invite sent', '#ffb703']]
const COINS = [...Array(14)].map((_, i) => ({ '--a': i * (360 / 14) + 'deg', '--d': 70 + (i % 3) * 22 + 'px', '--dl': (i % 4) * 0.04 + 's' }))

export default function Refer({ user, redeemed, onRedeem, toast }) {
  const code = codeFor(user), link = 'https://lucky3.app/join?ref=' + code
  const msg = `Play Lucky3 with me! Use my code ${code} when you sign up and get ₹${BONUS} in your wallet to play. ${link}`
  const [open, setOpen] = useState(false), [inp, setInp] = useState(''), [err, setErr] = useState('')
  const copy = (t, what) => { try { navigator.clipboard.writeText(t).then(() => toast(what + ' copied'), () => toast('Copy: ' + t)) } catch { toast('Copy: ' + t) } }
  const share = () => { if (navigator.share) navigator.share({ title: 'Lucky3', text: msg }).catch(() => {}); else copy(msg, 'Invite message') }
  const redeem = e => {
    e.preventDefault(); const c = inp.trim().toUpperCase()
    if (!/^L3[0-9A-Z]{6}$/.test(c)) return setErr('Codes look like L3XXXXXX')
    if (c === code) return setErr('You cannot use your own code')
    // TODO(backend): check the code exists, belongs to another player, and this account has not used one before
    setErr(''); setOpen(true); onRedeem(c)
  }

  return (
    <div className="ref">
      <div className="ref-hero">
        <div className="ref-rays" />
        <div className="ref-txt"><small>Refer &amp; Earn</small><h3>Give <b>₹{BONUS}</b>,<br />share the luck</h3><p>Every friend who joins with your code gets ₹{BONUS} in their wallet to play.</p></div>
        <button type="button" className={'gift' + (open ? ' open' : '')} aria-label="Gift box" onClick={() => setOpen(o => !o)}>
          <span className="gift-lid" /><span className="gift-box" /><span className="gift-coin">₹{BONUS}</span>
          {open && <span className="gift-burst">{COINS.map((s, i) => <i key={i} style={s}>₹</i>)}</span>}
        </button>
      </div>

      <div className="ref-tk">
        <small>Your referral code</small>
        <div className="ref-code">{code.split('').map((ch, i) => <span key={i} style={{ '--i': i }}>{ch}</span>)}</div>
        <div className="ref-btns">
          <button type="button" onClick={() => copy(code, 'Code')}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="8" y="8" width="12" height="12" rx="3" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>Copy</button>
          <a className="wa" href={'https://wa.me/?text=' + encodeURIComponent(msg)} target="_blank" rel="noreferrer"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.1-.1-.2-1.1-1.500-1.1-2.9s.7-2.1 1-2.4c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.5.3.1.2.1.6-.1 1.2z" /></svg>WhatsApp</a>
          <button type="button" onClick={share}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>Share</button>
        </div>
      </div>

      <div className="ref-steps">
        {[['Share your code', 'Send it on WhatsApp or anywhere'], ['Friend signs up', 'They enter your code once'], [`₹${BONUS} lands`, 'In their wallet, ready to play']].map(([t, s], i) => (
          <div key={i} className="ref-st" style={{ '--i': i }}><Ball n={i + 1} size={34} /><b>{t}</b><small>{s}</small></div>
        ))}
      </div>

      <form className={'ref-redeem' + (redeemed ? ' done' : '')} onSubmit={redeem} noValidate>
        {redeemed ? <p>🎉 You joined with code <b>{redeemed}</b>. ₹{BONUS} was added to your wallet.</p> : <>
          <label htmlFor="ref-in">Got a friend's code?</label>
          <div><input id="ref-in" value={inp} maxLength={8} placeholder="L3XXXXXX" autoCapitalize="characters" onChange={e => { setInp(e.target.value.toUpperCase()); setErr('') }} /><button>Claim ₹{BONUS}</button></div>
          {err ? <small className="bad">{err}</small> : <small>One code per account. Demo: any code in this format works.</small>}
        </>}
      </form>

      <div className="ref-fr">
        <h4>Friends you invited <em>{FRIENDS.filter(f => f[1].startsWith('Joined')).length} joined · ₹{BONUS * 2} gifted</em></h4>
        {FRIENDS.map(([n, s, c], i) => <div key={n} className="ref-f" style={{ '--i': i }}><i style={{ background: c }}>{n[0]}</i><b>{n}</b><span className={s.startsWith('Joined') ? 'ok' : ''}>{s}</span></div>)}
        <small>Sample friends for the demo.</small>
      </div>
    </div>
  )
}
