import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { API_URL, LIVE, api } from '../lib/api.js'
import { APPROVAL, UPI, UPIS, inr } from '../lib/lottery.js'

const AMTS = [100, 200, 500, 1000]
// UPI apps. Android opens the exact app through an intent link; iPhone uses each app's own link.
const APPS = [
  { k: 'phonepe', n: 'PhonePe', c: '#5f259f', pkg: 'com.phonepe.app', ios: 'phonepe://pay' },
  { k: 'gpay', n: 'Google Pay', c: '#1a73e8', pkg: 'com.google.android.apps.nbu.paisa.user', ios: 'gpay://upi/pay' },
  { k: 'paytm', n: 'Paytm', c: '#00b9f1', pkg: 'net.one97.paytm', ios: 'paytmmp://pay' },
  { k: 'bhim', n: 'BHIM', c: '#e86b1c', pkg: 'in.org.npci.upiapp', ios: 'bhim://pay' },
]
const isAndroid = () => /android/i.test(navigator.userAgent)

// Wallet sheet: balance, add money by UPI, and the list of recharge requests.
export default function Wallet({ shown, held, recharges, toast, onRequest, onConfirm, upi = UPI, withdrawals = [], onWithdraw }) {
  // UPI IDs come fresh from the server every time the wallet opens, so a change in Admin → Settings shows at once.
  const [srv, setSrv] = useState(null)
  useEffect(() => { if (LIVE) api('upis').then(r => setSrv(r.upis || []), () => setSrv(null)) }, [])
  const list = srv && srv.length ? srv : UPIS.length ? UPIS : LIVE ? [] : [upi]
  const [pick, setPick] = useState(0)
  const UPI_ = list[Math.min(pick, list.length - 1)] || { id: '', name: '' }
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
  // QR link: carries the amount, scanning it fills everything in.
  const q = `pa=${encodeURIComponent(UPI_.id)}&pn=${encodeURIComponent(UPI_.name)}&am=${amt}.00&cu=INR&tn=${encodeURIComponent('Murugan wallet')}`
  const link = 'upi://pay?' + q
  // Pay link with ONLY the UPI ID and name (no amount): opens the app's "pay to UPI ID" screen with the ID filled in.
  // Apps reject links with a pre-filled amount to personal UPI IDs, so the player types the amount there.
  const qPay = `pa=${encodeURIComponent(UPI_.id)}&pn=${encodeURIComponent(UPI_.name || 'Murugan')}`
  // Google Pay accepts its own "tez" link better than the general upi:// one
  const payLink = a => isAndroid()
    ? (a.k === 'gpay' ? `intent://upi/pay?${qPay}#Intent;scheme=tez;package=${a.pkg};end` : `intent://pay?${qPay}#Intent;scheme=upi;package=${a.pkg};end`)
    : (a.k === 'gpay' ? `tez://upi/pay?${qPay}` : `${a.ios}?${qPay}`)
  const launch = a => isAndroid() ? `intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=${a.pkg};end` : a.ios.split('/')[0] + '//'
  const openApp = async a => {
    if (!ok) return toast('Enter an amount from ₹10 to ₹50,000')
    try { await navigator.clipboard.writeText(String(amt)) } catch {}
    toast('Opening ' + a.n + '… enter ' + inr(amt) + ' and pay')
    window.location.href = payLink(a)
  }
  // backup if an app shows an error: copy the UPI ID and just open the app
  const openPlain = async a => {
    try { await navigator.clipboard.writeText(UPI_.id) } catch {}
    toast('UPI ID copied. In ' + a.n + ' tap "Pay UPI ID", paste it and pay ' + inr(amt))
    setTimeout(() => { window.location.href = launch(a) }, 1500)
  }
  const [qr, setQr] = useState('')
  useEffect(() => { if (UPI_.qr) { setQr(API_URL.replace(/[^/]*$/, '') + UPI_.qr); return } QRCode.toDataURL(link, { margin: 1, width: 300 }).then(setQr, () => setQr('')) }, [link, UPI_.qr])
  const copy = async () => { try { await navigator.clipboard.writeText(UPI_.id); toast('UPI ID copied') } catch { toast('UPI ID: ' + UPI_.id) } }
  const submit = e => {
    e.preventDefault()
    if (!ok) return toast('Enter an amount from ₹10 to ₹50,000')
    if (!/^\d{12}$/.test(utr)) return toast('Enter the 12-digit UPI reference number')
    onRequest(amt, utr, UPI_.id); setUtr('')
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
      {!UPI_.id ? <div className="wpend"><b>{srv === null && LIVE ? 'Loading payment details…' : 'Payments are paused'}</b><span>{srv === null && LIVE ? 'One moment.' : 'The owner has not turned on a UPI ID yet. Please try again later.'}</span></div> : <>
      <div className="amts">{AMTS.map(a => <button key={a} className={'gl' + (a === amt ? ' on' : '')} onClick={() => setAmt(a)}>{inr(a)}</button>)}</div>
      <label className="fld" htmlFor="w-amt"><span>Amount (₹)</span><input id="w-amt" type="number" inputMode="numeric" min="10" max="50000" value={amt || ''} onChange={e => setAmt(Math.floor(+e.target.value) || 0)} /></label>

      {list.length > 1 && <><small className="hint" style={{ marginTop: 12, display: 'block' }}>Choose a UPI ID to pay to</small>
        <div className="upis">{list.map((u, i) => <button key={u.id} className={'upi-c' + (UPI_.id === u.id ? ' on' : '')} onClick={() => setPick(i)}><i>{UPI_.id === u.id ? '✓' : i + 1}</i><span><b>{u.id}</b><small>{u.name}</small></span></button>)}</div></>}
      <div className="upi"><div><small>Pay to UPI ID</small><b>{UPI_.id}</b></div><button onClick={copy}>Copy</button></div>
      {qr && <div className="qrbox"><img src={qr} alt={'Scan to pay ' + UPI_.id} /><span><b>Scan with any UPI app</b>{UPI_.qr ? <small>Enter {inr(amt)} in your UPI app</small> : <small>{inr(amt)} is already filled in</small>}<small>{UPI_.id}</small></span></div>}
      <h5>Pay {inr(amt)} with</h5>
      <div className="apps">{APPS.map(a => <button key={a.k} className={'app' + (ok ? '' : ' dis')} style={{ '--c': a.c }} onClick={() => openApp(a)}><i>{a.n[0]}</i><span>{a.n}</span></button>)}</div>
      <a className={'upibtn other' + (ok ? '' : ' dis')} href={ok ? 'upi://pay?' + qPay : undefined}>Other UPI app ›</a>
      <small className="hint">Opens the payment screen with <b>{UPI_.id}</b> filled in. Enter <b>{inr(amt)}</b> and pay, then come back and enter the UTR below.</small>
      <small className="hint">If an app shows an error, use: {APPS.map((a, i) => <React.Fragment key={a.k}>{i ? ' · ' : ''}<button type="button" className="lnk" style={{ background: 'none', border: 0, color: '#ffd23f', textDecoration: 'underline', padding: 0, font: 'inherit' }} onClick={() => openPlain(a)}>{a.n}</button></React.Fragment>)} (copies the UPI ID and opens the app).</small>

      <form className="utr" onSubmit={submit}>
        <label htmlFor="w-utr">After paying to <b>{UPI_.id}</b>, enter the 12-digit UPI reference number (UTR) shown in your UPI app.</label>
        <div><input id="w-utr" inputMode="numeric" maxLength={12} placeholder="431256789012" value={utr} onChange={e => setUtr(e.target.value.replace(/\D/g, ''))} /><button className="pay">Submit</button></div>
      </form>
      </>}

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
