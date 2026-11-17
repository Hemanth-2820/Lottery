import React, { useEffect, useRef, useState } from 'react'
import { LG } from '../art.js'
import { LIVE, api, setToken } from '../lib/api.js'
import Sphere3D from '../components/Sphere3D.jsx'
import './login.css'

// Murugan design dimensions (941 x 1670)
const A = import.meta.env.BASE_URL ? (import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL + 'art/' : import.meta.env.BASE_URL + '/art/') : '/art/'
const BG = A + 'mg3-bg.webp'
const W = 941, H = 1670
const at = (x, y, w, h) => ({ position: 'absolute', left: (x / W * 100) + '%', top: (y / H * 100) + '%', width: (w / W * 100) + '%', height: (h / H * 100) + '%' })
const mask = e => { const [n, d] = e.split('@'); return n[0] + '***@' + d }

// 4 Outer floating 3D balls (Pink 3, Red 3, Blue 2, Yellow 5)
const FLOAT = [[3, 218, 813, 33, 2.2], [3, 115, 950, 35, 2.8], [2, 728, 812, 33, 2.5], [5, 826, 958, 35, 3]]

// Sparkling magical dust particles
const SPARKLES = [
  { x: '46%', s: '5px', t: '2.5s', dl: '0s', dx: '-15px' },
  { x: '52%', s: '4px', t: '3.1s', dl: '0.4s', dx: '20px' },
  { x: '40%', s: '6px', t: '2.8s', dl: '0.8s', dx: '-30px' },
  { x: '58%', s: '4px', t: '3.4s', dl: '1.2s', dx: '25px' },
  { x: '48%', s: '5px', t: '2.2s', dl: '0.2s', dx: '-10px' },
  { x: '35%', s: '4px', t: '3.0s', dl: '1.5s', dx: '-22px' },
  { x: '62%', s: '5px', t: '2.7s', dl: '0.6s', dx: '18px' },
  { x: '30%', s: '4px', t: '3.2s', dl: '1.0s', dx: '-35px' },
  { x: '68%', s: '6px', t: '2.6s', dl: '1.8s', dx: '30px' },
  { x: '50%', s: '4px', t: '3.5s', dl: '0.3s', dx: '5px' },
]

function Burst({ k }) {
  const ref = useRef()
  useEffect(() => {
    const cv = ref.current; if (!cv) return
    const w = cv.width = Math.round(820 * k), h = cv.height = Math.round(640 * k)
    const g = cv.getContext('2d')
    const cols = ['#ffd23f', '#ff2dd0', '#00e5ff', '#ff5a36', '#ffffff', '#76ff03']
    const pts = Array.from({ length: 70 }, () => {
      const a = Math.random() * Math.PI * 2, sp = (Math.random() * 8 + 3) * k
      return {
        x: w / 2, y: h / 2,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 2 * k,
        r: (Math.random() * 4 + 2) * k,
        c: cols[(Math.random() * cols.length) | 0],
        alpha: 1,
        life: Math.random() * 0.4 + 0.6
      }
    })
    let raf, last = performance.now()
    const loop = now => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      g.clearRect(0, 0, w, h)
      let alive = false
      for (const p of pts) {
        if (p.alpha <= 0) continue
        alive = true
        p.x += p.vx * dt * 60
        p.y += p.vy * dt * 60
        p.vy += 4.5 * k * dt * 60
        p.alpha -= dt / p.life
        g.save()
        g.globalAlpha = Math.max(0, p.alpha)
        g.fillStyle = p.c
        g.shadowColor = p.c
        g.shadowBlur = 8 * k
        g.beginPath()
        g.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        g.fill()
        g.restore()
      }
      if (alive) raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [k])
  return <canvas ref={ref} className="m3-burst" />
}

export default function Login({ onLogin }) {
  const [email, setEmail] = useState(''), [step, setStep] = useState(0)
  const [code, setCode] = useState(''), [otp, setOtp] = useState(''), [state, setState] = useState('')
  const [left, setLeft] = useState(0), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  const otpRef = useRef(), tm = useRef()

  // Fit the picture to the phone screen
  const fit = () => {
    const sw = Math.min(window.innerWidth, 480), sh = window.innerHeight
    let w = sw / 0.92, h = w * H / W
    if (h < sh) h = Math.min(sh, h * 1.12)
    if (h > sh) { const f = sh / h; h = sh; w *= f }
    return { w, h, k: w / W }
  }
  const [box, setBox] = useState(fit)
  useEffect(() => {
    const r = () => setBox(fit())
    window.addEventListener('resize', r)
    return () => window.removeEventListener('resize', r)
  }, [])
  const { k } = box

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
    const good = () => { setState('ok'); otpRef.current?.blur(); setTimeout(() => onLogin(email.trim().toLowerCase()), 1400) }
    const bad = m => { setState('bad'); say(m || 'Wrong code. Try again.'); setTimeout(() => { setOtp(''); setState('') }, 700) }
    if (!LIVE) return v === code ? good() : bad()
    api('verify_otp', { email: email.trim(), code: v }).then(r => { setToken(r.token); good() }, x => bad(x.message))
  }

  return (
    <div id="mg3" style={{ '--k': k }}>
      <div className="m3-fill" style={{ backgroundImage: `url(${BG})` }} />
      <div className="m3-stage" style={{ width: box.w, height: box.h }}>
        <img className="m3-bg" src={BG} alt="Murugan" />
        <div className="m3-halo" style={at(472 - 250, 240, 500, 500)} />
        <div className="m3-plate" style={at(100, 720, 741, 380)} />
        {LG.cards.map((_, i) => (
          <div key={i} className="m3-shine" style={{ ...at(52 + i * 171, 628, 156, 138), '--i': i }} />
        ))}

        {/* Murugan Lucky Draw badge in the middle: soft golden glow pulse */}
        <div className="m3-badge" style={at(230, 750, 480, 340)} />

        {/* 4 Outer Floating 3D Balls */}
        {FLOAT.map(([n, x, y, r, t], i) => (
          <div
            key={i}
            className="m3-fl"
            style={{
              position: 'absolute',
              left: (x / W * 100) + '%',
              top: (y / H * 100) + '%',
              width: ((r * 2) / W * 100) + '%',
              aspectRatio: '1',
              zIndex: 6,
              pointerEvents: 'none',
              transform: 'translate(-50%, -50%)',
              '--i': i,
              '--t': `${t}s`,
            }}
          >
            <Sphere3D n={n} size={r * 2} speed={0.8} dir={i % 2 ? 1 : -1} tilt={0.3} />
          </div>
        ))}

        {/* Magical Sparkles around the machine */}
        <div className="m3-spark" style={{ zIndex: 7 }}>
          {SPARKLES.map((s, i) => (
            <i
              key={i}
              style={{
                '--x': s.x,
                '--s': s.s,
                '--t': s.t,
                '--dl': s.dl,
                '--dx': s.dx,
              }}
            />
          ))}
        </div>

        {step === 0 ? (
          <form onSubmit={send} noValidate style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
            <input
              className="m3-email"
              style={{ ...at(240, 1262, 460, 60), fontSize: Math.max(16, 30 * k) }}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="Enter your email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              aria-label="Email"
            />
            <button className="m3-send" style={at(138, 1360, 662, 88)} disabled={busy} aria-label="Send Code">
              <span>{busy ? 'Sending…' : 'Send Code >'}</span>
            </button>
          </form>
        ) : (
          <div
            className={'m3-ticket' + (state === 'ok' ? ' ok-shake' : '')}
            style={{ ...at(70, 1070, 800, 480), zIndex: 10 }}
          >
            <div className="m3-tk-top">
              <span>LOTTERY TICKET</span>
              <em>VERIFIED</em>
            </div>
            <h3>{state === 'ok' ? 'Lucky Code!' : 'Draw your code'}</h3>
            <p>Sent to <b>{mask(email.trim())}</b> · <button type="button" className="lnk" onClick={() => setStep(0)}>Change</button></p>
            <label className={'m3-otp ' + state}>
              {[0, 1, 2, 3, 4, 5].map(i => (
                <span key={i} className={i === otp.length && state !== 'ok' ? 'cur' : ''} style={{ '--i': i }}>
                  {otp[i] !== undefined && otp[i] !== '' ? (
                    <img src={LG.nums[otp[i]]} alt={otp[i]} />
                  ) : null}
                  <small>{i + 1}</small>
                </span>
              ))}
              <input
                ref={otpRef}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={e => type(e.target.value)}
                aria-label="6-digit code"
              />
            </label>
            {state === 'ok' && <Burst k={k} />}
            {code ? (
              <div className="m3-demo">{LIVE ? 'Test mode' : 'Demo'}: your code is <b>{code}</b></div>
            ) : (
              <div className="m3-demo">Check your email inbox (and Spam) for the code.</div>
            )}
            <div className="m3-tk-foot">
              <small>
                {left > 0 ? (
                  'Send again in 0:' + String(left).padStart(2, '0')
                ) : (
                  <button type="button" className="lnk" onClick={() => send()}>Resend Code</button>
                )}
              </small>
              <div className="m3-bar" />
            </div>
          </div>
        )}
      </div>
      <div className={'toast' + (msg ? ' on' : '')}>{msg}</div>
    </div>
  )
}
