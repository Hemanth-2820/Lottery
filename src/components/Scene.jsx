import React from 'react'

// Animated place scene for each lottery card, drawn on top of the live sky.
// Dear = Nagaland hills with a flying hornbill, Kerala = backwaters with a houseboat and palms,
// Punjab = Golden Temple shining in its pool, Sikkim = Himalaya snow peaks with prayer flags,
// Goa = beach with rolling waves, palm and a fishing boat.
const D = '#140a2e'   // silhouette colour
const Palm = ({ x, y, s = 1, flip }) => (
  <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
    <path d="M0 0 C 2 -12, 1 -24, 6 -34" stroke={D} strokeWidth="2.4" fill="none" strokeLinecap="round" />
    <g className="sw" style={{ transformOrigin: '6px -34px' }}>
      <path d="M6 -34 q-9 -6 -18 2 M6 -34 q-7 -9 -15 -8 M6 -34 q9 -6 18 2 M6 -34 q7 -9 15 -8 M6 -34 q-2 -8 -1 -11 M6 -34 q-10 -1 -14 8 M6 -34 q10 -1 14 8" stroke={D} strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </g>
  </g>
)

const SCENES = {
  Kerala: (
    <>
      <path d="M0 62 Q 30 52 60 58 T 120 56 T 200 58 V70 H0Z" fill={D} opacity=".55" />
      <rect y="66" width="200" height="34" fill="#0b4f6b" opacity=".55" />
      <g className="shim">{[72, 79, 86, 93].map((y, i) => <path key={i} d={`M${10 + i * 23} ${y} h18 M${90 + i * 17} ${y + 2} h12 M${150 - i * 9} ${y} h16`} stroke="#bff" strokeOpacity=".45" strokeWidth=".8" />)}</g>
      <g className="boat"><path d="M0 0 h34 l-4 6 h-26z" fill={D} /><path d="M5 0 q12 -10 24 0z" fill="#6b3a12" /><path d="M9 -2 h16" stroke="#ffcf6a" strokeWidth="1" /></g>
      <Palm x={10} y={70} s={.8} /><Palm x={190} y={70} s={.75} flip />
    </>
  ),
  Goa: (
    <>
      <rect y="58" width="200" height="42" fill="#0a6c8f" opacity=".5" />
      <g className="wv"><path d="M-40 70 q10 -4 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 V100 H-40Z" fill="#1aa0c4" opacity=".45" /></g>
      <g className="wv2"><path d="M-40 80 q10 -4 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 V100 H-40Z" fill="#fff" opacity=".22" /></g>
      <path d="M90 100 Q 140 82 200 84 V100Z" fill="#f2c27a" opacity=".85" />
      <g className="bob"><path d="M40 62 h18 l-3 4 h-12z" fill={D} /><path d="M49 62 v-9 l6 7z" fill="#fff" opacity=".8" /></g>
      <Palm x={186} y={92} s={.85} flip /><Palm x={174} y={94} s={.6} />
    </>
  ),
  Punjab: (
    <>
      <rect y="64" width="200" height="36" fill="#1a1440" opacity=".55" />
      <g transform="translate(62 14) scale(.78)"><g className="tmp">
        <rect x="70" y="46" width="60" height="18" fill="#e9b23a" /><rect x="70" y="46" width="60" height="3" fill="#fff2b0" />
        {[76, 88, 100, 112, 124].map(x => <rect key={x} x={x - 3} y="52" width="5" height="8" rx="2.5" fill="#8a5a10" />)}
        <path d="M86 46 q14 -22 28 0z" fill="#ffd25a" /><path d="M100 24 v-5" stroke="#ffd25a" strokeWidth="1.4" />
        {[72, 128].map(x => <g key={x}><rect x={x - 3} y="38" width="6" height="8" fill="#e9b23a" /><path d={`M${x - 4} 38 q4 -8 8 0z`} fill="#ffd25a" /></g>)}
        <rect x="20" y="62" width="160" height="2" fill="#f5e6c8" opacity=".8" />
      </g>
      <g className="rfl" style={{ transformOrigin: '100px 64px' }}>
        <rect x="70" y="64" width="60" height="18" fill="#e9b23a" opacity=".35" /><path d="M86 82 q14 22 28 0z" fill="#ffd25a" opacity=".3" />
      </g>
      <g className="shim">{[70, 78, 86, 94].map((y, i) => <path key={i} d={`M${60 + i * 4} ${y} h${80 - i * 8}`} stroke="#ffe08a" strokeOpacity=".35" strokeWidth=".7" strokeDasharray="6 5" />)}</g>
      <circle className="glow" cx="100" cy="48" r="34" fill="url(#gg)" /></g>
      <defs><radialGradient id="gg"><stop offset="0" stopColor="#ffd25a" stopOpacity=".45" /><stop offset="1" stopColor="#ffd25a" stopOpacity="0" /></radialGradient></defs>
    </>
  ),
  Sikkim: (
    <>
      <path d="M0 70 L30 40 L48 52 L80 18 L104 44 L122 30 L150 56 L172 36 L200 58 V100 H0Z" fill="#2b2a6a" opacity=".7" />
      <path d="M70 29 L80 18 L90 29 L84 27 L80 31 L75 27Z M115 37 L122 30 L129 37 L124 35Z M166 42 L172 36 L178 42 L172 40Z" fill="#fff" opacity=".95" />
      <path d="M0 80 Q 50 60 100 74 T 200 72 V100 H0Z" fill={D} opacity=".85" />
      <g className="cl1"><ellipse cx="30" cy="40" rx="22" ry="5" fill="#fff" opacity=".35" /></g>
      <g className="cl2"><ellipse cx="150" cy="30" rx="26" ry="5" fill="#fff" opacity=".28" /></g>
      <path d="M8 66 Q 60 78 120 64" stroke="#fff" strokeOpacity=".5" strokeWidth=".5" fill="none" />
      {Array.from({ length: 11 }, (_, i) => { const t = i / 10, x = 8 + 112 * t, y = 66 + 18 * t * (1 - t) * 1.6 - 2 * t; return <path key={i} className="flag" style={{ animationDelay: i * .13 + 's', transformOrigin: `${x}px ${y}px` }} d={`M${x} ${y} l7 0 l-3.5 7z`} fill={['#2f7bff', '#fff', '#ff3d3d', '#2fc46a', '#ffd23f'][i % 5]} /> })}
    </>
  ),
  Dear: (
    <>
      <path d="M0 64 Q 40 44 80 58 T 160 50 T 200 56 V100 H0Z" fill="#2a1f6a" opacity=".6" />
      <g className="mist"><path d="M-20 70 Q 30 62 80 70 T 180 68 T 260 70 V80 H-20Z" fill="#fff" opacity=".18" /></g>
      <path d="M0 78 Q 50 62 110 76 T 200 70 V100 H0Z" fill={D} opacity=".9" />
      {[[30, 80], [44, 77], [58, 79], [130, 78], [146, 75], [160, 77], [172, 74]].map(([x, y], i) => <circle key={i} className="lt" style={{ animationDelay: i * .4 + 's' }} cx={x} cy={y} r=".9" fill="#ffd27a" />)}
      <g className="bird"><g className="flap"><path d="M0 0 q-6 -5 -12 -2 M0 0 q6 -5 12 -2" stroke={D} strokeWidth="1.6" fill="none" strokeLinecap="round" /></g><path d="M0 0 l4 1" stroke="#ffb02e" strokeWidth="1.4" /></g>
    </>
  ),
}

export default function Scene({ k }) {
  const key = Object.keys(SCENES).find(n => k.toLowerCase().startsWith(n.toLowerCase().split(' ')[0])) || 'Dear'
  return <svg className={'scn scn-' + key.toLowerCase()} viewBox="0 0 200 100" preserveAspectRatio="xMidYMax slice" aria-hidden="true">{SCENES[key]}</svg>
}
