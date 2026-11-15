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

function sendCode(string $email, string $code): bool {
  $subject = 'Your ' . MAIL_FROM_NAME . ' sign-in code: ' . $code;
  $html = '<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;border-radius:16px;background:#1b0d3a;color:#fff;text-align:center">'
    . '<h2 style="color:#ffd700;margin:0 0 8px">' . MAIL_FROM_NAME . '</h2><p>Your sign-in code is</p>'
    . '<div style="font-size:34px;letter-spacing:8px;font-weight:bold;color:#ffd700;margin:12px 0">' . $code . '</div>'
    . '<p style="color:#cbb8ff;font-size:13px">It works for 10 minutes. If you did not ask for it, ignore this email.</p></div>';
  if (!empty(SMTP_USER)) {
    return smtpSend($email, $subject, $html);
  }
  $headers = "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nFrom: " . MAIL_FROM_NAME . ' <' . MAIL_FROM . ">\r\n";
  return @mail($email, $subject, $html, $headers, '-f' . MAIL_FROM);
}
