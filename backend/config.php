<?php
// ===== Lucky3 backend settings: fill these in on your host =====
defined('LUCKY3') or exit;

const DB_HOST = 'localhost';
const DB_NAME = 'a177262b_digit';            // the database name from your hosting panel
const DB_USER = 'a177262b_digituser';
const DB_PASS = 'digit@2026';

// Your Vercel app address(es). Only these sites may call the API.
const ALLOWED_ORIGINS = ['https://murugan-vert.vercel.app', 'https://admin-murugan.vercel.app', 'http://localhost:5173', 'http://localhost:5174'];

// Who can open the owner portal and the analytics. Use real email addresses.
const ADMIN_EMAILS     = ['murugan@nexlify.in', 'owner@example.com'];
const ANALYST_EMAILS   = ['murugan@nexlify.in', 'analytics@example.com'];
const ADMIN_PASSWORD   = 'murugan@2026';
const ANALYST_PASSWORD = '';

// Email that sends the login codes
const MAIL_FROM      = 'murugan@api.fashionsnap.in';
const MAIL_FROM_NAME = 'Murugan';
const SMTP_HOST      = 'smtp.gmail.com';
const SMTP_PORT      = 587;
const SMTP_USER      = '';      // leave empty: the server's own mail is used, or fill with Gmail + App Password
const SMTP_PASS      = '';

// false = code only goes by email, never shown on screen
const DEV_SHOW_OTP = false;

// Game rules: the defaults are here. The owner can change them in the admin Settings page,
// which saves them to settings.json next to this file. Anything in settings.json wins.
$S = is_file(__DIR__ . '/settings.json') ? (json_decode((string)file_get_contents(__DIR__ . '/settings.json'), true) ?: []) : [];
define('LOTS',      $S['lots']      ?? ['Dear' => [13, 18, 20], 'Kerala' => [15], 'Punjab' => [17], 'Sikkim' => [18], 'Goa Queen' => [12, 17, 19]]);
define('CLOSE',     $S['close']     ?? 180);                          // booking closes this many seconds before a draw
define('PRICE',     $S['price']     ?? [1 => 12, 2 => 12, 3 => 30]);  // Single, Double, Triple ticket price
define('WIN',       $S['win']       ?? [1 => 100, 2 => 1000, 3 => 15000]);
define('WIN_LAST2', $S['win_last2'] ?? 500);                          // Triple: last two digits match
define('WIN_LAST1', $S['win_last1'] ?? 50);                           // Triple: last digit matches
define('APPROVAL',  $S['approval']  ?? 15000);                        // wins of this size wait for owner approval
define('REF_BONUS', $S['ref_bonus'] ?? 100);                          // new player gets this when they use a friend's code
define('UPI_ID',    $S['upi_id']    ?? 'yourupi@bank');               // <- your real UPI ID
define('UPI_NAME',  $S['upi_name']  ?? 'Murugan');
// several UPI accounts players can choose from when adding money: [{id, name, on}]
define('UPIS', array_values(array_filter($S['upis'] ?? [['id' => UPI_ID, 'name' => UPI_NAME, 'on' => true]], fn($u) => !empty($u['id']))));
unset($S);
