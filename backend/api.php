<?php
// Lucky3 API. Every call: api.php?a=<action>  (POST with a JSON body, or GET)
define('LUCKY3', 1);
require __DIR__ . '/lib.php';
cors();

try {
  switch ($_GET['a'] ?? '') {

  // ================= sign in =================
  case 'send_otp': {
    $email = strtolower(trim((string)arg('email')));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Enter a valid email address');
    $last = q('SELECT created_at FROM otps WHERE email = ? ORDER BY id DESC LIMIT 1', [$email])->fetchColumn();
    if ($last && time() - strtotime($last) < 30) fail('Please wait 30 seconds before asking again');
    $code = (string)random_int(100000, 999999);
    q('DELETE FROM otps WHERE email = ?', [$email]);
    q('INSERT INTO otps (email, code_hash, expires_at) VALUES (?, ?, NOW() + INTERVAL 10 MINUTE)', [$email, hash('sha256', $code)]);
    $sent = sendCode($email, $code);
    if (!$sent && !DEV_SHOW_OTP) fail('Could not send the email. Try again.', 500);
    out(['ok' => true] + (DEV_SHOW_OTP ? ['dev_code' => $code] : []));
  }

  case 'verify_otp': {
    $email = strtolower(trim((string)arg('email'))); $code = (string)arg('code');
    $o = q('SELECT * FROM otps WHERE email = ? ORDER BY id DESC LIMIT 1', [$email])->fetch();
    if (!$o || strtotime($o['expires_at']) < time()) fail('Code expired. Ask for a new one.');
    if ($o['attempts'] >= 5) fail('Too many tries. Ask for a new code.');
    if (!hash_equals($o['code_hash'], hash('sha256', $code))) { q('UPDATE otps SET attempts = attempts + 1 WHERE id = ?', [$o['id']]); fail('Wrong code. Try again.'); }
    q('DELETE FROM otps WHERE email = ?', [$email]);
    $role = in_array($email, ADMIN_EMAILS, true) ? 'admin' : (in_array($email, ANALYST_EMAILS, true) ? 'analyst' : 'player');
    $u = q('SELECT * FROM users WHERE email = ?', [$email])->fetch();
    if (!$u) {
      do { $rc = 'L3' . randomCode(6); } while (q('SELECT 1 FROM users WHERE ref_code = ?', [$rc])->fetch());
      q('INSERT INTO users (email, role, ref_code) VALUES (?,?,?)', [$email, $role, $rc]);
      $uid = (int)db()->lastInsertId();
    } else { $uid = (int)$u['id']; if ($u['role'] !== $role && $role !== 'player') q('UPDATE users SET role = ? WHERE id = ?', [$role, $uid]); }
    $token = bin2hex(random_bytes(32));
    q('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, NOW() + INTERVAL 30 DAY)', [hash('sha256', $token), $uid]);
    out(['ok' => true, 'token' => $token, 'role' => $role]);
  }

  case 'admin_login': {   // admin panel: password only, no email code
    $pw = (string)arg('password');
    $ip = substr($_SERVER['REMOTE_ADDR'] ?? 'x', 0, 45);
    $tries = (int)q("SELECT COUNT(*) FROM otps WHERE email = ? AND created_at > NOW() - INTERVAL 15 MINUTE", ['fail:' . $ip])->fetchColumn();
    if ($tries >= 5) fail('Too many wrong tries. Wait 15 minutes.', 429);
    $role = ($pw !== '' && hash_equals(ADMIN_PASSWORD, $pw)) ? 'admin' : ((ANALYST_PASSWORD !== '' && hash_equals(ANALYST_PASSWORD, $pw)) ? 'analyst' : '');
    if (!$role) { q("INSERT INTO otps (email, code_hash, expires_at) VALUES (?, '', NOW())", ['fail:' . $ip]); fail('Wrong password'); }
    $email = $role === 'admin' ? (ADMIN_EMAILS[0] ?? 'owner@lucky3.local') : (ANALYST_EMAILS[0] ?? 'analytics@lucky3.local');
    $u = q('SELECT id FROM users WHERE email = ?', [$email])->fetch();
    if (!$u) {
      do { $rc = 'L3' . randomCode(6); } while (q('SELECT 1 FROM users WHERE ref_code = ?', [$rc])->fetch());
      q('INSERT INTO users (email, role, ref_code) VALUES (?,?,?)', [$email, $role, $rc]); $uid = (int)db()->lastInsertId();
    } else { $uid = (int)$u['id']; q('UPDATE users SET role = ? WHERE id = ?', [$role, $uid]); }
    $token = bin2hex(random_bytes(32));
    q('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, NOW() + INTERVAL 7 DAY)', [hash('sha256', $token), $uid]);
    q("DELETE FROM otps WHERE email = ?", ['fail:' . $ip]);
    out(['ok' => true, 'token' => $token, 'role' => $role]);
  }

  case 'logout': {
    if (preg_match('/Bearer\s+(\S+)/', $_SERVER['HTTP_AUTHORIZATION'] ?? '', $m)) q('DELETE FROM sessions WHERE token_hash = ?', [hash('sha256', $m[1])]);
    out(['ok' => true]);
  }

  // ================= player =================
  case 'me': {
    $u = user();
    $held = q("SELECT COALESCE(SUM(amount),0) FROM big_wins WHERE user_id = ? AND status = 'pending'", [$u['id']])->fetchColumn();
    $ref = q('SELECT r.ref_code FROM referrals x JOIN users r ON r.id = x.referrer_id WHERE x.referee_id = ?', [$u['id']])->fetchColumn();
    $friends = q('SELECT u.email, x.created_at FROM referrals x JOIN users u ON u.id = x.referee_id WHERE x.referrer_id = ? ORDER BY x.id DESC LIMIT 50', [$u['id']])->fetchAll();
    foreach ($friends as &$f) $f['email'] = substr($f['email'], 0, 1) . '***@' . explode('@', $f['email'])[1];
    out(['ok' => true, 'user' => ['email' => $u['email'], 'role' => $u['role'], 'wallet' => (float)$u['wallet'], 'held' => (float)$held,
      'ref_code' => $u['ref_code'], 'ref_used' => $ref ?: null, 'friends' => $friends], 'upi' => ['id' => UPI_ID, 'name' => UPI_NAME], 'bonus' => REF_BONUS]);
  }

  case 'history': {   // wallet history
    $u = user();
    out(['ok' => true, 'txns' => q('SELECT type, amount, ref, created_at FROM txns WHERE user_id = ? ORDER BY id DESC LIMIT 100', [$u['id']])->fetchAll()]);
  }

  case 'recharge': {  // player paid by UPI and sends the UTR (12-digit transaction number)
    $u = user(); $amt = (float)arg('amount'); $utr = preg_replace('/\D/', '', (string)arg('utr'));
    if ($amt < 10 || $amt > 50000) fail('Amount must be between ₹10 and ₹50,000');
    if (strlen($utr) !== 12) fail('Enter the 12-digit UTR number from your UPI app');
    if (q('SELECT 1 FROM recharges WHERE utr = ?', [$utr])->fetch()) fail('This UTR was already sent');
    q('INSERT INTO recharges (user_id, amount, utr) VALUES (?,?,?)', [$u['id'], $amt, $utr]);
    out(['ok' => true, 'id' => (int)db()->lastInsertId(), 'status' => 'pending']);
  }

  case 'recharges': {
    $u = user();
    out(['ok' => true, 'recharges' => q('SELECT id, amount, utr, status, created_at FROM recharges WHERE user_id = ? ORDER BY id DESC LIMIT 30', [$u['id']])->fetchAll()]);
  }

  case 'book': {      // Pay Now: debits the wallet straight away, no confirmation (client rule)
    $u = user(); $lot = (string)arg('lot'); $h = (int)arg('h'); $items = arg('items', []); $day = today();
    if (!isset(LOTS[$lot]) || !in_array($h, LOTS[$lot], true)) fail('Unknown draw');
    if (secsTo($day, $h) <= CLOSE) fail('Booking is closed for this draw');
    if (!is_array($items) || !$items || count($items) > 200) fail('Add a number first');
    $clean = []; $total = 0;
    foreach ($items as $x) {
      $pos = (string)($x['pos'] ?? ''); $v = (string)($x['v'] ?? ''); $qty = (int)($x['q'] ?? 0);
      if (!in_array($pos, ['A', 'B', 'C', 'AB', 'AC', 'BC', 'ABC'], true) || !preg_match('/^\d{' . strlen($pos) . '}$/', $v) || $qty < 1 || $qty > 99) fail('Bad ticket line');
      $price = PRICE[strlen($pos)]; $total += $price * $qty;
      $clean[] = ['pos' => $pos, 'v' => $v, 'q' => $qty, 'price' => $price];
    }
    db()->beginTransaction();
    $w = (float)q('SELECT wallet FROM users WHERE id = ? FOR UPDATE', [$u['id']])->fetchColumn();
    if ($w < $total) { db()->rollBack(); out(['ok' => false, 'error' => 'Low balance', 'need_recharge' => true, 'wallet' => $w, 'total' => $total], 402); }
    $code = 'L3-' . randomCode(6);
    q('INSERT INTO tickets (code, user_id, day, lot, h, items, total) VALUES (?,?,?,?,?,?,?)', [$code, $u['id'], $day, $lot, $h, json_encode($clean), $total]);
    addMoney($u['id'], -$total, 'bet', $code);
    db()->commit();
    out(['ok' => true, 'ticket' => ['code' => $code, 'day' => $day, 'lot' => $lot, 'h' => $h, 'items' => $clean, 'total' => $total], 'wallet' => $w - $total]);
  }

  case 'tickets': {
    $u = user();
    $rows = q('SELECT t.code, t.day, t.lot, t.h, t.items, t.total, t.status, t.won, t.held, t.created_at, r.digits AS result
               FROM tickets t LEFT JOIN results r ON r.day = t.day AND r.lot = t.lot AND r.h = t.h
               WHERE t.user_id = ? ORDER BY t.id DESC LIMIT 100', [$u['id']])->fetchAll();
    foreach ($rows as &$r) $r['items'] = json_decode($r['items'], true);
    out(['ok' => true, 'tickets' => $rows]);
  }

  case 'results': {   // public: results of the last N days
    $days = max(1, min(31, (int)arg('days', 7)));
    out(['ok' => true, 'results' => q('SELECT day, lot, h, digits, published_at FROM results WHERE day >= CURDATE() - INTERVAL ? DAY ORDER BY day DESC, h DESC', [$days - 1])->fetchAll()]);
  }

  case 'redeem_ref': {
    $u = user(); $c = strtoupper(trim((string)arg('code')));
    $r = q('SELECT * FROM users WHERE ref_code = ?', [$c])->fetch();
    if (!$r) fail('This code does not exist');
    if ($r['id'] == $u['id']) fail('You cannot use your own code');
    if (q('SELECT 1 FROM referrals WHERE referee_id = ?', [$u['id']])->fetch()) fail('You have already used a code');
    db()->beginTransaction();
    q('INSERT INTO referrals (referrer_id, referee_id, bonus) VALUES (?,?,?)', [$r['id'], $u['id'], REF_BONUS]);
    q('UPDATE users SET referred_by = ? WHERE id = ?', [$r['id'], $u['id']]);
    addMoney($u['id'], REF_BONUS, 'bonus', $c);
    db()->commit();
    out(['ok' => true, 'bonus' => REF_BONUS]);
  }

  // ================= owner portal =================
  case 'admin_overview': {
    user('admin');
    out(['ok' => true,
      'recharges' => q("SELECT r.id, r.amount, r.utr, r.created_at, u.email FROM recharges r JOIN users u ON u.id = r.user_id WHERE r.status = 'pending' ORDER BY r.id")->fetchAll(),
      'big_wins'  => q("SELECT b.id, b.amount, b.created_at, u.email, t.code, t.lot, t.h, t.day FROM big_wins b JOIN users u ON u.id = b.user_id JOIN tickets t ON t.id = b.ticket_id WHERE b.status = 'pending' ORDER BY b.id")->fetchAll(),
      'results'   => q('SELECT day, lot, h, digits FROM results WHERE day >= CURDATE() - INTERVAL 1 DAY ORDER BY day DESC, h DESC')->fetchAll(),
      'lots' => LOTS]);
  }

  case 'admin_recharge': {   // {id, approve: true|false}
    user('admin'); $id = (int)arg('id'); $ok = (bool)arg('approve');
    db()->beginTransaction();
    $r = q("SELECT * FROM recharges WHERE id = ? AND status = 'pending' FOR UPDATE", [$id])->fetch();
    if (!$r) { db()->rollBack(); fail('Already decided'); }
    q('UPDATE recharges SET status = ?, decided_at = NOW() WHERE id = ?', [$ok ? 'added' : 'rejected', $id]);
    if ($ok) addMoney((int)$r['user_id'], (float)$r['amount'], 'recharge', $r['utr']);
    db()->commit(); out(['ok' => true]);
  }

  case 'admin_publish': {    // {day, lot, h, digits}: publishes the result and pays every ticket of that slot
    user('admin'); $day = (string)arg('day', today()); $lot = (string)arg('lot'); $h = (int)arg('h'); $d = (string)arg('digits');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $day) || !isset(LOTS[$lot]) || !in_array($h, LOTS[$lot], true)) fail('Unknown slot');
    if (!preg_match('/^\d{3}$/', $d)) fail('Result must be 3 digits');
    if (secsTo($day, $h) > 0) fail('This draw has not happened yet');
    db()->beginTransaction();
    try { q('INSERT INTO results (day, lot, h, digits) VALUES (?,?,?,?)', [$day, $lot, $h, $d]); }
    catch (PDOException $e) { db()->rollBack(); fail('Result for this slot is already published'); }
    $paid = 0; $heldTot = 0; $n = 0;
    foreach (q("SELECT * FROM tickets WHERE day = ? AND lot = ? AND h = ? AND status = 'booked' FOR UPDATE", [$day, $lot, $h])->fetchAll() as $t) {
      $won = 0; $held = 0;
      foreach (json_decode($t['items'], true) as $x) { $w = lineWin($x, $d); if ($w >= APPROVAL) $held += $w; else $won += $w; }
      if ($won > 0) addMoney((int)$t['user_id'], $won, 'win', $t['code']);
      if ($held > 0) q('INSERT INTO big_wins (ticket_id, user_id, amount) VALUES (?,?,?)', [$t['id'], $t['user_id'], $held]);
      q("UPDATE tickets SET status = 'settled', won = ?, held = ? WHERE id = ?", [$won, $held, $t['id']]);
      $paid += $won; $heldTot += $held; $n++;
    }
    db()->commit();
    out(['ok' => true, 'tickets' => $n, 'paid' => $paid, 'held_for_approval' => $heldTot]);
  }

  case 'admin_bigwin': {     // {id, approve: true|false}
    user('admin'); $id = (int)arg('id'); $ok = (bool)arg('approve');
    db()->beginTransaction();
    $b = q("SELECT b.*, t.code FROM big_wins b JOIN tickets t ON t.id = b.ticket_id WHERE b.id = ? AND b.status = 'pending' FOR UPDATE", [$id])->fetch();
    if (!$b) { db()->rollBack(); fail('Already decided'); }
    q('UPDATE big_wins SET status = ?, decided_at = NOW() WHERE id = ?', [$ok ? 'approved' : 'rejected', $id]);
    if ($ok) addMoney((int)$b['user_id'], (float)$b['amount'], 'win', $b['code']);
    db()->commit(); out(['ok' => true]);
  }

  // ================= analytics =================
  case 'analytics': {        // ?month=2026-11  -> totals and one row per day
    user('analyst'); [$from, $to] = monthRange((string)arg('month', date('Y-m')));
    $rows = dailyRows($from, $to);
    $tot = ['paid' => 0, 'winnings' => 0, 'bonus' => 0, 'recharges' => 0, 'profit' => 0, 'tickets' => 0];
    foreach ($rows as $r) foreach ($tot as $k => $_) $tot[$k] += $r[$k];
    out(['ok' => true, 'month' => substr($from, 0, 7), 'totals' => $tot, 'days' => $rows]);
  }

  case 'analytics_excel': {  // download: api.php?a=analytics_excel&month=2026-11&token=...
    user('analyst'); [$from, $to] = monthRange((string)arg('month', date('Y-m')));
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="lucky3-' . substr($from, 0, 7) . '.csv"');
    $f = fopen('php://output', 'w'); fwrite($f, "\xEF\xBB\xBF");   // so Excel shows ₹ and Indian text correctly
    fputcsv($f, ['Date', 'Tickets', 'Amount paid by players (₹)', 'Winnings paid (₹)', 'Referral bonus (₹)', 'Profit (₹)', 'UPI recharges (₹)']);
    $t = [0, 0, 0, 0, 0, 0];
    foreach (dailyRows($from, $to) as $r) {
      fputcsv($f, [$r['day'], $r['tickets'], $r['paid'], $r['winnings'], $r['bonus'], $r['profit'], $r['recharges']]);
      foreach (['tickets', 'paid', 'winnings', 'bonus', 'profit', 'recharges'] as $i => $k) $t[$i] += $r[$k];
    }
    fputcsv($f, array_merge(['TOTAL'], $t)); exit;
  }

  default: fail('Unknown action', 404);
  }
} catch (Throwable $e) {
  if (db()->inTransaction()) db()->rollBack();
  error_log('Lucky3: ' . $e->getMessage());
  fail('Server error. Please try again.', 500);
}

function monthRange(string $m): array {
  if (!preg_match('/^\d{4}-\d{2}$/', $m)) fail('Month must look like 2026-11');
  return [$m . '-01', date('Y-m-t', strtotime($m . '-01'))];
}
// per-day money: paid = ticket sales, winnings = wins paid, profit = paid - winnings - bonus
function dailyRows(string $from, string $to): array {
  $m = [];
  for ($d = $from; $d <= $to; $d = date('Y-m-d', strtotime($d . ' +1 day'))) $m[$d] = ['day' => $d, 'tickets' => 0, 'paid' => 0, 'winnings' => 0, 'bonus' => 0, 'recharges' => 0, 'profit' => 0];
  foreach (q("SELECT DATE(created_at) d, type, SUM(amount) s, COUNT(*) n FROM txns WHERE created_at >= ? AND created_at < ? + INTERVAL 1 DAY GROUP BY d, type", [$from, $to])->fetchAll() as $r) {
    $x = &$m[$r['d']]; $s = abs((float)$r['s']);
    if ($r['type'] === 'bet') { $x['paid'] += $s; $x['tickets'] += (int)$r['n']; }
    elseif ($r['type'] === 'win') $x['winnings'] += $s;
    elseif ($r['type'] === 'bonus') $x['bonus'] += $s;
    elseif ($r['type'] === 'recharge') $x['recharges'] += $s;
    unset($x);
  }
  foreach ($m as &$x) $x['profit'] = $x['paid'] - $x['winnings'] - $x['bonus'];
  return array_values($m);
}
