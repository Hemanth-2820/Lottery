-- Lucky3 database. Run this once in phpMyAdmin (Import) or the MySQL console.
SET NAMES utf8mb4;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  role ENUM('player','admin','analyst') NOT NULL DEFAULT 'player',
  wallet DECIMAL(12,2) NOT NULL DEFAULT 0,
  ref_code VARCHAR(10) NOT NULL UNIQUE,
  referred_by INT NULL,
  blocked TINYINT(1) NOT NULL DEFAULT 0,
  block_note VARCHAR(160) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE otps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  attempts TINYINT NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id INT NOT NULL,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- every change to a wallet: recharge, bet, win, bonus
CREATE TABLE txns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type ENUM('recharge','bet','win','bonus','refund','withdraw','adjust') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,          -- + adds to wallet, - takes from it
  ref VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (user_id), INDEX (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE withdrawals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  upi VARCHAR(80) NOT NULL,
  status ENUM('pending','paid','rejected') NOT NULL DEFAULT 'pending',
  utr VARCHAR(40) NULL,
  note VARCHAR(160) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_at DATETIME NULL,
  INDEX (user_id), INDEX (status),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE recharges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  utr VARCHAR(30) NOT NULL UNIQUE,
  paid_to VARCHAR(80) NULL,
  status ENUM('pending','added','rejected') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_at DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- one result per slot: date + lottery + draw hour
CREATE TABLE results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  day DATE NOT NULL,
  lot VARCHAR(20) NOT NULL,
  h TINYINT NOT NULL,
  digits CHAR(3) NOT NULL,
  published_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY slot (day, lot, h)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(16) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  day DATE NOT NULL,
  lot VARCHAR(20) NOT NULL,
  h TINYINT NOT NULL,
  items JSON NOT NULL,                    -- [{pos:"A",v:"3",q:1,price:12}, ...]
  total DECIMAL(12,2) NOT NULL,
  status ENUM('booked','settled') NOT NULL DEFAULT 'booked',
  won DECIMAL(12,2) NOT NULL DEFAULT 0,   -- paid straight to the wallet
  held DECIMAL(12,2) NOT NULL DEFAULT 0,  -- waiting for owner approval
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX slot (day, lot, h), INDEX (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- wins of 15,000 or more wait here for the owner
CREATE TABLE big_wins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  user_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_at DATETIME NULL,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE referrals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  referrer_id INT NOT NULL,
  referee_id INT NOT NULL UNIQUE,         -- a player can use only one code
  bonus DECIMAL(12,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (referrer_id) REFERENCES users(id),
  FOREIGN KEY (referee_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
