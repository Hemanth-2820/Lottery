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

// Glass bowl center & rolling balls (9 colorful balls tumbling inside the lotto dome)
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
  const bowlRefs = useRef([]), outerRefs = useRef([])
  const ROLL = useRef(BOWL_BALLS.map(() => ({ a: 0 }))).current

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
        ROLL[i].a += (Math.hypot(b.vx, b.vy) * 0.8 + 60) * 0.015 * dt

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
            b1.x -= nx * overlap * 0.5
            b1.y -= ny * overlap * 0.5
            b2.x += nx * overlap * 0.5
            b2.y += ny * overlap * 0.5
            const dvx = b2.vx - b1.vx, dvy = b2.vy - b1.vy
            const p = 2 * (nx * dvx + ny * dvy) / 2
            b1.vx += p * nx * 0.8
            b1.vy += p * ny * 0.8
            b2.vx -= p * nx * 0.8
            b2.vy -= p * ny * 0.8
          }
        }
      }

      // Update bowl ball DOM positions inside the bowl
      for (let i = 0; i < balls.length; i++) {
        const el = bowlRefs.current[i]
        if (el) {
          const b = balls[i]
          el.style.left = ((118 + b.x) / 236 * 100) + '%'
          el.style.top = ((118 + b.y) / 236 * 100) + '%'
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
        <div className="m3-halo" style={at(BCX - 250, 240, 500, 500)} />
        <div className="m3-plate" style={at(100, 720, 741, 380)} />
        {LG.cards.map((_, i) => (
          <div key={i} className="m3-shine" style={{ ...at(52 + i * 171, 628, 156, 138), '--i': i }} />
        ))}

        {/* 1. Rolling 3D Balls inside the glass bowl */}
        <div className="m3-bowl" style={at(BCX - 118, BCY - 118, 236, 236)}>
          {BOWL_BALLS.map((b, i) => (
            <div
              key={i}
              ref={el => (bowlRefs.current[i] = el)}
              className="m3-bb"
              style={{
                left: ((118 + b.x) / 236 * 100) + '%',
                top: ((118 + b.y) / 236 * 100) + '%',
                filter: 'drop-shadow(0 5px 10px rgba(0,0,0,0.55))',
                willChange: 'left, top',
              }}
            >
              <Sphere3D n={b.n} size={48} roll={ROLL[i]} />
            </div>
          ))}
        </div>

        {/* 2. Glass dome reflection highlight over the rolling balls */}
        <div
          className="m3-glass"
          style={{
            ...at(BCX - 118, BCY - 118, 236, 236),
            pointerEvents: 'none',
            zIndex: 5,
          }}
        />
        <div
          className="m3-ring"
          style={{
            ...at(BCX - 140, BCY - 140, 280, 280),
            pointerEvents: 'none',
            zIndex: 5,
          }}
        />

        {/* 3. Outer Floating 3D Balls */}
        {OUTER_BALLS.map((ob, i) => (
          <div
            key={i}
            ref={el => (outerRefs.current[i] = el)}
            className="m3-fl"
            style={{
              position: 'absolute',
              left: (ob.x / W * 100) + '%',
              top: (ob.y / H * 100) + '%',
              width: (ob.size / W * 100) + '%',
              aspectRatio: '1',
              zIndex: 6,
              pointerEvents: 'none',
              transform: 'translate(-50%, -50%)',
              '--i': i,
              '--t': `${3.2 + i * 0.5}s`,
            }}
          >
            <Sphere3D n={ob.n} size={ob.size} speed={ob.speed} dir={i % 2 ? 1 : -1} tilt={0.3} />
          </div>
        ))}

        {/* 4. Magical Sparkles around the machine */}
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
            <div className="m3-runner" style={at(210, 1248, 520, 84)} />
            <div className="m3-mini" style={at(220, 1256, 500, 68)}>
              <i style={{ '--d': '0s' }} />
              <i style={{ '--d': '-2s' }} />
              <i style={{ '--d': '-4s' }} />
            </div>
            <input
              className="m3-email"
              style={{ ...at(240, 1262, 460, 60), fontSize: Math.max(16, 30 * k) }}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
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
