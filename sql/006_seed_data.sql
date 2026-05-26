-- MaKandra — Seed Data
-- This file contains sample data for testing and demonstration.
-- Run this after the schema is initialized:
--
--   mysql -u <user> -p makandra < sql/006_seed_data.sql

-- ── Seed roles ─────────────────────────────────────────────────────────────────
INSERT IGNORE INTO roles (name, description) VALUES
  ('klant',          'Klant — boekt diensten van dienstverleners'),
  ('dienstverlener', 'Dienstverlener — biedt diensten aan op het platform'),
  ('admin',          'Beheerder — beheert het platform en alle gebruikers');

-- ── Seed sample users (passwords are hashed with bcrypt, these are demo accounts) ──
-- Note: In production, use bcryptjs to hash passwords before insertion
INSERT IGNORE INTO users (name, first_name, last_name, email, password, role, role_id, buurt, category, experience, bio, hourly_rate, phone, working_hours, profile_picture, email_verified, is_admin) VALUES
  ('Pieter de Schilder', 'Pieter', 'Schilder', 'pieter@makandra.nl', '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890', 'dienstverlener', 2, 'Amsterdam', 'Schilderwerk', '10 jaar', 'Professioneel schilder met 10 jaar ervaring', 45.00, '06-12345678', 'Ma-Vr 08:00-17:00', '/public/img/avatar-1.jpg', 1, 0),
  ('Jaap Timmerman', 'Jaap', 'Timmerman', 'jaap@makandra.nl', '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890', 'dienstverlener', 2, 'Amsterdam', 'Timmerwerk', '15 jaar', 'Expert timmerwerk, duurzaam materiaal', 50.00, '06-87654321', 'Ma-Vr 07:00-16:00', '/public/img/avatar-2.jpg', 1, 0),
  ('Sofia Schoonmaken', 'Sofia', 'Schoonmaken', 'sofia@makandra.nl', '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890', 'dienstverlener', 2, 'Rotterdam', 'Schoonmaak', '5 jaar', 'Grondige en betrouwbare schoonmaak', 25.00, '06-55555555', 'Ma-Vr 09:00-17:00', '/public/img/avatar-3.jpg', 1, 0),
  ('Marieke Klant1', 'Marieke', 'Klant1', 'marieke@example.com', '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890', 'klant', 1, 'Amsterdam', NULL, NULL, 'Op zoek naar betrouwbare diensten', NULL, NULL, NULL, '/public/img/avatar-4.jpg', 1, 0),
  ('Henk Admin', 'Henk', 'Admin', 'admin@makandra.nl', '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890', 'admin', 3, 'Amsterdam', NULL, NULL, 'Platform administrator', NULL, NULL, NULL, NULL, 1, 1),
  ('Carola Hoveniers', 'Carola', 'Hoveniers', 'carola@makandra.nl', '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890', 'dienstverlener', 2, 'Amsterdam', 'Hovenierwerk', '8 jaar', 'Specialisme: tuinaanleg en onderhoud', 40.00, '06-99999999', 'Di-Vr 10:00-16:00', '/public/img/avatar-5.jpg', 1, 0);

-- ── Seed provider profiles ────────────────────────────────────────────────────────
INSERT IGNORE INTO provider_profiles (user_id, category, experience, hourly_rate, phone, working_hours, is_available) VALUES
  (1, 'Schilderwerk', '10 jaar', 45.00, '06-12345678', 'Ma-Vr 08:00-17:00', 1),
  (2, 'Timmerwerk', '15 jaar', 50.00, '06-87654321', 'Ma-Vr 07:00-16:00', 1),
  (3, 'Schoonmaak', '5 jaar', 25.00, '06-55555555', 'Ma-Vr 09:00-17:00', 1),
  (6, 'Hovenierwerk', '8 jaar', 40.00, '06-99999999', 'Di-Vr 10:00-16:00', 1);

-- ── Seed sample bookings ───────────────────────────────────────────────────────
INSERT IGNORE INTO bookings (klant_id, dienstverlener_id, date, time, duration_minutes, message, status) VALUES
  (4, 1, DATE_ADD(CURDATE(), INTERVAL 7 DAY), '10:00:00', 240, 'Schilderwerk woonkamer', 'pending'),
  (4, 2, DATE_ADD(CURDATE(), INTERVAL 14 DAY), '09:00:00', 480, 'Boekenkast reparatie', 'accepted'),
  (4, 3, DATE_ADD(CURDATE(), INTERVAL 3 DAY), '14:00:00', 120, 'Huisschoonmaak', 'pending');

-- ── Seed sample reviews ────────────────────────────────────────────────────────
INSERT IGNORE INTO reviews (reviewer_id, provider_id, score, text) VALUES
  (4, 1, 5, 'Uitstekend werk! Pieter is professioneel en schoon. Zeer tevreden!'),
  (4, 2, 4, 'Goed timmerwerk. Project is op tijd afgerond.');

-- ── Seed sample notifications ─────────────────────────────────────────────────
INSERT IGNORE INTO notifications (user_id, message, is_read) VALUES
  (1, 'Nieuwe boeking aanvraag van Marieke', 0),
  (2, 'Je boeking is geaccepteerd!', 1),
  (4, 'Je review is geplaatst', 1);

-- ── Seed sample jobs ──────────────────────────────────────────────────────────
INSERT IGNORE INTO jobs (user_id, title, description, category, buurt, status) VALUES
  (4, 'Badkamer renovatie', 'Zoek professionele hulp bij badkamer renovatie. Budget €5000.', 'Badkamer', 'Amsterdam', 'open'),
  (4, 'Huis schilderen', 'Voor- en achtergevel nodig schildering. 3 kamers binnenin.', 'Schilderwerk', 'Amsterdam', 'open');

-- ── Verify data ────────────────────────────────────────────────────────────────
SELECT 'Roles:' as section, COUNT(*) FROM roles
UNION ALL
SELECT 'Users:', COUNT(*) FROM users
UNION ALL
SELECT 'Provider Profiles:', COUNT(*) FROM provider_profiles
UNION ALL
SELECT 'Bookings:', COUNT(*) FROM bookings
UNION ALL
SELECT 'Reviews:', COUNT(*) FROM reviews
UNION ALL
SELECT 'Notifications:', COUNT(*) FROM notifications
UNION ALL
SELECT 'Jobs:', COUNT(*) FROM jobs;
