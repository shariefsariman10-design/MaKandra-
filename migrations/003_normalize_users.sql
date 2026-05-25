-- MaKandra — Migration 003: Normalize users table
-- Creates provider_profiles as an extension table that holds only
-- dienstverlener-specific columns, removing the 3NF violation where
-- provider fields (category, hourly_rate, etc.) depend on the role column.
--
-- The users table columns are kept for now to ensure backward compatibility
-- with existing queries. A future migration can DROP them once all queries
-- have been updated to JOIN provider_profiles.
--
--   mysql -u <user> -p makandra < migrations/003_normalize_users.sql

-- ── 1. provider_profiles extension table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS provider_profiles (
  user_id       INT            PRIMARY KEY,
  category      VARCHAR(100)   NULL,
  experience    VARCHAR(255)   NULL,
  hourly_rate   DECIMAL(10,2)  NULL,
  phone         VARCHAR(50)    NULL,
  working_hours VARCHAR(500)   NULL,
  is_available  TINYINT(1)     NOT NULL DEFAULT 1,
  CONSTRAINT fk_pp_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- ── 2. Migrate existing provider data ─────────────────────────────────────────
INSERT INTO provider_profiles
    (user_id, category, experience, hourly_rate, phone, working_hours, is_available)
SELECT
    id,
    category,
    experience,
    hourly_rate,
    phone,
    working_hours,
    COALESCE(is_available, 1)
FROM users
WHERE role = 'dienstverlener'
ON DUPLICATE KEY UPDATE
  category      = VALUES(category),
  experience    = VALUES(experience),
  hourly_rate   = VALUES(hourly_rate),
  phone         = VALUES(phone),
  working_hours = VALUES(working_hours),
  is_available  = VALUES(is_available);

-- ── 3. FK constraints on child tables ─────────────────────────────────────────
-- These may fail silently if existing data has orphaned rows; clean up first
-- if needed, then re-run.

ALTER TABLE bookings
  ADD CONSTRAINT fk_bk_klant  FOREIGN KEY (klant_id)          REFERENCES users(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_bk_dv     FOREIGN KEY (dienstverlener_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE reviews
  ADD CONSTRAINT fk_rv_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_rv_provider FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE notifications
  ADD CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE messages
  ADD CONSTRAINT fk_msg_sender   FOREIGN KEY (sender_id)   REFERENCES users(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_msg_receiver FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE;

-- ── 4. Performance indexes ─────────────────────────────────────────────────────
ALTER TABLE users      ADD INDEX idx_users_role  (role);
ALTER TABLE users      ADD INDEX idx_users_email (email);
ALTER TABLE bookings   ADD INDEX idx_bk_status   (status);
ALTER TABLE bookings   ADD INDEX idx_bk_date     (date);
ALTER TABLE reviews    ADD INDEX idx_rv_score    (score);

-- ── 5. Verify ─────────────────────────────────────────────────────────────────
SELECT pp.user_id, u.name, pp.category, pp.hourly_rate, pp.is_available
FROM   provider_profiles pp
JOIN   users u ON u.id = pp.user_id
LIMIT 20;
