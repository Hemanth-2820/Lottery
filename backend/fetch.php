<?php
// fetch.php: reads today's results from the result websites and publishes the LAST 3 DIGITS automatically.
// Runs every 5 minutes from a cPanel Cron Job. It also pays all tickets, exactly like the admin Publish button.
//   Test (shows what it finds, publishes nothing):  https://api.fashionsnap.in/fetch.php?key=murugan-fetch-2026&test=1
define('LUCKY3', 1);
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/lib.php';
date_default_timezone_set('Asia/Kolkata');

const FETCH_KEY = 'murugan-fetch-2026';   // needed only when opening fetch.php in a browser

// Auto-migrate table if src and full_no columns don't exist yet
try {
  db()->exec("ALTER TABLE results ADD src VARCHAR(10) NOT NULL DEFAULT 'manual', ADD full_no VARCHAR(20) NULL");
} catch (Throwable $e) {}

// which website gives which draw  [lottery, hour, url, reader]
$SRC = [
  ['Goa Queen', 12, 'https://www.goaqueen.in/result.php', 'goa'],
  ['Dear',      13, 'https://dearlottery.in/result-today-1pm', 'dear'],
  ['Kerala',    15, 'https://www.goodreturns.in/kerala-lottery-chart.html', 'kerala'],
  ['Punjab',    17, 'https://www.goodreturns.in/punjab-lottery-results.html', 'near'],
  ['Goa Queen', 17, 'https://www.goaqueen.in/result.php', 'goa'],
  ['Dear',      18, 'https://dearlottery.in/result-today-6pm', 'dear'],
  ['Sikkim',    18, 'https://www.goodreturns.in/sikkim-dear-6-pm-lottery-results.html', 'near'],
  ['Goa Queen', 19, 'https://www.goaqueen.in/result.php', 'goa'],
  ['Dear',      20, 'https://dearlottery.in/result-today-8pm', 'dear'],
];

$day = $_GET['day'] ?? date('Y-m-d');
$ts = strtotime($day);
$cache = [];

function get(string $url): string {
  global $cache; if (isset($cache[$url])) return $cache[$url];
  $c = curl_init($url);
  curl_setopt_array($c, [
    CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => 25,
    CURLOPT_USERAGENT => 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
    CURLOPT_HTTPHEADER => ['Accept-Language: en-IN,en;q=0.9', 'Cache-Control: no-cache']
  ]);
  $h = (string)curl_exec($c); curl_close($c);
  return $cache[$url] = $h;
}

function text(string $html): string {
  $html = preg_replace('#<(script|style|noscript)[^>]*>.*?</\1>#si', ' ', $html);
  $t = html_entity_decode(strip_tags(preg_replace('#<(br|/td|/th|/tr|/p|/div|/li|/h\d)[^>]*>#i', ' ', $html)), ENT_QUOTES, 'UTF-8');
  return trim(preg_replace('/\s+/u', ' ', $t));
}

// ---------- readers: each returns the full winning number for that draw, or null ----------
function r_goa(string $html, int $h): ?string {
  global $day; $t = text($html); $hh = sprintf('%02d:00', $h > 12 ? $h - 12 : $h);
  return preg_match('/' . preg_quote($day) . '\s+' . $hh . '\s+([A-Z]?\s?\d{4,6})\b/', $t, $m) ? $m[1] : null;
}

// dearlottery.in lists newest results first. Each row is: series + number, draw number, then the date.
// Only take the number that sits right before TODAY's date, so an older day's result is never used.
function r_dear(string $html, int $h): ?string {
  global $ts; $t = text($html);
  foreach ([date('d/m/y', $ts), date('d/m/Y', $ts), date('d.m.y', $ts), date('d-m-Y', $ts)] as $d) {
    if (preg_match('/\b(\d{2}[A-Z])\s?(\d{5})\s*(?:Draw\s*No\.?\s*\d{1,4}\s*)?' . preg_quote($d, '/') . '/i', $t, $m)) return $m[1] . ' ' . $m[2];
  }
  return null;
}

function r_near(string $html, int $h): ?string {
  global $ts; $t = text($html);
  $dates = [date('j F Y', $ts), date('d F Y', $ts), date('F j, Y', $ts), date('d-m-Y', $ts), date('d/m/Y', $ts), date('j M Y', $ts), date('d M Y', $ts)];
  foreach ($dates as $d) {
    $off = 0;
    while (($p = stripos($t, $d, $off)) !== false) {
      $win = substr($t, $p, 400); $off = $p + 1;
      if (stripos($win, 'updated shortly') !== false && stripos($win, 'updated shortly') < 150) continue;
      if (preg_match('/(?:ticket(?: number| no\.?)?|result)\s*:?\s*(?:is\s*)?\b((?:\d{0,2}[A-Z]{1,2}\s?)?\d{5,6})\b/i', $win, $m)) return $m[1];
      if (preg_match('/\b(\d{2}[A-Z]\s\d{5}|[A-Z]{1,2}\s\d{5,6})\b/', $win, $m)) return $m[1];
    }
  }
  return null;
}

function r_kerala(string $html, int $h): ?string {
  global $ts; $doc = new DOMDocument(); libxml_use_internal_errors(true); $doc->loadHTML($html);
  $mon = strtoupper(date('M', $ts)); $dnum = (int)date('j', $ts);
  foreach ($doc->getElementsByTagName('table') as $tb) {
    $rows = $tb->getElementsByTagName('tr'); if ($rows->length < 28) continue;
    $col = -1; $i = 0;
    foreach ($rows->item(0)->childNodes as $c) if ($c->nodeType === 1) { if (strtoupper(trim($c->textContent)) === $mon) $col = $i; $i++; }
    if ($col < 0) continue;
    foreach ($rows as $r) {
      $cells = []; foreach ($r->childNodes as $c) if ($c->nodeType === 1) $cells[] = trim($c->textContent);
      if (($cells[0] ?? '') !== (string)$dnum) continue;
      $v = $cells[$col] ?? ''; return preg_match('/\d{6}/', $v, $m) ? $m[0] : null;
    }
  }
  return r_near($html, $h);
}

// ---------- publish = same as the admin Publish button: save result, pay every ticket ----------
function publish(string $day, string $lot, int $h, string $d, string $full = ''): string {
  db()->beginTransaction();
  try {
    q('INSERT INTO results (day, lot, h, digits, src, full_no) VALUES (?,?,?,?,?,?)', [$day, $lot, $h, $d, 'auto', $full]);
  } catch (PDOException $e) {
    try {
      q('INSERT INTO results (day, lot, h, digits) VALUES (?,?,?,?)', [$day, $lot, $h, $d]);
    } catch (PDOException $e2) {
      db()->rollBack(); return 'already published';
    }
  }
  $n = 0; $paid = 0; $held = 0;
  foreach (q("SELECT * FROM tickets WHERE day = ? AND lot = ? AND h = ? AND status = 'booked' FOR UPDATE", [$day, $lot, $h])->fetchAll() as $t) {
    $won = 0; $hd = 0;
    foreach (json_decode($t['items'], true) as $x) { $w = lineWin($x, $d); if ($w >= APPROVAL) $hd += $w; else $won += $w; }
    if ($won > 0) addMoney((int)$t['user_id'], $won, 'win', $t['code']);
    if ($hd > 0) q('INSERT INTO big_wins (ticket_id, user_id, amount) VALUES (?,?,?)', [$t['id'], $t['user_id'], $hd]);
    q("UPDATE tickets SET status = 'settled', won = ?, held = ? WHERE id = ?", [$won, $hd, $t['id']]);
    $n++; $paid += $won; $held += $hd;
  }
  db()->commit();
  return "PUBLISHED, tickets $n, paid ₹$paid, waiting approval ₹$held";
}

function get_auto_status(): array {
  global $SRC;
  $at = @file_get_contents(__DIR__ . '/.last_fetch') ?: (q("SELECT published_at FROM results WHERE src = 'auto' ORDER BY id DESC LIMIT 1")->fetchColumn() ?: null);
  $today = date('Y-m-d');
  $rows = [];
  foreach ($SRC as [$lot, $h, $url, $reader]) {
    $host = parse_url($url, PHP_URL_HOST);
    $r = q('SELECT digits, full_no FROM results WHERE day = ? AND lot = ? AND h = ?', [$today, $lot, $h])->fetch();
    if ($r) {
      $rows[] = ['lot' => $lot, 'h' => $h, 'site' => $host, 'full' => $r['full_no'], 'digits' => $r['digits'], 'state' => 'done'];
    } elseif (time() < strtotime("$today $h:00")) {
      $rows[] = ['lot' => $lot, 'h' => $h, 'site' => $host, 'full' => null, 'digits' => null, 'state' => 'wait'];
    } else {
      $rows[] = ['lot' => $lot, 'h' => $h, 'site' => $host, 'full' => null, 'digits' => null, 'state' => 'miss'];
    }
  }
  return ['at' => $at, 'rows' => $rows];
}

function run_auto_fetch(bool $publish = true): array {
  global $SRC, $cache;
  @file_put_contents(__DIR__ . '/.last_fetch', date('Y-m-d H:i:s'));
  $today = date('Y-m-d');
  $rows = [];
  foreach ($SRC as [$lot, $h, $url, $reader]) {
    $host = parse_url($url, PHP_URL_HOST);
    $existing = q('SELECT digits, full_no FROM results WHERE day = ? AND lot = ? AND h = ?', [$today, $lot, $h])->fetch();
    if ($existing) {
      $rows[] = ['lot' => $lot, 'h' => $h, 'site' => $host, 'full' => $existing['full_no'], 'digits' => $existing['digits'], 'state' => 'done'];
      continue;
    }
    if (time() < strtotime("$today $h:00")) {
      $rows[] = ['lot' => $lot, 'h' => $h, 'site' => $host, 'full' => null, 'digits' => null, 'state' => 'wait'];
      continue;
    }
    $html = get($url);
    if ($html === '') {
      $rows[] = ['lot' => $lot, 'h' => $h, 'site' => $host, 'full' => null, 'digits' => null, 'state' => 'err', 'msg' => 'Website did not open'];
      continue;
    }
    $full = ('r_' . $reader)($html, $h);
    if (!$full) {
      $rows[] = ['lot' => $lot, 'h' => $h, 'site' => $host, 'full' => null, 'digits' => null, 'state' => 'miss'];
      continue;
    }
    $digits = substr(preg_replace('/\D/', '', $full), -3);
    if (strlen($digits) !== 3) {
      $rows[] = ['lot' => $lot, 'h' => $h, 'site' => $host, 'full' => $full, 'digits' => null, 'state' => 'err', 'msg' => 'Bad number: ' . $full];
      continue;
    }
    if ($publish) {
      publish($today, $lot, $h, $digits, $full);
      $rows[] = ['lot' => $lot, 'h' => $h, 'site' => $host, 'full' => $full, 'digits' => $digits, 'state' => 'new'];
    } else {
      $rows[] = ['lot' => $lot, 'h' => $h, 'site' => $host, 'full' => $full, 'digits' => $digits, 'state' => 'found'];
    }
  }
  return $rows;
}

// Standalone execution (cPanel Cron Job or test URL)
$cli = PHP_SAPI === 'cli';
$direct_run = $cli || (isset($_SERVER['SCRIPT_FILENAME']) && realpath($_SERVER['SCRIPT_FILENAME']) === realpath(__FILE__));

if ($direct_run) {
  if (!$cli && ($_GET['key'] ?? '') !== FETCH_KEY) { http_response_code(403); exit('no'); }
  $test = !$cli && isset($_GET['test']);
  header('Content-Type: text/plain; charset=utf-8');
  $rows = run_auto_fetch(!$test);
  echo "Auto Results for $day  (" . date('H:i') . ")\n\n";
  foreach ($rows as $r) {
    $name = str_pad($r['lot'] . " " . date('g A', mktime($r['h'], 0)), 16);
    $full = $r['full'] ? "website: {$r['full']} -> {$r['digits']} " : "";
    $msg = isset($r['msg']) ? " ({$r['msg']})" : "";
    echo "{$name} {$full}state: {$r['state']}{$msg}\n";
  }
}
