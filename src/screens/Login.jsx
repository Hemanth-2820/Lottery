import React, { useEffect, useRef, useState } from 'react'
import { LIVE, api, setToken } from '../lib/api.js'
import './login.css'

// Murugan sign-in, built from separate pieces so every part can move:
// glowing stage background with light rays and sparkles, Lord Murugan header floating,
// the 5 lottery cards popping in, the "Murugan Lucky Draw" badge with floating balls,
// and a real glass login card (email -> 6-digit code shown as lottery balls).
const A = import.meta.env.BASE_URL + 'art/'
const CARDS = ['dear', 'kerala', 'goa', 'sikkim', 'punjab']
const BALLS = [[3, '6%', '8%', 2.4], [7, '84%', '4%', 2.9], [2, '0%', '58%', 3.2], [5, '88%', '56%', 2.6]]   // [number, left, top, seconds]
const SPARK = [...Array(26)].map((_, i) => ({ '--x': (i * 37 + 7) % 100 + '%', '--t': 5 + (i * 13) % 6 + 's', '--dl': -((i * 29) % 90) / 10 + 's', '--s': 2 + (i * 7) % 3 + 'px' }))
const mask = e => { const [n, d] = e.split('@'); return n[0] + '***@' + d }

// firework of gold glitter when the code is right
function Burst() {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current, x = c.getContext('2d'), D = Math.min(devicePixelRatio || 1, 2)
    const W = c.clientWidth, H = c.clientHeight; c.width = W * D; c.height = H * D; x.scale(D, D)
    const cols = ['#fff6c2', '#ffd23f', '#ff9a1f', '#ff4fd8', '#5ef0ff', '#ffffff'], P = []
    for (let i = 0; i < 180; i++) { const a = Math.random() * 7, v = 2 + Math.random() * 7; P.push({ x: W / 2, y: H / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, l: 1, d: .012 + Math.random() * .015, r: 1 + Math.random() * 2, c: cols[i % 6] }) }
    let raf
    const loop = () => {
      x.globalCompositeOperation = 'destination-out'; x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'lighter'
      let alive = 0
      for (const p of P) { if (p.l <= 0) continue; alive++; p.vx *= .96; p.vy = p.vy * .96 + .08; p.x += p.vx; p.y += p.vy; p.l -= p.d
        x.globalAlpha = p.l * .3; x.fillStyle = p.c; x.beginPath(); x.arc(p.x, p.y, p.r * 2.5, 0, 7); x.fill(); x.globalAlpha = p.l; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 7); x.fill() }
      x.globalAlpha = 1; if (alive) raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={ref} className="mg-burst" />
}

export default function Login({ onLogin }) {
  const [email, setEmail] = useState(''), [step, setStep] = useState(0)
  const [code, setCode] = useState(''), [otp, setOtp] = useState(''), [state, setState] = useState('')
  const [left, setLeft] = useState(0), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  const otpRef = useRef(), tm = useRef()
  const say = m => { setMsg(m); clearTimeout(tm.current); tm.current = setTimeout(() => setMsg(''), 2600) }
  useEffect(() => { if (left <= 0) return; const t = setTimeout(() => setLeft(l => l - 1), 1000); return () => clearTimeout(t) }, [left])

  const send = e => {
    if (e) e.preventDefault()
    const em = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return say('Enter a valid email address')
    const go = c => { setCode(c); setOtp(''); setState(''); setLeft(30); setStep(1); say('Code sent to ' + mask(em)); setTimeout(() => otpRef.current?.focus(), 400) }
    if (!LIVE) return go(String(Math.floor(100000 + Math.random() * 900000)))
    setBusy(true)
    api('send_otp', { email: em }).then(r => go(r.dev_code || ''), x => say(x.message)).finally(() => setBusy(false))
  }
  const type = v => {
    if (state === 'ok') return
    v = v.replace(/\D/g, '').slice(0, 6); setOtp(v); setState('')
    if (v.length < 6) return
    const good = () => { setState('ok'); otpRef.current?.blur(); setTimeout(() => onLogin(email.trim().toLowerCase()), 2600) }
    const bad = m => { setState('bad'); say(m || 'Wrong code. Try again.'); setTimeout(() => { setOtp(''); setState('') }, 700) }
    if (!LIVE) return v === code ? good() : bad()
    api('verify_otp', { email: email.trim(), code: v }).then(r => { setToken(r.token); good() }, x => bad(x.message))
  }

  return (
    <div id="mgl">
      <div className="mg-sky" />
      <div className="mg-rays" />
      <div className="mg-streak l" /><div className="mg-streak r" />
      <div className="mg-spark">{SPARK.map((s, i) => <i key={i} style={s} />)}</div>

      <div className="mg-col">
        <div className="mg-hero">
          <div className="mg-halo" />
          <img src={A + 'mg-hero.webp'} alt="Lord Murugan" />
          <div className="mg-gleam" />
        </div>

        <div className="mg-cards">{CARDS.map((n, i) => <div key={n} className="mg-card" style={{ '--i': i }}><img src={A + 'mg-card-' + n + '.webp'} alt={n} /></div>)}</div>

        <div className="mg-badge">
          <div className="mg-bglow" />
          <img src={A + 'mg-badge.webp'} alt="Murugan Lucky Draw" />
          {BALLS.map(([n, x, y, t], i) => <img key={i} className="mg-ball" src={A + 'ball' + n + '.webp'} alt="" style={{ left: x, top: y, '--t': t + 's', '--i': i }} />)}
        </div>

        <div className={'mg-login' + (state === 'ok' ? ' win' : '')}>
          <div className="mg-title"><span className="lf">❧</span><b>{step === 0 ? 'Login' : state === 'ok' ? 'Vetrivel!' : 'Enter code'}</b><span className="lf r">❧</span></div>
          {step === 0 ? (
            <form onSubmit={send} noValidate>
              <p>Sign in with your email. We'll send you a 6-digit code.</p>
              <label className="mg-field">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3.5 6.5 12 13l8.5-6.5" /></svg>
                <input type="email" inputMode="email" autoComplete="email" placeholder="Enter your email address" value={email} onChange={e => setEmail(e.target.value)} aria-label="Email" />
              </label>
              <button className="mg-btn" disabled={busy}>{busy ? 'Sending…' : <>Send Code <span>›</span></>}</button>
            </form>
          ) : (
            <>
              <p>Sent to <b>{mask(email.trim())}</b> · <button type="button" className="mg-lnk" onClick={() => setStep(0)}>Change</button></p>
              <label className={'mg-otp ' + state}>
                {[0, 1, 2, 3, 4, 5].map(i => <span key={i} className={i === otp.length && state !== 'ok' ? 'cur' : ''}>{otp[i] !== undefined && <img key={otp[i] + i} src={A + 'ball' + otp[i] + '.webp'} alt={otp[i]} />}</span>)}
                {state === 'ok' && <Burst />}
                <input ref={otpRef} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={e => type(e.target.value)} aria-label="6-digit code" />
              </label>
              <p className="mg-small">Check your inbox (and Spam) for the code. {left > 0 ? 'Send again in 0:' + String(left).padStart(2, '0') : <button type="button" className="mg-lnk" onClick={() => send()}>Send the code again</button>}</p>
            </>
          )}
          <div className="mg-foot"><i /><span>♛</span><i /></div>
          <small className="mg-age">By continuing, you confirm you are 18+ or older.</small>
        </div>
      </div>
      <div className={'toast' + (msg ? ' on' : '')}>{msg}</div>
    </div>
  )
}
