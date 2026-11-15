import { useEffect, useRef } from 'react'
import { BALLS } from '../art.js'

// Balls popping inside the machine plus gold dust, drawn on a canvas over the machine picture.
// mixRef.current is the blower strength (0.5 idle, about 2.5 while drawing). Returns burst() for a shower of sparks.
export default function useMachine(cvRef, mixRef) {
  const burstRef = useRef(() => {})
  useEffect(() => {
    const cv = cvRef.current; if (!cv) return
    const c = cv.getContext('2d'), imgs = BALLS.map(([, src]) => { const im = new Image(); im.src = src; return im })
    const R = 76, CY = 186, FL = 18, br = 13
    const nd = init => ({ x: (Math.random() - .5) * 310, y: init ? Math.random() * 340 : 345, s: Math.random() * 1.6 + .5, v: Math.random() * .5 + .15, p: Math.random() * 6 })
    const bs = [...Array(7)].map((_, i) => ({ x: (i - 3) * 17, y: FL - br, vx: 0, vy: 0, n: [2, 5, 9, 0, 6, 4, 8][i], a: Math.random() * 6 }))
    let dust = [...Array(36)].map(() => nd(true)), cw = 0, dpr = 1, raf
    burstRef.current = () => { for (let i = 0; i < 46; i++) dust.push({ x: (Math.random() - .5) * 110, y: CY + (Math.random() - .5) * 90, s: Math.random() * 2.2 + 1, v: Math.random() * 2.4 + .6, p: Math.random() * 6, vx: (Math.random() - .5) * 7, life: 1 }) }
    const frame = () => {
      raf = requestAnimationFrame(frame)
      const mix = mixRef.current, w = cv.clientWidth || 360
      if (w !== cw) { cw = w; dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = w * dpr; cv.height = 352 * dpr }
      c.setTransform(dpr, 0, 0, dpr, w / 2 * dpr, 0); c.clearRect(-w / 2, 0, w, 352)
      for (const b of bs) {
        b.vy += .28
        if (b.y >= FL - br - .5 && Math.random() < .012 + .06 * mix) { b.vy = -(3.5 + Math.random() * 4 + mix * 1.6); b.vx = (Math.random() - .5) * 5 }
        b.x += b.vx; b.y += b.vy; b.a += b.vx * .07; b.vx *= .992
        if (b.y > FL - br) { b.y = FL - br; b.vy *= -.35; b.vx *= .8; if (Math.abs(b.vy) < .6) b.vy = 0 }
        const d = Math.hypot(b.x, b.y), m = R - br
        if (d > m) { const nx = b.x / d, ny = b.y / d; b.x = nx * m; b.y = ny * m; const vn = b.vx * nx + b.vy * ny; if (vn > 0) { b.vx -= 1.7 * vn * nx; b.vy -= 1.7 * vn * ny } }
      }
      for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i], b = bs[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || .01
        if (d < 2 * br) {
          const nx = dx / d, ny = dy / d, o = (2 * br - d) / 2; a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o
          const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
          if (rv < 0) { a.vx += rv * nx * .9; a.vy += rv * ny * .9; b.vx -= rv * nx * .9; b.vy -= rv * ny * .9 }
        }
      }
      for (const b of bs) { const im = imgs[b.n]; c.save(); c.translate(b.x, CY + b.y); c.rotate(b.a); if (im.complete && im.naturalWidth) c.drawImage(im, -br, -br, br * 2, br * 2); c.restore() }
      c.globalCompositeOperation = 'lighter'
      dust = dust.filter(d => {
        d.y -= d.v; d.p += .08
        if (d.vx) { d.x += d.vx; d.vx *= .95; d.life -= .018; if (d.life <= 0) return false } else if (d.y < 8) Object.assign(d, nd())
        c.fillStyle = `rgba(255,${200 + Math.sin(d.p) * 40 | 0},120,${(.4 + .45 * Math.sin(d.p)) * (d.life || 1)})`
        c.beginPath(); c.arc(d.x, d.y, d.s, 0, 7); c.fill(); return true
      })
      c.globalCompositeOperation = 'source-over'
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [cvRef, mixRef])
  return () => burstRef.current()
}