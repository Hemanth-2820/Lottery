import React, { useEffect, useRef, useState } from 'react'
import { LG } from '../art.js'
import Sphere3D from '../components/Sphere3D.jsx'
import { api, setToken, isLive } from '../lib/api.js'

const mask = e => { const [n, d] = e.split('@'); return n[0] + '***@' + d }
const CARDS = ['Dear', 'Kerala', 'Goa Queen', 'Sikkim', 'Punjab']
// The design picture is 941 x 1062 px. Left and right edge of each lottery card, measured on it
const PW = 941, PH = 1062
const CX = [[22, 193], [205, 375], [388, 560], [572, 740], [750, 918]]
const DUST = [...Array(18)].map((_, i) => ({ '--x': (i * 37 + 11) % 100 + '%', '--s': 2 + (i * 7) % 4 + 'px', '--t': 4 + (i * 13) % 5 + 's', '--dl': -((i * 29) % 80) / 10 + 's', '--dx': (i % 2 ? 1 : -1) * (8 + (i * 5) % 22) + 'px' }))
const touch = () => { try { return matchMedia('(pointer:coarse)').matches } catch { return false } }

export default function Login({ onLogin }) {
  const [email, setEmail] = useState(''), [step, setStep] = useState(0)
  const [code, setCode] = useState(''), [otp, setOtp] = useState(''), [state, setState] = useState('')   // '' | 'bad' | 'ok'
  const [left, setLeft] = useState(0), [kb, setKb] = useState(false), [msg, setMsg] = useState('')
  const otpRef = useRef(), tm = useRef()
  // Phone layout on every device: the picture and the card are one block, 440px wide at most.
  // On short or wide screens the whole block shrinks evenly, so nothing is ever squashed or cut
  const zoomFor = () => { const W = Math.min(window.innerWidth, 440), H = window.innerHeight, need = W * PH / PW + 236; const z = Math.min(1, H / need); return { z, h: H / z } }
  const [zm, setZm] = useState(zoomFor)
  useEffect(() => { const r = () => setZm(zoomFor()); addEventListener('resize', r); return () => removeEventListener('resize', r) }, [])
  // The six balls circle the hourglass on a tilted 3D ring: big and in front on the near side, small and behind the glass on the far side
  const orb = useRef([])
  useEffect(() => {
    let raf; const t0 = performance.now()
    const run = now => {
      const t = (now - t0) / 1000
      orb.current.forEach((el, i) => {
        if (!el) return
        const th = t * 0.55 + i * Math.PI / 3, d = Math.sin(th)          // d: +1 nearest, -1 farthest
        const x = 50 + 33 * Math.cos(th), y = 72 + 9 * d
        const k = 0.62 + 0.48 * (d + 1) / 2
        el.style.left = x + '%'; el.style.top = y + '%'
        el.style.transform = `translate(-50%,-50%) scale(${k})`
        el.style.zIndex = d > 0 ? 4 : 1
        el.style.opacity = d > -0.15 ? 1 : Math.max(0, 1 + (d + 0.15) * 2.4)
        el.style.filter = `brightness(${0.7 + 0.3 * (d + 1) / 2})`
      })
      raf = requestAnimationFrame(run)
    }
    raf = requestAnimationFrame(run); return () => cancelAnimationFrame(raf)
  }, [])
  const say = m => { setMsg(m); clearTimeout(tm.current); tm.current = setTimeout(() => setMsg(''), 2600) }
  useEffect(() => { if (left <= 0) return; const t = setTimeout(() => setLeft(l => l - 1), 1000); return () => clearTimeout(t) }, [left])

  const send = async e => {
    if (e) e.preventDefault()
    const em = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return say('Enter a valid email address')
    if (isLive) {
      try {
        const res = await api('send_otp', { email: em })
        setCode(res.dev_code || '')
        setOtp(''); setState(''); setLeft(30); setStep(1)
        say('Code sent to ' + mask(em))
        setTimeout(() => otpRef.current?.focus(), 800)
      } catch (err) {
        say(err.message || 'Could not send code')
      }
    } else {
      setCode(String(Math.floor(100000 + Math.random() * 900000))); setOtp(''); setState(''); setLeft(30); setStep(1)
      say('Code sent to ' + mask(em)); setTimeout(() => otpRef.current?.focus(), 800)
    }
  }
  const type = async v => {
    if (state === 'ok') return
    v = v.replace(/\D/g, '').slice(0, 6); setOtp(v); setState('')
    if (v.length < 6) return
    if (isLive) {
      try {
        const res = await api('verify_otp', { email: email.trim().toLowerCase(), code: v })
        if (res.token) setToken(res.token)
        setState('ok'); otpRef.current?.blur()
        setTimeout(() => onLogin(email.trim().toLowerCase()), 1600)
      } catch (err) {
        setState('bad'); say(err.message || 'Wrong code. Try again.')
        setTimeout(() => { setOtp(''); setState('') }, 700)
      }
    } else {
      if (v === code) { setState('ok'); otpRef.current?.blur(); setTimeout(() => onLogin(email.trim().toLowerCase()), 1600) }
      else { setState('bad'); say('Wrong code. Try again.'); setTimeout(() => { setOtp(''); setState('') }, 700) }
    }
  }

  return (
    <div id="login" className={(kb ? 'kb ' : '') + (state === 'ok' ? 'done' : '')}>
      <div className="lg-bg" /><img className="lg-fill" src={LG.top} alt="" />
      <div className="lg-stage" style={{ zoom: zm.z, height: zm.h }}>
      {/* the whole design picture; everything on it is placed in % of the picture, so it always lines up */}
      <div className="lg-pic" style={{ position: 'relative', width: '100%', aspectRatio: PW + ' / ' + PH, flex: 'none' }}>
        <img className="lg-shot" src={LG.top} alt="Lucky3. Play, Pick, Win Big" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }} />
        <div className="lg-glow" />
        <div className="lg-dust">{DUST.map((s, i) => <span key={i} style={s} />)}</div>
        {CARDS.map((c, i) => <button key={c} type="button" className="lg-cd" style={{ '--i': i, position: 'absolute', top: 278 / PH * 100 + '%', height: 144 / PH * 100 + '%', left: CX[i][0] / PW * 100 + '%', width: (CX[i][1] - CX[i][0]) / PW * 100 + '%' }} onClick={() => say('Sign in to play ' + c + ' Lottery')}><img src={LG.cards[i]} alt={c + ' Lottery'} /></button>)}
        <div className="lg-track bk" /><div className="lg-track fr" />
        <img className="lg-front" src={LG.front} alt="" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }} />
        {[4, 2, 9, 0, 5, 6].map((n, i) => <div key={i} ref={el => (orb.current[i] = el)} className="lg-orb"><Sphere3D n={n} size={46} speed={0.7 + (i % 3) * 0.15} dir={-1} tilt={0.25} /></div>)}
      </div>
      <div className="lg-gap" />

      <div className="lg-flip">
        <img className="lg-wel" src={LG.welcome} alt="Welcome" />
        <div className={'lg-card' + (step ? ' back' : '')}>
          <form className="lg-face" onSubmit={send} noValidate>
            <p>Sign in with your email. We will send you a 6-digit code.</p>
            <label className="lg-in" htmlFor="login-email">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="M3.5 7l8.5 6 8.5-6M3.5 17.5l6-5M20.5 17.5l-6-5" /></svg>
              <input id="login-email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} onFocus={() => setKb(touch())} onBlur={() => setKb(false)} />
            </label>
            <button className="lg-go">Send Code <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg></button>
            <small>By continuing you confirm you are 18 or older.</small>
          </form>
          <div className="lg-face lg-back">
            <p>{state === 'ok' ? 'Code matched. Opening Lucky3…' : <>Code sent to <b>{email.includes('@') ? mask(email.trim()) : ''}</b> · <button type="button" className="lnk" onClick={() => setStep(0)}>Change</button></>}</p>
            <label className={'lg-otp ' + state} htmlFor="login-otp">
              {[0, 1, 2, 3, 4, 5].map(i => <span key={i} className={'os' + (i === otp.length && state !== 'ok' ? ' cur' : '')}>{otp[i] !== undefined && <img key={otp[i] + i} src={LG.nums[otp[i]]} alt="" />}</span>)}
              <input id="login-otp" ref={otpRef} inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-label="6-digit code" value={otp} onChange={e => type(e.target.value)} onFocus={() => setKb(touch())} onBlur={() => setKb(false)} />
            </label>
            {isLive ? (
              code ? (
                <div className="lg-demo">Test mode: your code is <b>{code}</b>. The email was also sent.</div>
              ) : (
                <div className="lg-demo">Check your email inbox (and Spam) for your code.</div>
              )
            ) : (
              <div className="lg-demo">Demo: your code is <b>{code}</b>. In the real app it arrives by email.</div>
            )}
            <div className="lg-re">{left > 0 ? 'Send again in 0:' + String(left).padStart(2, '0') : <button type="button" className="lnk" onClick={() => send()}>Send the code again</button>}</div>
          </div>
        </div>
      </div>
      </div>
      <div className={'toast' + (msg ? ' on' : '')}>{msg}</div>
    </div>
  )
}
