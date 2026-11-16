import React, { useEffect, useRef, useState } from 'react'
import { LG } from '../art.js'
import { LIVE, api, setToken } from '../lib/api.js'

// Murugan design dimensions (941 x 1670)
const A = import.meta.env.BASE_URL + 'art/'
const BG = A + 'mg3-bg.webp'
const W = 941, H = 1670
const at = (x, y, w, h) => ({ position: 'absolute', left: (x / W * 100) + '%', top: (y / H * 100) + '%', width: (w / W * 100) + '%', height: (h / H * 100) + '%' })
const mask = e => { const [n, d] = e.split('@'); return n[0] + '***@' + d }

// Glass bowl center & rolling balls (9 colorful 3D lottery balls tumbling inside the dome)
const BCX = 472, BCY = 938
const BOWL_BALLS = [
  { n: 1, x: -28, y: -20, vx: 26, vy: -15, rot: 0 },
  { n: 3, x: 18, y: -38, vx: -22, vy: 30, rot: 45 },
  { n: 8, x: -44, y: 15, vx: 32, vy: 12, rot: 90 },
  { n: 3, x: 26, y: 32, vx: -30, vy: -20, rot: 135 },
  { n: 9, x: 42, y: -10, vx: 18, vy: 35, rot: 180 },
  { n: 7, x: -18, y: 46, vx: 22, vy: -28, rot: 225 },
  { n: 0, x: 0, y: 2, vx: -25, vy: 18, rot: 270 },
  { n: 5, x: -48, y: -28, vx: 28, vy: 14, rot: 315 },
  { n: 2, x: 44, y: 36, vx: -18, vy: -22, rot: 60 },
]

// 4 Outer floating 3D balls (Pink 3, Red 3, Blue 2, Yellow 5)
const OUTER_BALLS = [
  { n: 3, x: 124, y: 963, size: 76, speed: 0.8, phase: 0 },
  { n: 3, x: 281, y: 820, size: 68, speed: 0.6, phase: 1.5 },
  { n: 2, x: 734, y: 815, size: 68, speed: 0.7, phase: 3.1 },
  { n: 5, x: 843, y: 1003, size: 76, speed: 0.9, phase: 4.5 },
]

// Sparkling magical dust particles
const SPARKLES = [
  { left: '46%', top: '52%', size: '5px', dur: '2.5', delay: '0' },
  { left: '52%', top: '50%', size: '4px', dur: '3.1', delay: '0.4' },
  { left: '40%', top: '56%', size: '6px', dur: '2.8', delay: '0.8' },
  { left: '58%', top: '58%', size: '4px', dur: '3.4', delay: '1.2' },
  { left: '48%', top: '61%', size: '5px', dur: '2.2', delay: '0.2' },
  { left: '35%', top: '51%', size: '4px', dur: '3.0', delay: '1.5' },
  { left: '62%', top: '53%', size: '5px', dur: '2.7', delay: '0.6' },
  { left: '30%', top: '48%', size: '4px', dur: '3.2', delay: '1.0' },
  { left: '68%', top: '49%', size: '6px', dur: '2.6', delay: '1.8' },
  { left: '50%', top: '46%', size: '4px', dur: '3.5', delay: '0.3' },
]

export default function Login({ onLogin }) {
  const [email, setEmail] = useState(''), [step, setStep] = useState(0)
  const [code, setCode] = useState(''), [otp, setOtp] = useState(''), [state, setState] = useState('')
  const [left, setLeft] = useState(0), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  const otpRef = useRef(), tm = useRef()
  const bowlRefs = useRef([]), outerRefs = useRef([])

  // Fit the picture to the phone screen
  const fit = () => {
    const sw = Math.min(window.innerWidth, 480), sh = window.innerHeight
    let w = sw / 0.92, h = w * H / W
    if (h < sh) h = Math.min(sh, h * 1.12)
    if (h > sh) { const f = sh / h; h = sh; w *= f }
    return { w, h, k: w / W }
  }
  const [box, setBox] = useState(fit), k = box.k
  useEffect(() => { const r = () => setBox(fit()); addEventListener('resize', r); return () => removeEventListener('resize', r) }, [])

  // Rolling balls physics loop inside the glass bowl
  useEffect(() => {
    let raf, last = performance.now()
    const balls = BOWL_BALLS.map(b => ({ ...b }))
    const maxR = 118 - 26

    const loop = now => {
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      const t = now / 1000

      for (let i = 0; i < balls.length; i++) {
        const b = balls[i]
        // Swirling vortex inside the bowl
        const ang = Math.atan2(b.y, b.x)
        b.vx += -Math.sin(ang) * 90 * dt
        b.vy += Math.cos(ang) * 90 * dt

        // Central upward blower impulse
        if (b.y > 10 && Math.abs(b.x) < 55) {
          b.vy -= 180 * dt
        }

        // Gravity
        b.vy += 85 * dt

        // Move
        b.x += b.vx * dt
        b.y += b.vy * dt
        b.rot = (b.rot + b.vx * 1.5 * dt) % 360

        // Bowl spherical boundary bounce
        const dist = Math.hypot(b.x, b.y)
        if (dist > maxR) {
          const nx = b.x / dist, ny = b.y / dist
          b.x = nx * maxR
          b.y = ny * maxR
          const dot = b.vx * nx + b.vy * ny
          if (dot > 0) {
            b.vx -= 1.8 * dot * nx
            b.vy -= 1.8 * dot * ny
          }
        }

        b.vx *= 0.994
        b.vy *= 0.994
      }

      // Ball-to-ball soft repulsion
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const b1 = balls[i], b2 = balls[j]
          const dx = b2.x - b1.x, dy = b2.y - b1.y
          const d = Math.hypot(dx, dy)
          const minDist = 48
          if (d < minDist && d > 0.1) {
            const nx = dx / d, ny = dy / d
            const overlap = (minDist - d) * 0.5
            b1.x -= nx * overlap; b1.y -= ny * overlap
            b2.x += nx * overlap; b2.y += ny * overlap
            const rV = (b2.vx - b1.vx) * nx + (b2.vy - b1.vy) * ny
            if (rV < 0) {
              const imp = rV * 0.85
              b1.vx += imp * nx; b1.vy += imp * ny
              b2.vx -= imp * nx; b2.vy -= imp * ny
            }
          }
        }
      }

      // Update bowl ball DOM positions
      for (let i = 0; i < balls.length; i++) {
        const el = bowlRefs.current[i]
        if (el) {
          const b = balls[i]
          el.style.left = ((BCX + b.x) / W * 100) + '%'
          el.style.top = ((BCY + b.y) / H * 100) + '%'
          el.style.transform = `translate(-50%, -50%) rotate(${b.rot}deg)`
        }
      }

      // Update outer floating balls with gentle wave motion
      for (let i = 0; i < OUTER_BALLS.length; i++) {
        const el = outerRefs.current[i]
        if (el) {
          const ob = OUTER_BALLS[i]
          const dy = Math.sin(t * 1.6 + ob.phase) * 8
          const dx = Math.cos(t * 1.2 + ob.phase) * 4
          el.style.left = ((ob.x + dx) / W * 100) + '%'
          el.style.top = ((ob.y + dy) / H * 100) + '%'
        }
      }

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

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

        {/* 1. Rolling 3D Balls inside the glass bowl */}
        {BOWL_BALLS.map((b, i) => (
          <div
            key={i}
            ref={el => (bowlRefs.current[i] = el)}
            style={{
              position: 'absolute',
              left: ((BCX + b.x) / W * 100) + '%',
              top: ((BCY + b.y) / H * 100) + '%',
              width: (52 / W * 100) + '%',
              aspectRatio: '1',
              zIndex: 4,
              pointerEvents: 'none',
              transform: `translate(-50%, -50%) rotate(${b.rot}deg)`,
              filter: 'drop-shadow(0 5px 10px rgba(0,0,0,0.55))',
              willChange: 'transform, left, top',
            }}
          >
            <img
              src={LG.nums[b.n]}
              alt={`Ball ${b.n}`}
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />
          </div>
        ))}

        {/* 2. Glass dome reflection highlight over the rolling balls */}
        <div
          className="mg-dome-glass"
          style={{
            ...at(BCX - 118, BCY - 118, 236, 236),
            borderRadius: '50%',
            pointerEvents: 'none',
            zIndex: 5,
            background: 'radial-gradient(circle at 35% 25%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.12) 40%, transparent 62%), radial-gradient(circle at 50% 50%, transparent 70%, rgba(255,215,0,0.25) 92%, rgba(255,215,0,0.5) 100%)',
            boxShadow: 'inset 0 0 22px rgba(255,215,0,0.35)',
          }}
        />

        {/* 3. Outer Floating 3D Balls */}
        {OUTER_BALLS.map((ob, i) => (
          <div
            key={i}
            ref={el => (outerRefs.current[i] = el)}
            style={{
              position: 'absolute',
              left: (ob.x / W * 100) + '%',
              top: (ob.y / H * 100) + '%',
              width: (ob.size / W * 100) + '%',
              aspectRatio: '1',
              zIndex: 6,
              pointerEvents: 'none',
              transform: 'translate(-50%, -50%)',
              filter: 'drop-shadow(0 8px 18px rgba(0,0,0,0.65)) drop-shadow(0 0 14px rgba(255,215,0,0.45))',
              willChange: 'transform, left, top',
            }}
          >
            <img
              src={LG.nums[ob.n]}
              alt={`Floating Ball ${ob.n}`}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
                animation: `mgfloat ${3.2 + i * 0.5}s ease-in-out ${i * 0.3}s infinite alternate`,
              }}
            />
          </div>
        ))}

        {/* 4. Magical Sparkles around the machine */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 7 }}>
          {SPARKLES.map((s, i) => (
            <span
              key={i}
              style={{
                position: 'absolute',
                left: s.left,
                top: s.top,
                width: s.size,
                height: s.size,
                borderRadius: '50%',
                background: '#ffe882',
                boxShadow: '0 0 8px 2px rgba(255,215,0,0.9)',
                animation: `mgsparkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
              }}
            />
          ))}
        </div>

        {step === 0 ? (
          <form onSubmit={send} noValidate style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
            <input className="mg-email" style={{ ...at(240, 1262, 560, 60), fontSize: 30 * k }} type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} aria-label="Email" />
            <button className="mg-send" style={at(138, 1360, 662, 88)} disabled={busy} aria-label="Send Code">{busy && <span style={{ fontSize: 34 * k }}>Sending…</span>}</button>
          </form>
        ) : (
          <div className="mg-code" style={{ ...at(70, 1095, 800, 440), fontSize: 26 * k, zIndex: 10 }}>
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
