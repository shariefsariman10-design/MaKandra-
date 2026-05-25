-- MaKandra — Migration 001
-- Creates the bookings, reviews, and notifications tables that were
-- missing from the original schema.  Safe to re-run (IF NOT EXISTS).
-- Run once against the `makandra` database:
--   mysql -u <user> -p makandra < migrations/001_create_missing_tables.sql

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
  score       INT       NOT NULL,          -- 1–100 (percentage)
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
