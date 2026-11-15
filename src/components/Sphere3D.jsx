import React, { useEffect, useRef } from 'react'

// A real 3D lottery ball drawn pixel by pixel: it spins a full 360° and the number travels round the sphere.
const COL = ['#e8132b', '#ffbf00', '#1f5bff', '#16b23c', '#8a2be2', '#ff6a00', '#00b8e6', '#ff1f8e', '#f5a100', '#2346ff']
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))

function numberMap(n) {
  const S = 96, c = document.createElement('canvas'); c.width = c.height = S
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, S, S)
  g.fillStyle = '#111'; g.font = '900 78px Poppins, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, S / 2, S / 2 + 4)
  return g.getImageData(0, 0, S, S).data
}

export default function Sphere3D({ n, size = 56, speed = 1, tilt = 0.32, dir = 1 }) {
  const ref = useRef()
  useEffect(() => {
    const cv = ref.current, R = Math.round(size * Math.min(2, window.devicePixelRatio || 1)), D = R
    cv.width = cv.height = D
    const g = cv.getContext('2d'), img = g.createImageData(D, D), px = img.data, num = numberMap(n), base = hex(COL[n])
    const L = [-0.45, -0.55, 0.7], ln = Math.hypot(...L); L[0] /= ln; L[1] /= ln; L[2] /= ln
    const H = [L[0], L[1], L[2] + 1], hl = Math.hypot(...H); H[0] /= hl; H[1] /= hl; H[2] /= hl
    const ct = Math.cos(tilt), st = Math.sin(tilt), PATCH = 0.6
    let raf, t0 = performance.now()
    const draw = now => {
      const a = ((now - t0) / 1000) * speed * dir * 1.6, ca = Math.cos(a), sa = Math.sin(a)
      for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
        const i = (y * D + x) * 4, nx = (x + .5) / D * 2 - 1, ny = (y + .5) / D * 2 - 1, r2 = nx * nx + ny * ny
        if (r2 > 1) { px[i + 3] = 0; continue }
        const nz = Math.sqrt(1 - r2)
        // undo the tilt, then the spin, to find which point of the ball faces us
        let y1 = ny * ct - nz * st, z1 = ny * st + nz * ct
        const x2 = nx * ca + z1 * sa, z2 = -nx * sa + z1 * ca
        let c = base
        // white number patch on the front (+z) and back (-z) of the ball
        const az = Math.abs(z2)
        if (az > Math.cos(PATCH)) {
          const s = z2 > 0 ? 1 : -1, u = (x2 * s) / Math.sin(PATCH), v = y1 / Math.sin(PATCH)
          const tx = Math.min(95, Math.max(0, ((u + 1) / 2 * 96) | 0)), ty = Math.min(95, Math.max(0, ((v + 1) / 2 * 96) | 0)), k = (ty * 96 + tx) * 4
          c = [num[k], num[k + 1], num[k + 2]]
          if (az < Math.cos(PATCH) + 0.03) c = [(c[0] + base[0]) / 2, (c[1] + base[1]) / 2, (c[2] + base[2]) / 2]
        }
        const dif = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2])
        const nh = Math.max(0, nx * H[0] + ny * H[1] + nz * H[2])
        const spec = Math.pow(nh, 90) * 1.1 + Math.pow(nh, 12) * 0.22
        const sh = 0.22 + 0.95 * Math.pow(dif, 0.9), fres = Math.pow(1 - nz, 2.5)
        const rim = fres * (ny > 0 ? 0.55 : 0.15)
        const edge = Math.min(1, (1 - Math.sqrt(r2)) * D * 0.5)
        px[i] = Math.min(255, c[0] * sh + 255 * spec + (base[0] * .5 + 128) * rim)
        px[i + 1] = Math.min(255, c[1] * sh + 255 * spec + (base[1] * .5 + 128) * rim)
        px[i + 2] = Math.min(255, c[2] * sh + 255 * spec + (base[2] * .5 + 128) * rim)
        px[i + 3] = 255 * edge
      }
      g.putImageData(img, 0, 0); raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [n, size, speed, tilt, dir])
  return <canvas ref={ref} className="sph" style={{ width: '100%', height: '100%' }} />
}
