-- MaKandra — Migration 003: Normalize users table
-- Creates provider_profiles as an extension table that holds only
-- dienstverlener-specific columns, removing the 3NF violation where
-- provider fields (category, hourly_rate, etc.) depend on the role column.
--
-- The users table columns are kept for now to ensure backward compatibility
-- with existing queries. A future migration can DROP them once all queries
-- have been updated to JOIN provider_profiles.
--
--   mysql -u <user> -p makandra < sql/003_normalize_users.sql

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
