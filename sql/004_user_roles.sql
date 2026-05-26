-- MaKandra — Migration 004: User Roles System
-- Creates a dedicated `roles` table and links users via role_id FK.
-- The existing `role` VARCHAR column is kept for backward compatibility.
-- Future: once all code reads from `roles`, the VARCHAR column can be dropped.
--
--   mysql -u <user> -p makandra < sql/004_user_roles.sql

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
