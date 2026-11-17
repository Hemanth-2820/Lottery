import React, { useState } from 'react'
import { APPROVAL, UPI, inr } from '../lib/lottery.js'

const AMTS = [100, 200, 500, 1000]

// Wallet sheet: balance, add money by UPI, withdraw to UPI, and the request lists.
export default function Wallet({ shown, held, recharges, toast, onRequest, onConfirm, upi = UPI, withdrawals = [], onWithdraw }) {
  const UPI_ = upi
  const [amt, setAmt] = useState(500), [utr, setUtr] = useState('')
  const [tab, setTab] = useState('add'), [wAmt, setWAmt] = useState(0), [wUpi, setWUpi] = useState(() => { try { return localStorage.getItem('l3upi') || '' } catch { return '' } })
  const [ask, setAsk] = useState(false), [busy, setBusy] = useState(false)
  const pending = withdrawals.find(w => w.status === 'pending')
  const wOk = wAmt >= 100 && wAmt <= Math.min(25000, Math.floor(shown)) && /^[\w.\-]{2,60}@[a-zA-Z][a-zA-Z0-9]{1,30}$/.test(wUpi.trim())
  const sendW = async () => {
    setBusy(true)
    try { await onWithdraw(wAmt, wUpi.trim()); try { localStorage.setItem('l3upi', wUpi.trim()) } catch {} setWAmt(0); setAsk(false) } finally { setBusy(false) }
  }
  const ok = amt >= 10 && amt <= 50000
  // Standard UPI payment link: on a phone it opens the installed UPI apps with payee and amount filled in.
  const link = `upi://pay?pa=${encodeURIComponent(UPI_.id)}&pn=${encodeURIComponent(UPI_.name)}&am=${amt}.00&cu=INR&tn=${encodeURIComponent('Murugan wallet')}`
  const copy = async () => { try { await navigator.clipboard.writeText(UPI_.id); toast('UPI ID copied') } catch { toast('UPI ID: ' + UPI_.id) } }
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
      <p>{held ? inr(held) + ' is waiting for owner approval (wins of ' + inr(APPROVAL) + ' or more).' : 'Tickets are paid from here automatically. Wins are added here.'}</p>

      {onWithdraw && <div className="wtabs"><button className={tab === 'add' ? 'on' : ''} onClick={() => setTab('add')}>Add money</button><button className={tab === 'out' ? 'on' : ''} onClick={() => setTab('out')}>Withdraw</button></div>}

      {tab === 'out' ? <>
        {pending ? <div className="wpend"><b>{inr(+pending.amount)} is on its way</b><span>The owner is sending it to <b>{pending.upi}</b>. This usually takes a few hours.</span></div> : <>
          <h5>Take money out to your UPI</h5>
          <label className="fld" htmlFor="w-out"><span>Amount (₹)</span><input id="w-out" type="number" inputMode="numeric" min="100" value={wAmt || ''} placeholder="100" onChange={e => { setWAmt(Math.floor(+e.target.value) || 0); setAsk(false) }} /></label>
          <div className="amts">{[25, 50, 75, 100].map(p => { const v = Math.floor(Math.min(25000, shown) * p / 100); return <button key={p} className="gl" disabled={v < 100} onClick={() => { setWAmt(v); setAsk(false) }}>{p === 100 ? 'All' : p + '%'}</button> })}</div>
          <label className="fld" htmlFor="w-upi"><span>Your UPI ID</span><input id="w-upi" placeholder="name@okaxis" autoComplete="off" value={wUpi} onChange={e => { setWUpi(e.target.value); setAsk(false) }} style={{ fontSize: 15 }} /></label>
          <small className="hint">Minimum ₹100, maximum ₹25,000 per request. Wins waiting for approval can't be withdrawn yet.</small>
          {ask ? <div className="wask"><span>Send <b>{inr(wAmt)}</b> to <b>{wUpi.trim()}</b>?</span><div><button className="pay" disabled={busy} onClick={sendW}>{busy ? 'Sending…' : 'Yes, withdraw'}</button><button className="gl" onClick={() => setAsk(false)}>Cancel</button></div></div>
            : <button className={'upibtn' + (wOk ? '' : ' dis')} onClick={() => { if (wOk) setAsk(true); else toast(wAmt > shown ? 'You only have ' + inr(shown) : 'Enter an amount (min ₹100) and your UPI ID') }}>Withdraw {wAmt ? inr(wAmt) : ''} ›</button>}
        </>}
        {withdrawals.length > 0 && <>
          <h5>Withdrawals</h5>
          {withdrawals.map(w => (
            <div className="rq" key={w.id}>
              <span><b>{inr(+w.amount)}</b><small>{w.status === 'paid' ? 'Paid · ref ' + w.utr : w.status === 'rejected' ? 'Money returned to wallet' + (w.note ? ' · ' + w.note : '') : 'To ' + w.upi}</small></span>
              {w.status === 'pending' ? <em className="badge wait">SENDING</em> : w.status === 'paid' ? <em className="badge won">PAID</em> : <em className="badge lost">RETURNED</em>}
            </div>
          ))}
        </>}
      </> : <>
      <h5>Add money by UPI</h5>
      <div className="amts">{AMTS.map(a => <button key={a} className={'gl' + (a === amt ? ' on' : '')} onClick={() => setAmt(a)}>{inr(a)}</button>)}</div>
      <label className="fld" htmlFor="w-amt"><span>Amount (₹)</span><input id="w-amt" type="number" inputMode="numeric" min="10" max="50000" value={amt || ''} onChange={e => setAmt(Math.floor(+e.target.value) || 0)} /></label>

      <div className="upi"><div><small>Pay to UPI ID</small><b>{UPI_.id}</b></div><button onClick={copy}>Copy</button></div>
      <a className={'upibtn' + (ok ? '' : ' dis')} href={ok ? link : undefined}>Pay {inr(amt)} with UPI app ›</a>
      <small className="hint">Opens the UPI apps on your phone with the amount already filled in.</small>

      <form className="utr" onSubmit={submit}>
        <label htmlFor="w-utr">After paying, enter the 12-digit UPI reference number (UTR) shown in your UPI app.</label>
        <div><input id="w-utr" inputMode="numeric" maxLength={12} placeholder="431256789012" value={utr} onChange={e => setUtr(e.target.value.replace(/\D/g, ''))} /><button className="pay">Submit</button></div>
      </form>

      {recharges.length > 0 && <>
        <h5>Recharge requests</h5>
        {recharges.map(r => (
          <div className="rq" key={r.id}>
            <span><b>{inr(r.amt)}</b><small>UTR {r.utr}</small></span>
            {r.status === 'pending' ? <><em className="badge wait">CHECKING</em>{onConfirm && <button className="demo" onClick={() => onConfirm(r.id)}>Confirm (demo)</button>}</> : r.status === 'rejected' ? <em className="badge lost">REJECTED</em> : <em className="badge won">ADDED</em>}
          </div>
        ))}
      </>}
      </>}
    </>
  )
}
