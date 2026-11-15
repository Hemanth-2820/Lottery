import React from 'react'

// A digit 0-9 with no colour uses the ball artwork; anything else ('?', '✓') is drawn in CSS with the given colour.
export default function Ball({ n, size, color, cls = '', style }) {
  if (!color && n !== '' && +n >= 0 && +n < 10)
    return <i className={`b im d${+n} ${cls}`} style={{ '--s': size + 'px', ...style }} />
  const c = color || ['#8d86a8', '#3a3358', '#15102a']
  return <i className={`b ${cls}`} style={{ '--s': size + 'px', '--a': c[0], '--m': c[1], '--d': c[2], ...style }}><u>{n}</u></i>
}

// same ball as an HTML string, for the flying-ball animation
export const ballHTML = (n, s) => `<i class="b im d${n}" style="--s:${s}px"></i>`

// animate a ball from one element to another along an arc
export function fly(html, from, to, sc = 1, dur = 520) {
  if (!from || !to) return Promise.resolve()
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect(), f = document.createElement('div')
  f.className = 'fly'; f.innerHTML = html; document.body.appendChild(f)
  const w = f.firstChild.offsetWidth / 2, x0 = a.left + a.width / 2 - w, y0 = a.top + a.height / 2 - w, x1 = b.left + b.width / 2 - w, y1 = b.top + b.height / 2 - w
  const an = f.animate([
    { transform: `translate(${x0}px,${y0}px)` },
    { transform: `translate(${(x0 + x1) / 2}px,${Math.min(y0, y1) - 70}px) scale(1.25) rotate(180deg)`, offset: .5 },
    { transform: `translate(${x1}px,${y1}px) scale(${sc}) rotate(360deg)` },
  ], { duration: dur, easing: 'cubic-bezier(.4,0,.6,1)' })
  return new Promise(r => { an.onfinish = () => { f.remove(); r() } })
}