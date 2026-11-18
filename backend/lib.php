<?php
// Shared helpers: database, CORS, JSON replies, login check, India time, game rules
defined('LUCKY3') or exit;
require __DIR__ . '/config.php';
date_default_timezone_set('Asia/Kolkata');

function db(): PDO {
  static $pdo;
  if (!$pdo) {
    $pdo = new PDO('mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4', DB_USER, DB_PASS, [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $pdo->exec("SET time_zone = '+05:30'");
  }
  return $pdo;
}
function q(string $sql, array $p = []): PDOStatement { $s = db()->prepare($sql); $s->execute($p); return $s; }

function cors(): void {
  $o = $_SERVER['HTTP_ORIGIN'] ?? '';
  if (in_array($o, ALLOWED_ORIGINS, true)) {
    header('Access-Control-Allow-Origin: ' . $o);
    header('Vary: Origin');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
  }
  if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }
}
function out($data, int $code = 200): never { http_response_code($code); header('Content-Type: application/json; charset=utf-8'); echo json_encode($data, JSON_UNESCAPED_UNICODE); exit; }
function fail(string $msg, int $code = 400): never { out(['ok' => false, 'error' => $msg], $code); }
function body(): array { static $b; if ($b === null) $b = json_decode(file_get_contents('php://input') ?: '[]', true) ?: []; return $b + $_GET; }
function arg(string $k, $def = null) { return body()[$k] ?? $def; }

// ----- login -----
function user(?string $role = null): array {
  $t = '';
  if (preg_match('/Bearer\s+(\S+)/', $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '', $m)) $t = $m[1];
  elseif (!empty($_GET['token'])) $t = $_GET['token'];        // for file downloads
  if (!$t) fail('Please sign in', 401);
  $u = q('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > NOW()', [hash('sha256', $t)])->fetch();
  if (!$u) fail('Session expired. Please sign in again.', 401);
  if (!empty($u['blocked'])) fail('Your account is blocked. Please contact support.', 403);
  if ($role === 'admin' && $u['role'] !== 'admin') fail('Owner only', 403);
  if ($role === 'analyst' && !in_array($u['role'], ['admin', 'analyst'], true)) fail('Analytics only', 403);
  return $u;
}

// ----- wallet: always change it together with a txns row, inside a transaction -----
function addMoney(int $uid, float $amt, string $type, ?string $ref = null): void {
  q('UPDATE users SET wallet = wallet + ? WHERE id = ?', [$amt, $uid]);
  q('INSERT INTO txns (user_id, type, amount, ref) VALUES (?,?,?,?)', [$uid, $type, $amt, $ref]);
}

// ----- India time -----
function today(): string { return date('Y-m-d'); }
function secsTo(string $day, int $h): int { return strtotime("$day $h:00:00") - time(); }

// ----- game rules (same as the app's lottery.js) -----
// one ticket line {pos:"AB", v:"35", q:2} against a result like "335"
function lineWin(array $x, string $r): int {
  $hit = [];
  foreach (str_split($x['pos']) as $j => $p) $hit[] = $x['v'][$j] === $r[strpos('ABC', $p)];
  $n = strlen($x['pos']); $w = 0;
  if ($n < 3) { if (!in_array(false, $hit, true)) $w = WIN[$n]; }
  else $w = !in_array(false, $hit, true) ? WIN[3] : ($hit[1] && $hit[2] ? WIN_LAST2 : ($hit[2] ? WIN_LAST1 : 0));
  return $w * (int)$x['q'];
}

function randomCode(int $len): string { $a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; $s = ''; for ($i = 0; $i < $len; $i++) $s .= $a[random_int(0, strlen($a) - 1)]; return $s; }

function smtpSend(string $to, string $subject, string $html): bool {
  if (empty(SMTP_HOST) || empty(SMTP_USER)) {
    $headers = "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nFrom: " . MAIL_FROM_NAME . ' <' . MAIL_FROM . ">\r\n";
    return @mail($to, $subject, $html, $headers, '-f' . MAIL_FROM);
  }
  $errno = 0; $errstr = '';
  $s = @fsockopen((SMTP_PORT == 465 ? 'ssl://' : '') . SMTP_HOST, (int)SMTP_PORT, $errno, $errstr, 15);
  if (!$s) return false;
  $read = function() use ($s) {
    $r = '';
    while (!feof($s)) {
      $line = fgets($s, 515);
      $r .= $line;
      if (substr($line, 3, 1) === ' ') break;
    }
    return $r;
  };
  $write = function(string $cmd) use ($s, $read) {
    fputs($s, $cmd . "\r\n");
    return $read();
  };
  $read();
  $write('EHLO ' . (gethostname() ?: 'localhost'));
  if (SMTP_PORT == 587) {
    $write('STARTTLS');
    stream_socket_enable_crypto($s, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
    $write('EHLO ' . (gethostname() ?: 'localhost'));
  }
  $write('AUTH LOGIN');
  $write(base64_encode(SMTP_USER));
  $write(base64_encode(SMTP_PASS));
  $write('MAIL FROM: <' . MAIL_FROM . '>');
  $write('RCPT TO: <' . $to . '>');
  $write('DATA');
  $msg = "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nFrom: " . MAIL_FROM_NAME . ' <' . MAIL_FROM . ">\r\nTo: <$to>\r\nSubject: $subject\r\n\r\n$html\r\n.";
  $write($msg);
  $write('QUIT');
  fclose($s);
  return true;
}

defined('BRAND') or define('BRAND', 'Murugan');   // name shown in every email

// ===== Murugan email design: real artwork + gold frame. Works in Gmail, Outlook, Yahoo, Apple Mail (tables + inline styles). =====
// Pictures live on your server in the folder  api.fashionsnap.in/mail/  (m-header.jpg, m-badge.jpg, m-cards.jpg)
defined('APP_URL')  or define('APP_URL', 'https://murugan-vert.vercel.app');
defined('MAIL_IMG') or define('MAIL_IMG', 'https://api.fashionsnap.in/mail/');

function mailShell(string $hero, string $inner, string $preheader = ''): string {
  $f = "font-family:'Trebuchet MS',Arial,sans-serif";
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"></head>'
  . '<body style="margin:0;padding:0;background:#0b031c">'
  . '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#0b031c">' . esc($preheader) . '&#847; &#847; &#847; &#847; &#847; &#847;</div>'
  . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0b031c" style="background:#0b031c"><tr><td align="center" style="padding:24px 10px">'
  . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px"><tr><td bgcolor="#d9a520" style="padding:2px;border-radius:28px;background:#d9a520;background-image:linear-gradient(160deg,#fff1a8,#e3a91c 30%,#8a5a00 55%,#ffd76a 80%,#b97a10)">'
  . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1a0640" style="background:#1a0640;border-radius:26px;overflow:hidden">'
  . '<tr><td style="padding:0;line-height:0"><img src="' . MAIL_IMG . $hero . '" width="600" alt="' . esc(BRAND) . ' Lucky Draw" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:26px 26px 0 0"></td></tr>'
  . $inner
  . '<tr><td style="padding:6px 0 0;line-height:0"><img src="' . MAIL_IMG . 'm-cards.jpg" width="600" alt="Dear · Kerala · Goa Queen · Sikkim · Punjab" style="display:block;width:100%;max-width:600px;height:auto;border:0"></td></tr>'
  . '<tr><td align="center" style="padding:14px 24px 26px;' . $f . '">'
  . '<div style="color:#ffd23f;font-size:15px;font-weight:bold;letter-spacing:.5px">Vetrivel Muruganukku Arogara 🙏</div>'
  . '<div style="height:1px;background:#3b1a7a;margin:12px 40px"></div>'
  . '<div style="color:#9c88cf;font-size:11px;line-height:1.6">' . date('d M Y · g:i A') . ' IST<br>Automatic message from ' . esc(BRAND) . ' Lucky Draw · Play responsibly · 18+</div>'
  . '</td></tr></table></td></tr></table></td></tr></table></body></html>';
}

// $title: heading · $big: amount or word · $lines: details ("Label: value" / "Label <b>value</b>" become rows) · $color: #16c784 good, #ff5c7a problem, else gold
function mailHtml(string $title, string $big, array $lines = [], string $color = '#ffd700'): string {
  $c = strtolower($color); $kind = $c === '#16c784' ? 'good' : ($c === '#ff5c7a' ? 'bad' : 'info');
  $acc = ['good' => '#2ee59d', 'bad' => '#ff6b8a', 'info' => '#ffd23f'][$kind];
  $tag = ['good' => '✦ GREAT NEWS ✦', 'bad' => '✦ UPDATE ✦', 'info' => '✦ NOTIFICATION ✦'][$kind];
  $f = "font-family:'Trebuchet MS',Arial,sans-serif";
  $rows = ''; $notes = '';
  foreach (array_filter($lines, fn($x) => $x !== '') as $x) {
    if (preg_match('/^([^<:]{2,26}):\s*(.+)$/u', $x, $m) || preg_match('/^([^<:]{2,26})\s(<b>.+<\/b>)$/u', $x, $m))
      $rows .= '<tr><td style="padding:11px 18px;color:#bda9ef;font-size:13px;border-top:1px dashed #4a2595;' . $f . '">' . trim($m[1]) . '</td><td align="right" style="padding:11px 18px;color:#ffffff;font-size:15px;font-weight:bold;border-top:1px dashed #4a2595;' . $f . '">' . strip_tags(trim($m[2]), '<b>') . '</td></tr>';
    else $notes .= '<div style="color:#e9defe;font-size:14px;line-height:1.6;margin-top:6px">' . $x . '</div>';
  }
  $inner =
    '<tr><td align="center" style="padding:6px 28px 0;' . $f . '">'
    . '<div style="color:' . $acc . ';font-size:11px;font-weight:bold;letter-spacing:4px">' . $tag . '</div>'
    . '<div style="font-family:Georgia,\'Times New Roman\',serif;font-style:italic;font-weight:bold;font-size:30px;line-height:1.2;color:#ffffff;margin-top:8px">' . $title . '</div>'
    . '</td></tr>'
    . '<tr><td align="center" style="padding:20px 28px 6px">'
    . '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="' . $acc . '" style="padding:2px;border-radius:22px;background:' . $acc . ';background-image:linear-gradient(135deg,#ffffff,' . $acc . ' 40%,' . $acc . ' 70%,#ffffff)">'
    . '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#12042f" style="padding:16px 44px;border-radius:20px;background:#12042f;background-image:radial-gradient(ellipse at top,#3a1680,#12042f 70%)">'
    . '<div style="' . $f . ';font-size:46px;line-height:1;font-weight:bold;color:' . $acc . ';letter-spacing:1px">' . $big . '</div>'
    . '</td></tr></table></td></tr></table>'
    . ($notes ? '<div style="padding:10px 6px 0;' . $f . '">' . $notes . '</div>' : '')
    . '</td></tr>'
    . ($rows ? '<tr><td style="padding:18px 28px 4px">'
      . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#240b57" style="background:#240b57;border-radius:16px;border:1px solid #5b2fb0">'
      . '<tr><td colspan="2" style="padding:12px 18px;color:#ffd23f;font-size:12px;font-weight:bold;letter-spacing:3px;' . $f . '">🎟&nbsp; DETAILS</td></tr>' . $rows . '</table></td></tr>' : '')
    . '<tr><td align="center" style="padding:24px 28px 14px">'
    . '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#ffc21f" style="border-radius:99px;background:#ffc21f;background-image:linear-gradient(180deg,#fff27a,#ffcf1f 45%,#f0a000);box-shadow:0 5px 0 #a56200">'
    . '<a href="' . APP_URL . '" style="display:inline-block;padding:15px 42px;' . $f . ';font-size:17px;font-weight:bold;color:#3a1400;text-decoration:none;letter-spacing:.5px">Open ' . esc(BRAND) . ' App&nbsp; ›</a>'
    . '</td></tr></table></td></tr>';
  return mailShell('m-header.jpg', $inner, strip_tags($title) . ' · ' . strip_tags($big));
}

// login code email: the Murugan Lucky Draw badge and the code in gold boxes
function codeHtml(string $code): string {
  $f = "font-family:'Trebuchet MS',Arial,sans-serif"; $boxes = '';
  foreach (str_split($code) as $d) $boxes .= '<td style="padding:0 4px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#e3a91c" style="padding:2px;border-radius:14px;background:#e3a91c;background-image:linear-gradient(160deg,#fff1a8,#e3a91c 45%,#8a5a00)"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" width="44" height="58" bgcolor="#12042f" style="width:44px;height:58px;border-radius:12px;background:#12042f;' . $f . ';font-size:30px;font-weight:bold;color:#ffd23f">' . $d . '</td></tr></table></td></tr></table></td>';
  $inner = '<tr><td align="center" style="padding:4px 28px 0;' . $f . '">'
    . '<div style="color:#ffd23f;font-size:11px;font-weight:bold;letter-spacing:4px">✦ SIGN IN ✦</div>'
    . '<div style="font-family:Georgia,\'Times New Roman\',serif;font-style:italic;font-weight:bold;font-size:30px;color:#ffffff;margin-top:8px">Your login code</div>'
    . '<div style="color:#c9b8f2;font-size:14px;margin-top:6px">Type this code in the ' . esc(BRAND) . ' app</div>'
    . '</td></tr>'
    . '<tr><td align="center" style="padding:22px 10px 8px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>' . $boxes . '</tr></table></td></tr>'
    . '<tr><td align="center" style="padding:10px 28px 22px;' . $f . '">'
    . '<div style="display:inline-block;padding:7px 16px;border-radius:99px;background:#2a0d63;color:#ffd23f;font-size:13px;font-weight:bold">⏱ Valid for 10 minutes</div>'
    . '<div style="color:#9c88cf;font-size:12px;line-height:1.6;margin-top:14px">Never share this code with anyone.<br>Didn\'t ask for it? Just ignore this email.</div>'
    . '</td></tr>';
  return mailShell('m-badge.jpg', $inner, 'Your ' . BRAND . ' login code is ' . $code);
}

function sendCode(string $email, string $code): bool {
  $subject = 'Your ' . BRAND . ' sign-in code: ' . $code;
  $html = codeHtml($code);
  if (SMTP_USER !== '') return smtpSend($email, $subject, $html);
  $headers = "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nFrom: " . BRAND . ' <' . MAIL_FROM . ">\r\n";
  return @mail($email, '=?UTF-8?B?' . base64_encode($subject) . '?=', $html, $headers, '-f' . MAIL_FROM);
}

// ================= emails =================

// Who gets the owner alerts: set in Admin -> Settings ("Alert emails to"); falls back to the first ADMIN_EMAILS address.
function alertEmail(): string {
  $st = is_file(__DIR__ . '/settings.json') ? (json_decode((string)file_get_contents(__DIR__ . '/settings.json'), true) ?: []) : [];
  $e = trim((string)($st['alert_email'] ?? ''));
  if ($e === '' && defined('ALERT_EMAIL')) $e = ALERT_EMAIL;
  if ($e === '') $e = ADMIN_EMAILS[0] ?? '';
  return filter_var($e, FILTER_VALIDATE_EMAIL) ? $e : '';
}
function winMailMin(): int {   // players are emailed about wins of this amount or more (0 = every win)
  $st = is_file(__DIR__ . '/settings.json') ? (json_decode((string)file_get_contents(__DIR__ . '/settings.json'), true) ?: []) : [];
  return max(0, (int)($st['win_mail_min'] ?? 0));
}
function rs($n): string { return '₹' . number_format((float)$n, ((float)$n == (int)$n) ? 0 : 2); }
function esc($s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function drawName(string $lot, int $h): string { return $lot . ' ' . date('g A', mktime($h, 0)); }

function mailSend(string $to, string $subject, string $html): bool {
  if (!filter_var($to, FILTER_VALIDATE_EMAIL)) return false;
  if (SMTP_USER !== '') return smtpSend($to, $subject, $html);
  $from = defined('NOTIFY_FROM') ? NOTIFY_FROM : MAIL_FROM;
  $headers = "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nFrom: " . BRAND . ' <' . $from . ">\r\n";
  return @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $html, $headers, '-f' . $from);
}
// queue an email; all queued emails go out AFTER the reply is sent, so buttons in the app stay fast
function mailLater(string $to, string $subject, string $html): void {
  static $queued = false; global $MAILQ;
  if ($to === '') return;
  $MAILQ[] = [$to, $subject, $html];
  if (!$queued) { $queued = true; register_shutdown_function(function () {
    global $MAILQ; if (function_exists('fastcgi_finish_request')) @fastcgi_finish_request();
    @set_time_limit(120); foreach ((array)$MAILQ as [$t, $s, $h]) { try { mailSend($t, $s, $h); } catch (Throwable $e) { error_log('mail: ' . $e->getMessage()); } }
  }); }
}
function toPlayer(int $uid, string $subject, string $html): void {
  $e = q('SELECT email FROM users WHERE id = ?', [$uid])->fetchColumn(); if ($e) mailLater($e, $subject, $html);
}
function toOwner(string $subject, string $html): void { mailLater(alertEmail(), $subject, $html); }

// emails after a result is published: $wins = list of [user_id, code, won, held]
function mailResult(string $lot, int $h, string $digits, array $wins): void {
  $dn = drawName($lot, $h); $min = winMailMin(); $big = [];
  foreach ($wins as [$uid, $code, $won, $held]) {
    if ($won > 0 && $won >= $min) toPlayer($uid, "You won " . rs($won) . " in $dn 🎉", mailHtml('Congratulations, you won!', rs($won), ["$dn result: <b>$digits</b>", "Ticket <b>" . esc($code) . "</b>", 'The money is already in your wallet.'], '#16c784'));
    if ($held > 0) {
      toPlayer($uid, "Big win " . rs($held) . " in $dn 🏆", mailHtml('Big win! 🏆', rs($held), ["$dn result: <b>$digits</b>", "Ticket <b>" . esc($code) . "</b>", 'Wins this big are checked by the owner. You will get an email as soon as it is added to your wallet.'], '#16c784'));
      $big[] = esc($code) . ' · ' . rs($held);
    }
  }
  if ($big) toOwner('Big win to approve: ' . count($big) . " in $dn", mailHtml('Big win waiting for you', count($big) . ' ticket' . (count($big) > 1 ? 's' : ''), array_merge(["$dn result: <b>$digits</b>"], $big, ['Open Admin → Big wins to approve or reject.'])));
}
