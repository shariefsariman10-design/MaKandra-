-- MaKandra — Migration 002: Separate first_name / last_name
-- Run once against the `makandra` database.
-- Safe: only updates rows where first_name is still NULL.
--
--   mysql -u <user> -p makandra < migrations/002_separate_names.sql

-- 1. Add new columns (error if they already exist — run idempotently via server.js startup)
ALTER TABLE users
  ADD COLUMN first_name VARCHAR(100) NULL AFTER name,
  ADD COLUMN last_name  VARCHAR(100) NULL AFTER first_name;

-- 2. Populate first_name / last_name from the combined name column
--    first_name = everything up to and including the first space-delimited word
--    last_name  = remainder (NULL when there is no surname)
UPDATE users
SET
  first_name = TRIM(SUBSTRING_INDEX(name, ' ', 1)),
  last_name  = NULLIF(
                 TRIM(SUBSTRING(name, CHAR_LENGTH(SUBSTRING_INDEX(name, ' ', 1)) + 2)),
                 ''
               )
WHERE first_name IS NULL;

-- 3. Verify
SELECT id, name, first_name, last_name FROM users LIMIT 20;
