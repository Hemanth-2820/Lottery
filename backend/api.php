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
    if ($u && !empty($u['blocked'])) fail('Your account is blocked. Please contact support.', 403);
    if (!$u) {
      do { $rc = 'L3' . randomCode(6); } while (q('SELECT 1 FROM users WHERE ref_code = ?', [$rc])->fetch());
      q('INSERT INTO users (email, role, ref_code) VALUES (?,?,?)', [$email, $role, $rc]);
      $uid = (int)db()->lastInsertId();
      if ($role === 'player') {
        mailLater($email, 'Welcome to ' . BRAND . ' 🙏', mailHtml('Welcome!', 'Vetrivel Muruganukku Arogara', ['Your account is ready. Add money to your wallet and pick your lucky numbers.', 'Your invite code: <b>' . $rc . '</b>']));
        toOwner('New player: ' . $email, mailHtml('New player joined', esc($email), ['Signed up just now.']));
      }
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
    $u = user(); $amt = (float)arg('amount'); $utr = preg_replace('/\D/', '', (string)arg('utr')); $to = mb_substr(trim((string)arg('upi', '')), 0, 80) ?: null;
    if ($amt < 10 || $amt > 50000) fail('Amount must be between ₹10 and ₹50,000');
    if (strlen($utr) !== 12) fail('Enter the 12-digit UTR number from your UPI app');
    if (q('SELECT 1 FROM recharges WHERE utr = ?', [$utr])->fetch()) fail('This UTR was already sent');
    q('INSERT INTO recharges (user_id, amount, utr, paid_to) VALUES (?,?,?,?)', [$u['id'], $amt, $utr, $to]);
    $rid = (int)db()->lastInsertId();
    mailLater($u['email'], 'We got your recharge of ' . rs($amt), mailHtml('Recharge received', rs($amt), ['UTR <b>' . $utr . '</b>', 'We are checking the payment. The money is added to your wallet as soon as it is confirmed.']));
    toOwner('New recharge ' . rs($amt) . ' – please check', mailHtml('New recharge to check', rs($amt), ['From <b>' . esc($u['email']) . '</b>', 'UTR <b>' . $utr . '</b>', 'Paid to <b>' . esc($to ?: '—') . '</b>', 'Check it in your UPI app, then open Admin → Recharges.']));
    out(['ok' => true, 'id' => $rid, 'status' => 'pending']);
  }

  case 'withdraw': {  // player asks to take money out: it leaves the wallet now, the owner sends it by UPI
    defined('WD_MIN') or define('WD_MIN', 100); defined('WD_MAX') or define('WD_MAX', 25000);   // you can set these in config.php
    $u = user(); $amt = round((float)arg('amount'), 2); $upi = trim((string)arg('upi'));
    if ($amt < WD_MIN || $amt > WD_MAX) fail('Withdraw between ₹' . WD_MIN . ' and ₹' . number_format(WD_MAX));
    if (!preg_match('/^[a-zA-Z0-9.\-_]{2,60}@[a-zA-Z][a-zA-Z0-9]{1,30}$/', $upi)) fail('Enter a valid UPI ID, like name@okaxis');
    db()->beginTransaction();
    $w = (float)q('SELECT wallet FROM users WHERE id = ? FOR UPDATE', [$u['id']])->fetchColumn();
    if (q("SELECT 1 FROM withdrawals WHERE user_id = ? AND status = 'pending'", [$u['id']])->fetch()) { db()->rollBack(); fail('You already have a withdrawal being processed'); }
    if ($w < $amt) { db()->rollBack(); fail('You only have ₹' . number_format($w) . ' in your wallet'); }
    q('INSERT INTO withdrawals (user_id, amount, upi) VALUES (?,?,?)', [$u['id'], $amt, $upi]);
    $id = (int)db()->lastInsertId();
    addMoney($u['id'], -$amt, 'withdraw', 'WD-' . $id);
    db()->commit();
    mailLater($u['email'], 'Withdrawal of ' . rs($amt) . ' is being processed', mailHtml('Withdrawal requested', rs($amt), ['To UPI ID <b>' . esc($upi) . '</b>', 'The owner will send it soon. You will get an email when it is paid.']));
    toOwner('Withdrawal request ' . rs($amt) . ' – please pay', mailHtml('Withdrawal to pay', rs($amt), ['Player <b>' . esc($u['email']) . '</b>', 'Send to UPI ID <b>' . esc($upi) . '</b>', 'After paying, open Admin → Withdrawals and click Mark paid.']));
    out(['ok' => true, 'id' => $id, 'wallet' => $w - $amt]);
  }

  case 'withdrawals': {
    $u = user();
    out(['ok' => true, 'withdrawals' => q('SELECT id, amount, upi, status, utr, note, created_at, decided_at FROM withdrawals WHERE user_id = ? ORDER BY id DESC LIMIT 30', [$u['id']])->fetchAll()]);
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

  case 'config': {    // public: current prices, wins, draw times and UPI, so the app always matches the server
    out(['ok' => true, 'config' => [
      'lots' => array_map(fn($k, $h) => ['k' => $k, 'h' => array_values($h)], array_keys(LOTS), array_values(LOTS)),
      'close' => CLOSE, 'price' => array_values(PRICE), 'win' => array_values(WIN), 'last' => [WIN_LAST2, WIN_LAST1],
      'approval' => APPROVAL, 'ref_bonus' => REF_BONUS, 'upi' => ['id' => UPI_ID, 'name' => UPI_NAME],
      'alert_email' => alertEmail(), 'win_mail_min' => winMailMin(),
      'upis' => array_map(fn($u) => ['id' => $u['id'], 'name' => $u['name'], 'on' => !isset($u['on']) || $u['on'], 'qr' => !empty($u['qr']) ? $u['qr'] : null], UPIS)]]);
  }

  case 'upis': {      // public: the UPI IDs that are ON right now, read fresh from settings.json every time
    $st = is_file(__DIR__ . '/settings.json') ? (json_decode((string)file_get_contents(__DIR__ . '/settings.json'), true) ?: []) : [];
    $list = [];
    foreach ((array)($st['upis'] ?? []) as $u) if (!empty($u['id']) && (!isset($u['on']) || $u['on'])) $list[] = ['id' => $u['id'], 'name' => $u['name'] ?? '', 'qr' => !empty($u['qr']) ? $u['qr'] : null];
    if (!$list && defined('UPI_ID') && UPI_ID && UPI_ID !== 'yourupi@bank') $list[] = ['id' => UPI_ID, 'name' => defined('UPI_NAME') ? UPI_NAME : '', 'qr' => null];
    header('Cache-Control: no-store');
    out(['ok' => true, 'upis' => $list]);
  }

  case 'results': {   // public: results of the last N days. Also checks the result websites (max once a minute) as a backup for the cron job.
    $days = max(1, min(31, (int)arg('days', 7)));
    $json = json_encode(['ok' => true, 'results' => q('SELECT day, lot, h, digits, published_at FROM results WHERE day >= CURDATE() - INTERVAL ? DAY ORDER BY day DESC, h DESC', [$days - 1])->fetchAll()], JSON_UNESCAPED_UNICODE);
    header('Content-Type: application/json; charset=utf-8'); echo $json;
    $last = @filemtime(__DIR__ . '/last_fetch.json') ?: 0;
    if (time() - $last >= 60 && function_exists('fastcgi_finish_request')) {
      fastcgi_finish_request();                                   // the player already has the reply
      $lock = fopen(__DIR__ . '/fetch.lock', 'c');
      if ($lock && flock($lock, LOCK_EX | LOCK_NB)) {            // only one check at a time
        if (time() - (@filemtime(__DIR__ . '/last_fetch.json') ?: 0) >= 60) { @touch(__DIR__ . '/last_fetch.json'); require_once __DIR__ . '/fetch.php'; run_fetch(today(), false); }
        flock($lock, LOCK_UN);
      }
    }
    exit;
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
    if (REF_BONUS > 0) mailLater($u['email'], 'Bonus ' . rs(REF_BONUS) . ' added', mailHtml('Invite bonus added', rs(REF_BONUS), ['You used code <b>' . esc($c) . '</b>. The bonus is in your wallet.'], '#16c784'));
    mailLater($r['email'], 'Your friend joined ' . BRAND, mailHtml('A friend used your code', esc(substr($u['email'], 0, 1) . '***@' . explode('@', $u['email'])[1]), ['Thanks for inviting your friends!']));
    out(['ok' => true, 'bonus' => REF_BONUS]);
  }

  // ================= owner portal =================
  case 'admin_overview': {
    user('admin');
    require_once __DIR__ . '/fetch.php';
    out(['ok' => true,
      'recharges' => q("SELECT r.id, r.amount, r.utr, r.paid_to, r.created_at, u.email FROM recharges r JOIN users u ON u.id = r.user_id WHERE r.status = 'pending' ORDER BY r.id")->fetchAll(),
      'big_wins'  => array_map(function ($b) { $r = (string)$b['result']; $b['lines'] = array_values(array_filter(array_map(fn($x) => $x + ['win' => $r !== '' ? lineWin($x, $r) : 0], json_decode($b['items'], true)), fn($x) => $x['win'] >= APPROVAL)); unset($b['items']); return $b; },
        q("SELECT b.id, b.amount, b.created_at, u.email, t.code, t.lot, t.h, t.day, t.items, t.total, r.digits AS result FROM big_wins b JOIN users u ON u.id = b.user_id JOIN tickets t ON t.id = b.ticket_id LEFT JOIN results r ON r.day = t.day AND r.lot = t.lot AND r.h = t.h WHERE b.status = 'pending' ORDER BY b.id")->fetchAll()),
      'big_history' => q("SELECT b.id, b.amount, b.status, b.created_at, b.decided_at, u.email, t.code, t.lot, t.h, t.day FROM big_wins b JOIN users u ON u.id = b.user_id JOIN tickets t ON t.id = b.ticket_id WHERE b.status <> 'pending' ORDER BY b.decided_at DESC LIMIT 30")->fetchAll(),
      'withdrawals' => q("SELECT w.id, w.amount, w.upi, w.created_at, u.email, u.wallet,
          (SELECT COALESCE(SUM(amount),0) FROM recharges r WHERE r.user_id = u.id AND r.status = 'added') AS added,
          (SELECT COALESCE(SUM(won),0) FROM tickets t WHERE t.user_id = u.id) AS won,
          (SELECT COALESCE(SUM(amount),0) FROM withdrawals p WHERE p.user_id = u.id AND p.status = 'paid') AS taken
        FROM withdrawals w JOIN users u ON u.id = w.user_id WHERE w.status = 'pending' ORDER BY w.id")->fetchAll(),
      'wd_history' => q("SELECT w.id, w.amount, w.upi, w.status, w.utr, w.note, w.decided_at, u.email FROM withdrawals w JOIN users u ON u.id = w.user_id WHERE w.status <> 'pending' ORDER BY w.decided_at DESC LIMIT 30")->fetchAll(),
      'rc_history' => q("SELECT r.id, r.amount, r.utr, r.paid_to, r.status, r.decided_at, u.email FROM recharges r JOIN users u ON u.id = r.user_id WHERE r.status <> 'pending' ORDER BY r.decided_at DESC LIMIT 30")->fetchAll(),
      'rc_today' => q("SELECT status, COUNT(*) n, COALESCE(SUM(amount),0) s FROM recharges WHERE DATE(COALESCE(decided_at, created_at)) = CURDATE() GROUP BY status")->fetchAll(),
      'big_month' => q("SELECT status, COUNT(*) n, COALESCE(SUM(amount),0) s FROM big_wins WHERE created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') GROUP BY status")->fetchAll(),
      'results'   => q('SELECT day, lot, h, digits, src, full_no FROM results WHERE day >= CURDATE() - INTERVAL 6 DAY ORDER BY day DESC, h DESC')->fetchAll(),
      'lots'      => LOTS,
      'auto'      => get_auto_status()]);
  }

  case 'admin_fetch': {
    user('admin');
    require_once __DIR__ . '/fetch.php';
    $rows = run_auto_fetch(true);
    out(['ok' => true, 'rows' => $rows]);
  }

  case 'admin_recharge': {   // {id, approve: true|false}
    user('admin'); $id = (int)arg('id'); $ok = (bool)arg('approve');
    db()->beginTransaction();
    $r = q("SELECT * FROM recharges WHERE id = ? AND status = 'pending' FOR UPDATE", [$id])->fetch();
    if (!$r) { db()->rollBack(); fail('Already decided'); }
    q('UPDATE recharges SET status = ?, decided_at = NOW() WHERE id = ?', [$ok ? 'added' : 'rejected', $id]);
    if ($ok) addMoney((int)$r['user_id'], (float)$r['amount'], 'recharge', $r['utr']);
    db()->commit();
    toPlayer((int)$r['user_id'], $ok ? rs($r['amount']) . ' added to your wallet ✅' : 'Your recharge of ' . rs($r['amount']) . ' was not added',
      $ok ? mailHtml('Money added', rs($r['amount']), ['UTR <b>' . esc($r['utr']) . '</b>', 'Your wallet is ready. Good luck!'], '#16c784')
          : mailHtml('Recharge not added', rs($r['amount']), ['UTR <b>' . esc($r['utr']) . '</b>', 'We could not find this payment. If you paid, reply with a screenshot of the payment.'], '#ff5c7a'));
    out(['ok' => true]);
  }

  case 'admin_publish': {    // {day, lot, h, digits}: publishes the result and pays every ticket of that slot
    user('admin'); $day = (string)arg('day', today()); $lot = (string)arg('lot'); $h = (int)arg('h'); $d = (string)arg('digits');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $day) || !isset(LOTS[$lot]) || !in_array($h, LOTS[$lot], true)) fail('Unknown slot');
    if (!preg_match('/^\d{3}$/', $d)) fail('Result must be 3 digits');
    if (secsTo($day, $h) > 0) fail('This draw has not happened yet');
    db()->beginTransaction();
    try { q('INSERT INTO results (day, lot, h, digits) VALUES (?,?,?,?)', [$day, $lot, $h, $d]); }
    catch (PDOException $e) { db()->rollBack(); fail('Result for this slot is already published'); }
    $paid = 0; $heldTot = 0; $n = 0; $wins = [];
    foreach (q("SELECT * FROM tickets WHERE day = ? AND lot = ? AND h = ? AND status = 'booked' FOR UPDATE", [$day, $lot, $h])->fetchAll() as $t) {
      $won = 0; $held = 0;
      foreach (json_decode($t['items'], true) as $x) { $w = lineWin($x, $d); if ($w >= APPROVAL) $held += $w; else $won += $w; }
      if ($won > 0) addMoney((int)$t['user_id'], $won, 'win', $t['code']);
      if ($held > 0) q('INSERT INTO big_wins (ticket_id, user_id, amount) VALUES (?,?,?)', [$t['id'], $t['user_id'], $held]);
      q("UPDATE tickets SET status = 'settled', won = ?, held = ? WHERE id = ?", [$won, $held, $t['id']]);
      if ($won > 0 || $held > 0) $wins[] = [(int)$t['user_id'], $t['code'], $won, $held];
      $paid += $won; $heldTot += $held; $n++;
    }
    db()->commit();
    mailResult($lot, $h, $d, $wins);
    out(['ok' => true, 'tickets' => $n, 'paid' => $paid, 'held_for_approval' => $heldTot]);
  }

  case 'admin_unpublish': {  // {day, lot, h}: removes a published result
    user('admin'); $day = (string)arg('day'); $lot = (string)arg('lot'); $h = (int)arg('h');
    q('DELETE FROM results WHERE day = ? AND lot = ? AND h = ?', [$day, $lot, $h]);
    out(['ok' => true]);
  }

  case 'admin_withdraw': {   // {id, paid: true, utr} after sending the money, or {id, paid: false, note} to refund it
    user('admin'); $id = (int)arg('id'); $paid = (bool)arg('paid');
    db()->beginTransaction();
    $x = q("SELECT * FROM withdrawals WHERE id = ? AND status = 'pending' FOR UPDATE", [$id])->fetch();
    if (!$x) { db()->rollBack(); fail('Already decided'); }
    if ($paid) {
      $utr = trim((string)arg('utr')); if (strlen($utr) < 6) { db()->rollBack(); fail('Enter the UPI reference number of your payment'); }
      q("UPDATE withdrawals SET status = 'paid', utr = ?, decided_at = NOW() WHERE id = ?", [$utr, $id]);
    } else {
      q("UPDATE withdrawals SET status = 'rejected', note = ?, decided_at = NOW() WHERE id = ?", [mb_substr(trim((string)arg('note')), 0, 160) ?: null, $id]);
      addMoney((int)$x['user_id'], (float)$x['amount'], 'refund', 'WD-' . $id);
    }
    db()->commit();
    $nt = mb_substr(trim((string)arg('note')), 0, 160);
    toPlayer((int)$x['user_id'], $paid ? rs($x['amount']) . ' sent to your UPI ✅' : 'Withdrawal not paid, ' . rs($x['amount']) . ' returned to wallet',
      $paid ? mailHtml('Withdrawal paid', rs($x['amount']), ['Sent to <b>' . esc($x['upi']) . '</b>', 'Reference <b>' . esc(trim((string)arg('utr'))) . '</b>'], '#16c784')
            : mailHtml('Withdrawal not paid', rs($x['amount']), ['The money is back in your wallet.', $nt !== '' ? 'Reason: ' . esc($nt) : ''], '#ff5c7a'));
    out(['ok' => true]);
  }

  case 'admin_players': {    // ?q=search&page=0 -> players with their money totals
    user('admin'); $qq = trim((string)arg('q', '')); $page = max(0, (int)arg('page', 0));
    $where = "u.role = 'player'" . ($qq !== '' ? ' AND u.email LIKE ?' : ''); $args = $qq !== '' ? ['%' . $qq . '%'] : [];
    $rows = q("SELECT u.id, u.email, u.wallet, u.created_at, u.blocked, u.block_note,
        (SELECT COUNT(*) FROM tickets t WHERE t.user_id = u.id) AS tickets,
        (SELECT COALESCE(SUM(total),0) FROM tickets t WHERE t.user_id = u.id) AS spent,
        (SELECT COALESCE(SUM(won),0) FROM tickets t WHERE t.user_id = u.id) AS won,
        (SELECT COALESCE(SUM(amount),0) FROM recharges r WHERE r.user_id = u.id AND r.status = 'added') AS added,
        (SELECT COALESCE(SUM(amount),0) FROM withdrawals w WHERE w.user_id = u.id AND w.status = 'paid') AS taken,
        (SELECT MAX(created_at) FROM tickets t WHERE t.user_id = u.id) AS last_play
      FROM users u WHERE $where ORDER BY u.id DESC LIMIT 50 OFFSET " . ($page * 50), $args)->fetchAll();
    $c = q("SELECT COUNT(*) n, COALESCE(SUM(blocked),0) b, COALESCE(SUM(DATE(created_at) = CURDATE()),0) t, COALESCE(SUM(wallet),0) w FROM users WHERE role = 'player'")->fetch();
    out(['ok' => true, 'players' => $rows, 'count' => (int)$c['n'], 'blocked' => (int)$c['b'], 'today' => (int)$c['t'], 'wallets' => (float)$c['w'], 'more' => count($rows) === 50]);
  }

  case 'admin_player': {     // ?id= -> last 30 wallet movements of one player
    user('admin');
    out(['ok' => true, 'txns' => q('SELECT type, amount, ref, created_at FROM txns WHERE user_id = ? ORDER BY id DESC LIMIT 30', [(int)arg('id')])->fetchAll()]);
  }

  case 'admin_block': {      // {id, block: true|false, note}
    user('admin'); $id = (int)arg('id'); $b = (bool)arg('block');
    $p = q('SELECT role FROM users WHERE id = ?', [$id])->fetch();
    if (!$p || $p['role'] !== 'player') fail('Only players can be blocked');
    q('UPDATE users SET blocked = ?, block_note = ? WHERE id = ?', [$b ? 1 : 0, $b ? (mb_substr(trim((string)arg('note')), 0, 160) ?: null) : null, $id]);
    if ($b) q('DELETE FROM sessions WHERE user_id = ?', [$id]);   // signs them out everywhere
    toPlayer($id, $b ? 'Your account is blocked' : 'Your account is open again', $b ? mailHtml('Account blocked', '🔒', ['Please contact support.'], '#ff5c7a') : mailHtml('Account open again', '✅', ['You can sign in and play again.'], '#16c784'));
    out(['ok' => true]);
  }

  case 'admin_adjust': {     // {id, amount (+ add / - remove), note}  owner fixes a player's wallet by hand
    user('admin'); $id = (int)arg('id'); $amt = round((float)arg('amount'), 2); $note = mb_substr(trim((string)arg('note')), 0, 120);
    if (!$amt || abs($amt) > 100000) fail('Enter an amount between 1 and 100000');
    if ($note === '') fail('Write a reason');
    db()->beginTransaction();
    $p = q("SELECT wallet, role FROM users WHERE id = ? FOR UPDATE", [$id])->fetch();
    if (!$p || $p['role'] !== 'player') { db()->rollBack(); fail('Player not found'); }
    if ($p['wallet'] + $amt < 0) { db()->rollBack(); fail('Wallet has only ₹' . (float)$p['wallet'] . ', cannot remove more than that'); }
    addMoney($id, $amt, 'adjust', 'Admin: ' . $note);
    db()->commit();
    toPlayer($id, ($amt > 0 ? rs($amt) . ' added to' : rs(-$amt) . ' removed from') . ' your wallet', mailHtml($amt > 0 ? 'Money added by owner' : 'Money removed by owner', rs(abs($amt)), ['Reason: ' . esc($note), 'Wallet now <b>' . rs((float)$p['wallet'] + $amt) . '</b>'], $amt > 0 ? '#16c784' : '#ff5c7a'));
    out(['ok' => true, 'wallet' => (float)$p['wallet'] + $amt]);
  }

  case 'admin_settings': {   // owner saves prices, wins, rules, draw times and UPI (written to settings.json)
    user('admin'); $c = arg('config', []);
    $int = function ($v, $min, $max, $name) { $v = (int)$v; if ($v < $min || $v > $max) fail("$name must be between $min and $max"); return $v; };
    $lots = [];
    foreach (array_keys(LOTS) as $k) {
      $hs = array_values(array_unique(array_map('intval', (array)($c['lots'][$k] ?? []))));
      foreach ($hs as $h) if ($h < 6 || $h > 23) fail("$k: draw hours must be between 6 AM and 11 PM");
      if (!$hs) fail("$k needs at least one draw time"); sort($hs); $lots[$k] = $hs;
    }
    $p = (array)($c['price'] ?? []); $w = (array)($c['win'] ?? []);
    $new = ['lots' => $lots,
      'close' => $int($c['close_min'] ?? 3, 0, 60, 'Booking close (minutes)') * 60,
      'price' => [1 => $int($p[0] ?? 0, 1, 10000, 'Single price'), 2 => $int($p[1] ?? 0, 1, 10000, 'Double price'), 3 => $int($p[2] ?? 0, 1, 10000, 'Triple price')],
      'win' => [1 => $int($w[0] ?? 0, 1, 10000000, 'Single win'), 2 => $int($w[1] ?? 0, 1, 10000000, 'Double win'), 3 => $int($w[2] ?? 0, 1, 10000000, 'Triple win')],
      'win_last2' => $int($c['win_last2'] ?? 0, 0, 10000000, 'Triple last-2 win'), 'win_last1' => $int($c['win_last1'] ?? 0, 0, 10000000, 'Triple last-1 win'),
      'approval' => $int($c['approval'] ?? 0, 1, 100000000, 'Approval limit'), 'ref_bonus' => $int($c['ref_bonus'] ?? 0, 0, 100000, 'Referral bonus'),
      'upis' => [],
      'alert_email' => '', 'win_mail_min' => max(0, (int)($c['win_mail_min'] ?? 0))];
    $ae = trim((string)($c['alert_email'] ?? ''));
    if ($ae !== '' && !filter_var($ae, FILTER_VALIDATE_EMAIL)) fail('Alert email is not a valid email address');
    $new['alert_email'] = $ae;
    foreach ((array)($c['upis'] ?? []) as $i => $x) {
      $id = trim((string)($x['id'] ?? '')); $nm = mb_substr(trim((string)($x['name'] ?? '')), 0, 40);
      if ($id === '' && $nm === '') continue;
      if (!preg_match('/^[a-zA-Z0-9.\-_]{2,60}@[a-zA-Z][a-zA-Z0-9]{1,30}$/', $id)) fail('UPI ' . ($i + 1) . ': enter a valid UPI ID, like name@okaxis');
      if ($nm === '') fail('UPI ' . ($i + 1) . ': enter the name players will see');
      foreach ($new['upis'] as $y) if (strcasecmp($y['id'], $id) === 0) fail("$id is added twice");
      $qr = (string)($x['qr'] ?? ''); if ($qr !== '' && !preg_match('#^qr/[a-f0-9]{16}\.(png|jpg|webp)$#', $qr)) $qr = '';
      $new['upis'][] = ['id' => $id, 'name' => $nm, 'on' => !empty($x['on']), 'qr' => $qr];
    }
    $on = array_values(array_filter($new['upis'], fn($u) => $u['on']));
    if (!$on) fail('Turn on at least one UPI ID so players can add money');
    if (count($new['upis']) > 10) fail('You can add up to 10 UPI IDs');
    $new['upi_id'] = $on[0]['id']; $new['upi_name'] = $on[0]['name'];
    if (file_put_contents(__DIR__ . '/settings.json', json_encode($new, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX) === false) fail('Could not save. Check that the api folder is writable.', 500);
    out(['ok' => true]);
  }

  case 'admin_mail': {        // owner: read email settings, or {test:true} to send a test email
    user('admin');
    if (arg('test')) { $to = alertEmail(); if ($to === '') fail('Set an alert email first'); $ok = mailSend($to, 'Test email from ' . BRAND, mailHtml('Emails are working ✅', 'Test', ['This is where you will get alerts for recharges, withdrawals and big wins.'], '#16c784')); if (!$ok) fail('Could not send. Check SMTP_HOST, SMTP_USER and SMTP_PASS in config.php.', 500); out(['ok' => true, 'to' => $to]); }
    out(['ok' => true, 'alert_email' => alertEmail(), 'win_mail_min' => winMailMin(), 'smtp' => SMTP_USER !== '']);
  }

  case 'admin_upload_qr': {  // {image: "data:image/png;base64,..."} -> saves the owner's QR picture, returns its path
    user('admin'); $d = (string)arg('image');
    if (!preg_match('#^data:image/(png|jpe?g|webp);base64,(.+)$#', $d, $m)) fail('Choose a PNG, JPG or WEBP picture');
    $bin = base64_decode($m[2], true); if ($bin === false || strlen($bin) > 1500000) fail('Picture must be smaller than 1.5 MB');
    $info = @getimagesizefromstring($bin); if (!$info || !in_array($info[2], [IMAGETYPE_PNG, IMAGETYPE_JPEG, IMAGETYPE_WEBP], true)) fail('This file is not a picture');
    $ext = [IMAGETYPE_PNG => 'png', IMAGETYPE_JPEG => 'jpg', IMAGETYPE_WEBP => 'webp'][$info[2]];
    if (!is_dir(__DIR__ . '/qr')) @mkdir(__DIR__ . '/qr', 0755);
    $name = 'qr/' . bin2hex(random_bytes(8)) . '.' . $ext;
    if (file_put_contents(__DIR__ . '/' . $name, $bin) === false) fail('Could not save the picture. Check folder permissions.', 500);
    out(['ok' => true, 'path' => $name]);
  }

  case 'admin_bigwin': {     // {id, approve: true|false}
    user('admin'); $id = (int)arg('id'); $ok = (bool)arg('approve');
    db()->beginTransaction();
    $b = q("SELECT b.*, t.code FROM big_wins b JOIN tickets t ON t.id = b.ticket_id WHERE b.id = ? AND b.status = 'pending' FOR UPDATE", [$id])->fetch();
    if (!$b) { db()->rollBack(); fail('Already decided'); }
    q('UPDATE big_wins SET status = ?, decided_at = NOW() WHERE id = ?', [$ok ? 'approved' : 'rejected', $id]);
    if ($ok) addMoney((int)$b['user_id'], (float)$b['amount'], 'win', $b['code']);
    db()->commit();
    toPlayer((int)$b['user_id'], $ok ? 'Big win ' . rs($b['amount']) . ' added to your wallet 🏆' : 'Update on your big win',
      $ok ? mailHtml('Big win approved!', rs($b['amount']), ['Ticket <b>' . esc($b['code']) . '</b>', 'The money is in your wallet now.'], '#16c784')
          : mailHtml('Big win not approved', rs($b['amount']), ['Ticket <b>' . esc($b['code']) . '</b>', 'Please contact support for details.'], '#ff5c7a'));
    out(['ok' => true]);
  }

  // ================= analytics =================
  case 'analytics': {        // ?month=2026-11  -> totals and one row per day
    user('analyst'); [$from, $to] = monthRange((string)arg('month', date('Y-m')));
    $rows = dailyRows($from, $to);
    $tot = ['paid' => 0, 'winnings' => 0, 'bonus' => 0, 'recharges' => 0, 'profit' => 0, 'tickets' => 0];
    foreach ($rows as $r) foreach ($tot as $k => $_) $tot[$k] += $r[$k];
    $draws = q('SELECT lot, h, COUNT(*) tickets, SUM(total) sales, SUM(won + held) winnings FROM tickets WHERE day BETWEEN ? AND ? GROUP BY lot, h ORDER BY sales DESC', [$from, $to])->fetchAll();
    foreach ($draws as &$x) { $x['h'] = (int)$x['h']; $x['tickets'] = (int)$x['tickets']; $x['sales'] = (float)$x['sales']; $x['winnings'] = (float)$x['winnings']; $x['profit'] = $x['sales'] - $x['winnings']; }
    out(['ok' => true, 'month' => substr($from, 0, 7), 'totals' => $tot, 'days' => $rows, 'by_draw' => $draws]);
  }

  case 'exposure': {         // today's draws without a result: money bet, most-bet numbers, and what each result would cost
    user('analyst'); $day = today(); $out = [];
    foreach (LOTS as $lot => $hs) foreach ($hs as $h) {
      if (q('SELECT 1 FROM results WHERE day = ? AND lot = ? AND h = ?', [$day, $lot, $h])->fetch()) continue;
      $items = []; $sales = 0; $n = 0; $bets = [];
      foreach (q("SELECT items, total FROM tickets WHERE day = ? AND lot = ? AND h = ? AND status = 'booked'", [$day, $lot, $h])->fetchAll() as $t) {
        $n++; $sales += (float)$t['total'];
        foreach (json_decode($t['items'], true) as $x) { $items[] = $x; $k = $x['pos'] . ' ' . $x['v']; $bets[$k] = ($bets[$k] ?? 0) + $x['price'] * $x['q']; }
      }
      $risk = [];
      if ($items) for ($r = 0; $r < 1000; $r++) { $d = sprintf('%03d', $r); $p = 0; foreach ($items as $x) $p += lineWin($x, $d); if ($p) $risk[$d] = $p; }
      arsort($risk); arsort($bets);
      $out[] = ['lot' => $lot, 'h' => $h, 'closes_in' => max(0, secsTo($day, $h) - CLOSE), 'tickets' => $n, 'sales' => $sales,
        'worst' => array_map(fn($d, $p) => ['result' => sprintf('%03d', $d), 'payout' => $p], array_slice(array_keys($risk), 0, 5), array_slice(array_values($risk), 0, 5)),
        'top_bets' => array_map(fn($k, $a) => ['bet' => $k, 'amount' => $a], array_slice(array_keys($bets), 0, 6), array_slice(array_values($bets), 0, 6))];
    }
    usort($out, fn($a, $b) => $a['h'] <=> $b['h']);
    out(['ok' => true, 'day' => $day, 'draws' => $out]);
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
