-- MaKandra — Migration 004: User Roles System
-- Creates a dedicated `roles` table and links users via role_id FK.
-- The existing `role` VARCHAR column is kept for backward compatibility.
-- Future: once all code reads from `roles`, the VARCHAR column can be dropped.
--
--   mysql -u <user> -p makandra < migrations/004_user_roles.sql

-- ── 1. roles table ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id          INT          AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(50)  NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- ── 2. Seed initial roles ──────────────────────────────────────────────────────
INSERT IGNORE INTO roles (name, description) VALUES
  ('klant',          'Klant — boekt diensten van dienstverleners'),
  ('dienstverlener', 'Dienstverlener — biedt diensten aan op het platform'),
  ('admin',          'Beheerder — beheert het platform en alle gebruikers');

-- ── 3. Add role_id FK column to users ─────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN role_id INT NULL AFTER role;

ALTER TABLE users
  ADD CONSTRAINT fk_users_role_id
    FOREIGN KEY (role_id) REFERENCES roles(id)
    ON UPDATE CASCADE ON DELETE SET NULL;

-- ── 4. Populate role_id from existing role string ─────────────────────────────
UPDATE users u
JOIN   roles r ON r.name = u.role
SET    u.role_id = r.id
WHERE  u.role_id IS NULL;

-- Map admin users who have is_admin=1 but role='klant'/'dienstverlener' to admin role
-- (optional: only run if you want is_admin=1 to imply admin role)
-- UPDATE users u JOIN roles r ON r.name = 'admin' SET u.role_id = r.id WHERE u.is_admin = 1;

-- ── 5. user_roles pivot table (for future multi-role support) ──────────────────
CREATE TABLE IF NOT EXISTS user_roles (
  user_id    INT NOT NULL,
  role_id    INT NOT NULL,
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id),
  CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES users(id)  ON DELETE CASCADE,
  CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES roles(id)  ON DELETE CASCADE
);

-- Backfill user_roles from users.role_id
INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT id, role_id FROM users WHERE role_id IS NOT NULL;

-- ── 6. Verify ─────────────────────────────────────────────────────────────────
SELECT u.id, u.name, u.role AS role_string, r.name AS role_from_table
FROM   users u
LEFT JOIN roles r ON r.id = u.role_id
LIMIT 20;
