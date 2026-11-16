import React, { useEffect, useRef, useState } from 'react'
import Sphere3D from '../components/Sphere3D.jsx'
import './splash.css'

// Opening screen (about 6.4 s, tap to skip): neon stage, LUCKY DIGITS sign, 3D wheel of your 5 lottery cards
// spins with light effects, the cards splash out, 3 digit balls bounce in, gold coins spin, confetti, then the app.
const BASE = import.meta.env.BASE_URL || '/'
const A = (BASE.endsWith('/') ? BASE.slice(0, -1) : BASE) + '/art/'
const SEG = [['dear', '#e8203a'], ['kerala', '#18b86a'], ['goa', '#1a9be8'], ['sikkim', '#5a3cff'], ['punjab', '#e0279a']]   // your 5 lottery cards
const wheelBg = 'conic-gradient(' + SEG.map(([, c], k) => `${c} ${k * 72}deg ${k * 72 + 72}deg`).join(',') + ')'
const STACKS = [[2, 7, 0], [13, 10, 1], [24, 5, 2], [66, 6, 3], [77, 11, 4], [88, 8, 5]]   // gold coin stacks: [left %, coins, order]

function Confetti() {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current, x = c.getContext('2d'), D = Math.min(devicePixelRatio || 1, 2)
    const W = c.clientWidth, H = c.clientHeight; c.width = W * D; c.height = H * D; x.scale(D, D)
    const cols = ['#ffd23f', '#ff3d5a', '#1fc87e', '#2f8bff', '#ff6ec7', '#fff', '#a05cff'], P = []
    let raf, t0 = 0, fired = false
    const loop = t => {
      if (!t0) t0 = t; const e = (t - t0) / 1000
      if (!fired && e > 3.35) { fired = true
        for (let i = 0; i < 160; i++) { const a = -Math.PI / 2 + (Math.random() - .5) * 2.6, v = 6 + Math.random() * 9
          P.push({ x: W / 2, y: H * .5, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * 6, w: 4 + Math.random() * 5, h: 7 + Math.random() * 7, c: cols[i % cols.length], s: (Math.random() - .5) * .4 }) } }
      x.clearRect(0, 0, W, H)
      for (const p of P) { p.vx *= .985; p.vy = p.vy * .985 + .22; p.x += p.vx; p.y += p.vy; p.r += p.s
        x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.scale(1, Math.cos(e * 8 + p.r)); x.fillStyle = p.c; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); x.restore() }
      if (e < 7) raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={ref} className="s5-conf" />
}

export default function Splash({ onDone }) {
  const [out, setOut] = useState(false)
  const done = () => { if (out) return; setOut(true); setTimeout(onDone, 600) }
  useEffect(() => { const t = setTimeout(done, 6400); return () => clearTimeout(t) }, [])

  return (
    <div id="sp5" className={out ? 'out' : ''} onClick={done}>
      <div className="s5-haze" />
      <div className="s5-spot l" /><div className="s5-spot r" />
      <div className="s5-stars">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ '--x': (i * 53 + 7) % 94 + 3 + '%', '--y': (i * 31 + 11) % 90 + 4 + '%', '--d': (i * .29) % 2.2 + 's' }} />)}</div>
      <div className="s5-beams">{[0, 1, 2, 3, 4, 5].map(i => <i key={i} style={{ '--i': i }} />)}</div>

      <div className="s5-title">
        <svg className="s5-loop" viewBox="0 0 300 90" aria-hidden="true">
          <defs><linearGradient id="s5g" x1="0" x2="1"><stop offset="0" stopColor="#ff2d8a" /><stop offset=".35" stopColor="#ffd23f" /><stop offset=".65" stopColor="#2fe0ff" /><stop offset="1" stopColor="#a05cff" /></linearGradient></defs>
          <path d="M150 45 C 110 5, 30 5, 30 45 C 30 85, 110 85, 150 45 C 190 5, 270 5, 270 45 C 270 85, 190 85, 150 45 Z" />
        </svg>
        <b className="s5-neon">LUCKY DIGITS</b>
        <strong className="s5-sub">Pick 3 · Win Big!</strong>
      </div>

      <div className="s5-halo" />
      <div className="s5-machine">
        <div className="s5-wheel">
          <div className="s5-face" style={{ background: wheelBg }}>
            {SEG.map(([n], k) => <span key={k} style={{ '--a': k * 72 + 36 + 'deg' }}><img src={A + 'lg-card-' + n + '.webp'} alt={n} /></span>)}
          </div>
          <div className="s5-rim">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ '--a': i * 15 + 'deg', '--j': i % 2 }} />)}</div>
          <div className="s5-glare" />
          <div className="s5-pin"><img src={import.meta.env.BASE_URL + 'app-logo.png'} alt="Murugan" /></div>
          <div className="s5-sweep" />
          <div className="s5-sparks">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--a': i * 30 + 'deg' }} />)}</div>
          <div className="s5-white" />
        </div>
        <div className="s5-stand" />
        <div className="s5-base" />
        {STACKS.map(([l, n, o]) => <div key={o} className="s5-stack" style={{ left: l + '%', '--o': o, '--n': n }}>{Array.from({ length: n }, (_, j) => <i key={j} style={{ '--j': j }} />)}<div className="s5-coin"><b className="f">₹</b>{Array.from({ length: 16 }, (_, e) => <u key={e} style={{ '--e': e }} />)}<b className="k">₹</b></div></div>)}
      </div>
      <div className="s5-floor" />
      <div className="s5-balls">{[7, 3, 9].map((n, i) => <div key={i} style={{ '--i': i }}><Sphere3D n={n} size={Math.round(Math.min(innerWidth, 480) * .16)} speed={1.5} dir={i % 2 ? 1 : -1} tilt={.3} /></div>)}</div>
      <div className="s5-cards">{SEG.map(([n], k) => <div key={k} className="s5-c" style={{ '--k': k - 2 }}><img src={A + 'lg-card-' + n + '.webp'} alt={n} /></div>)}</div>

      <Confetti />
      <div className="s5-skip">Tap to skip</div>
    </div>
  )
}
