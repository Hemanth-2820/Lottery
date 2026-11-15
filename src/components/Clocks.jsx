import React from 'react'

// Amber LED on the machine: a digit rolls in whenever it changes
export function Led({ text }) {
  return <div className="led">{[...text].map((ch, i) => <span key={i + ch} className="roll">{ch}</span>)}</div>
}

// Split-flap clock on the pick-numbers screen: a tile flips whenever its digit changes
export function FlipClock({ text }) {
  return (
    <div className="flip">
      {[...text].map((ch, i) => ch === ':' ? <i key={i} className="fc">:</i> : <i key={i + ch} className="fd f">{ch}</i>)}
    </div>
  )
}