<?php
// ===== Lucky3 backend settings: fill these in on your host =====
defined('LUCKY3') or exit;

const DB_HOST = 'localhost';
const DB_NAME = 'lucky3';            // the database name from your hosting panel
const DB_USER = 'lucky3_user';
const DB_PASS = 'change-me';

// Your Vercel app address(es). Only these sites may call the API.
const ALLOWED_ORIGINS = ['https://lucky3.vercel.app', 'http://localhost:5173'];

// Who can open the owner portal and the analytics. Use real email addresses.
const ADMIN_EMAILS   = ['owner@example.com'];
const ANALYST_EMAILS = ['analytics@example.com'];

// Email that sends the login codes (create it in your hosting panel's Email section)
const MAIL_FROM      = 'no-reply@yourdomain-or-subdomain.com';
const MAIL_FROM_NAME = 'Lucky3';

// true = the code is also returned to the app (only for testing!). Set false before going live.
const DEV_SHOW_OTP = true;

// Game rules (must match the app)
const LOTS     = ['Dear' => [13, 18, 20], 'Kerala' => [15], 'Punjab' => [17], 'Sikkim' => [18], 'Goa Queen' => [12, 17, 19]];
const CLOSE    = 180;               // booking closes this many seconds before a draw
const PRICE    = [1 => 12, 2 => 12, 3 => 30];   // Single, Double, Triple ticket price
const WIN      = [1 => 100, 2 => 1000, 3 => 15000];
const WIN_LAST2 = 500;              // Triple: last two digits match
const WIN_LAST1 = 50;               // Triple: last digit matches
const APPROVAL = 15000;             // wins of this size wait for owner approval
const REF_BONUS = 100;              // new player gets this when they use a friend's code
const UPI_ID   = 'yourupi@bank';
const UPI_NAME = 'Lucky3';
