import { useEffect, useRef, useState } from 'react'

// re-render once a second (countdowns, dial, cut-off)
export function useNow() {
  const [n, setN] = useState(0)
  useEffect(() => { const iv = setInterval(() => setN(x => x + 1), 1000); return () => clearInterval(iv) }, [])
  return n
}

// state plus a ref that always holds the latest value (for async handlers)
export function useStateRef(init) {
  const [v, setV] = useState(init), ref = useRef(v)
  const set = x => { const nx = typeof x === 'function' ? x(ref.current) : x; ref.current = nx; setV(nx) }
  return [v, set, ref]
}

// count smoothly from the old value to the new one
export function useAnimatedNumber(value, ms = 700) {
  const [shown, setShown] = useState(value), cur = useRef(value)
  useEffect(() => {
    const a = cur.current, t0 = performance.now(); let raf
    const step = t => { const k = Math.min(1, (t - t0) / ms); cur.current = a + (value - a) * (1 - Math.pow(1 - k, 3)); setShown(cur.current); if (k < 1) raf = requestAnimationFrame(step) }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, ms])
  return shown
}