import React, { useState } from 'react'
import { UPI, inr } from '../lib/lottery.js'

const AMTS = [100, 200, 500, 1000]

// Wallet sheet: balance, add money by UPI, and the list of recharge requests.
export default function Wallet({ shown, held, recharges, toast, onRequest, onConfirm }) {
  const [amt, setAmt] = useState(500), [utr, setUtr] = useState('')
  const ok = amt >= 10 && amt <= 50000
  // Standard UPI payment link: on a phone it opens the installed UPI apps with payee and amount filled in.
  const link = `upi://pay?pa=${encodeURIComponent(UPI.id)}&pn=${encodeURIComponent(UPI.name)}&am=${amt}.00&cu=INR&tn=${encodeURIComponent('Lucky3 wallet')}`
  const copy = async () => { try { await navigator.clipboard.writeText(UPI.id); toast('UPI ID copied') } catch { toast('UPI ID: ' + UPI.id) } }
  const submit = e => {
    e.preventDefault()
    if (!ok) return toast('Enter an amount from ₹10 to ₹50,000')
    if (!/^\d{12}$/.test(utr)) return toast('Enter the 12-digit UPI reference number')
    onRequest(amt, utr); setUtr('')
  }

  return (
    <>
      <h3>Wallet</h3>
      <div className="wbal">{inr(shown)}</div>
      <p>{held ? inr(held) + ' is waiting for owner approval (wins of ₹15,000 or more).' : 'Tickets are paid from here automatically. Wins are added here.'}</p>

      <h5>Add money by UPI</h5>
      <div className="amts">{AMTS.map(a => <button key={a} className={'gl' + (a === amt ? ' on' : '')} onClick={() => setAmt(a)}>{inr(a)}</button>)}</div>
      <label className="fld" htmlFor="w-amt"><span>Amount (₹)</span><input id="w-amt" type="number" inputMode="numeric" min="10" max="50000" value={amt || ''} onChange={e => setAmt(Math.floor(+e.target.value) || 0)} /></label>

      <div className="upi"><div><small>Pay to UPI ID</small><b>{UPI.id}</b></div><button onClick={copy}>Copy</button></div>
      <a className={'upibtn' + (ok ? '' : ' dis')} href={ok ? link : undefined}>Pay {inr(amt)} with UPI app ›</a>
      <small className="hint">Opens the UPI apps on your phone with the amount already filled in.</small>

      {/* TODO(backend): with a payment gateway this step is not needed; the gateway confirms the payment and the wallet is credited automatically. */}
      <form className="utr" onSubmit={submit}>
        <label htmlFor="w-utr">After paying, enter the 12-digit UPI reference number (UTR) shown in your UPI app.</label>
        <div><input id="w-utr" inputMode="numeric" maxLength={12} placeholder="431256789012" value={utr} onChange={e => setUtr(e.target.value.replace(/\D/g, ''))} /><button className="pay">Submit</button></div>
      </form>

      {recharges.length > 0 && <>
        <h5>Recharge requests</h5>
        {recharges.map(r => (
          <div className="rq" key={r.id}>
            <span><b>{inr(r.amt)}</b><small>UTR {r.utr}</small></span>
            {r.status === 'pending' ? <><em className="badge wait">CHECKING</em><button className="demo" onClick={() => onConfirm(r.id)}>Confirm (demo)</button></> : <em className="badge won">ADDED</em>}
          </div>
        ))}
      </>}
    </>
  )
}
