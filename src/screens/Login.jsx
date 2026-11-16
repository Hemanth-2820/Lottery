import React, { useEffect, useRef, useState } from 'react'
import { LG } from '../art.js'
import { LIVE, api, setToken } from '../lib/api.js'

// The whole screen is the Murugan design picture (941 x 1672). The email box and the Send Code
// button are real controls placed exactly on top of the ones drawn in the picture.
const A = import.meta.env.BASE_URL + 'art/'
const BG = A + 'mg3-bg.webp'
const W = 941, H = 1672
const at = (x, y, w, h) => ({ position: 'absolute', left: x / W * 100 + '%', top: y / H * 100 + '%', width: w / W * 100 + '%', height: h / H * 100 + '%' })
const mask = e => { const [n, d] = e.split('@'); return n[0] + '***@' + d }

export default function Login({ onLogin }) {
  const [email, setEmail] = useState(''), [step, setStep] = useState(0)
  const [code, setCode] = useState(''), [otp, setOtp] = useState(''), [state, setState] = useState('')
  const [left, setLeft] = useState(0), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  const otpRef = useRef(), tm = useRef()

  // Fill the whole phone screen: the picture is 4% wider than the screen on each side (only empty
  // edges are cut) and may stretch up to 12% taller, so it covers tall phones without visible distortion.
  const fit = () => {
    const sw = Math.min(window.innerWidth, 480), sh = window.innerHeight
    let w = sw / 0.92, h = w * H / W
    if (h < sh) h = Math.min(sh, h * 1.12)
    if (h > sh) { const f = sh / h; h = sh; w *= f }
    return { w, h, k: w / W }
  }
  const [box, setBox] = useState(fit), k = box.k
  useEffect(() => { const r = () => setBox(fit()); addEventListener('resize', r); return () => removeEventListener('resize', r) }, [])

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
    const good = () => { setState('ok'); otpRef.current?.blur(); setTimeout(() => onLogin(email.trim().toLowerCase()), 1200) }
    const bad = m => { setState('bad'); say(m || 'Wrong code. Try again.'); setTimeout(() => { setOtp(''); setState('') }, 700) }
    if (!LIVE) return v === code ? good() : bad()
    api('verify_otp', { email: email.trim(), code: v }).then(r => { setToken(r.token); good() }, x => bad(x.message))
  }

  return (
    <div id="mglogin">
      <div className="mg-fill" style={{ backgroundImage: `url(${BG})` }} />
      <div className="mg-stage" style={{ width: box.w, height: box.h }}>
        <img className="mg-bg" src={BG} alt="Murugan" />
        <div className="mg-glow" />
        {LG.cards.map((_, i) => <div key={i} className="mg-shine" style={{ ...at(52 + i * 171, 628, 156, 138), '--i': i }} />)}

        {step === 0 ? (
          <form onSubmit={send} noValidate>
            <input className="mg-email" style={{ ...at(240, 1262, 560, 60), fontSize: 30 * k }} type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} aria-label="Email" />
            <button className="mg-send" style={at(138, 1360, 662, 88)} disabled={busy} aria-label="Send Code">{busy && <span style={{ fontSize: 34 * k }}>Sending…</span>}</button>
          </form>
        ) : (
          <div className="mg-code" style={{ ...at(70, 1095, 800, 440), fontSize: 26 * k }}>
            <h3 style={{ fontSize: 56 * k }}>{state === 'ok' ? 'Welcome!' : 'Enter the code'}</h3>
            <p>Sent to <b>{mask(email.trim())}</b> · <button type="button" className="lnk" onClick={() => setStep(0)}>Change</button></p>
            <label className={'mg-otp ' + state}>
              {[0, 1, 2, 3, 4, 5].map(i => (
                <span key={i} className={i === otp.length && state !== 'ok' ? 'cur' : ''} style={{ fontSize: 44 * k }}>
                  {otp[i] !== undefined && otp[i] !== '' ? (
                    <img src={LG.nums[otp[i]]} alt={otp[i]} style={{ width: '85%', height: '85%', objectFit: 'contain' }} />
                  ) : ''}
                </span>
              ))}
              <input ref={otpRef} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={e => type(e.target.value)} aria-label="6-digit code" />
            </label>
            {code ? <div className="mg-demo">{LIVE ? 'Test mode' : 'Demo'}: your code is <b>{code}</b></div> : <div className="mg-demo">Check your email inbox (and Spam) for the code.</div>}
            <div>{left > 0 ? 'Send again in 0:' + String(left).padStart(2, '0') : <button type="button" className="lnk" onClick={() => send()}>Send the code again</button>}</div>
          </div>
        )}
      </div>
      <div className={'toast' + (msg ? ' on' : '')}>{msg}</div>
    </div>
  )
}
