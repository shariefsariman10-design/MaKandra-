-- MaKandra — Migration 001
-- Creates the bookings, reviews, and notifications tables that were
-- missing from the original schema.  Safe to re-run (IF NOT EXISTS).
-- Run once against the `makandra` database:
--   mysql -u <user> -p makandra < sql/001_create_missing_tables.sql

-- ── bookings ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id                INT          AUTO_INCREMENT PRIMARY KEY,
  klant_id          INT          NOT NULL,
  dienstverlener_id INT          NOT NULL,
  date              DATE         NOT NULL,
  time              TIME         NULL,
  duration_minutes  INT          NOT NULL DEFAULT 60,
  message           TEXT         NULL,
  status            ENUM('pending','accepted','declined','cancelled')
                                 NOT NULL DEFAULT 'pending',
  created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bk_dv    (dienstverlener_id),
  INDEX idx_bk_klant (klant_id)
);

-- ── reviews ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id          INT       AUTO_INCREMENT PRIMARY KEY,
  reviewer_id INT       NOT NULL,
  provider_id INT       NOT NULL,
  score       INT       NOT NULL,          -- 1–5 stars
  text        TEXT      NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rv_provider (provider_id),
  INDEX idx_rv_reviewer (reviewer_id)
);

-- ── notifications ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         INT          AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  message    TEXT         NOT NULL,
  is_read    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notif_user (user_id)
);

-- ── portfolio ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portfolio (
  id           INT          AUTO_INCREMENT PRIMARY KEY,
  user_id      INT          NOT NULL,
  file_path    VARCHAR(500) NOT NULL,
  file_type    ENUM('image','video') NOT NULL DEFAULT 'image',
  caption      VARCHAR(255) NULL,
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_portfolio_user (user_id)
);

-- ── jobs ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id           INT          AUTO_INCREMENT PRIMARY KEY,
  user_id      INT          NOT NULL,
  title        VARCHAR(255) NOT NULL,
  description  TEXT         NOT NULL,
  category     VARCHAR(100) NOT NULL,
  buurt        VARCHAR(100) NULL,
  status       ENUM('open','in_progress','completed','cancelled')
                           NOT NULL DEFAULT 'open',
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_jobs_user (user_id),
  INDEX idx_jobs_category (category)
);

-- ── messages ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id           INT          AUTO_INCREMENT PRIMARY KEY,
  sender_id    INT          NOT NULL,
  recipient_id INT          NOT NULL,
  message      TEXT         NOT NULL,
  is_read      TINYINT(1)   NOT NULL DEFAULT 0,
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_msg_sender (sender_id),
  INDEX idx_msg_recipient (recipient_id),
  INDEX idx_msg_created (created_at)
);
