import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import 'dotenv/config';

import { db } from './config/db.js';
import { notFound }     from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';

import authRoutes          from './routes/auth.js';
import userRoutes          from './routes/users.js';
import providerRoutes      from './routes/providers.js';
import bookingRoutes       from './routes/bookings.js';
import messageRoutes       from './routes/messages.js';
import notificationRoutes  from './routes/notifications.js';
import reviewRoutes        from './routes/reviews.js';
import uploadRoutes        from './routes/upload.js';
import adminRoutes         from './routes/admin.js';
import jobRoutes           from './routes/jobs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Ensure uploads directory exists ──────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory:', uploadsDir);
}

// ── App setup ─────────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/',       authRoutes);
app.use('/',       userRoutes);
app.use('/',       providerRoutes);
app.use('/',       bookingRoutes);
app.use('/',       messageRoutes);
app.use('/',       notificationRoutes);
app.use('/',       reviewRoutes);
app.use('/',       uploadRoutes);
app.use('/admin',  adminRoutes);
app.use('/',       jobRoutes);

// ── Error handlers (must be last) ────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── DB INIT — runs fully before server starts ─────────────────────────────────
(async () => {
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS bookings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      klant_id INT NOT NULL,
      dienstverlener_id INT NOT NULL,
      date DATE NOT NULL,
      time TIME NULL,
      duration_minutes INT NOT NULL DEFAULT 60,
      message TEXT NULL,
      status ENUM('pending','accepted','declined','cancelled') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_bk_dv   (dienstverlener_id),
      INDEX idx_bk_klant (klant_id)
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS reviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      reviewer_id INT NOT NULL,
      provider_id INT NOT NULL,
      score INT NOT NULL,
      text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_rv_provider (provider_id),
      INDEX idx_rv_reviewer (reviewer_id)
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      message TEXT NOT NULL,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_notif_user (user_id)
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS portfolio (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      file_type ENUM('image','video') NOT NULL DEFAULT 'image',
      caption VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sender_id INT NOT NULL,
      receiver_id INT NOT NULL,
      message TEXT NOT NULL,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_chat (sender_id, receiver_id)
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS jobs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      klant_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(100) NOT NULL,
      buurt VARCHAR(100),
      budget VARCHAR(100),
      date_needed DATE,
      status ENUM('open','closed') NOT NULL DEFAULT 'open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS job_responses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      job_id INT NOT NULL,
      dienstverlener_id INT NOT NULL,
      message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS roles (
      id          INT          AUTO_INCREMENT PRIMARY KEY,
      name        VARCHAR(50)  NOT NULL UNIQUE,
      description VARCHAR(255) NULL,
      created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.query(`INSERT IGNORE INTO roles (name, description) VALUES
      ('klant',          'Klant — boekt diensten van dienstverleners'),
      ('dienstverlener', 'Dienstverlener — biedt diensten aan op het platform'),
      ('admin',          'Beheerder — beheert het platform en alle gebruikers')`);

    await db.query(`CREATE TABLE IF NOT EXISTS user_roles (
      user_id    INT NOT NULL,
      role_id    INT NOT NULL,
      granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, role_id)
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS provider_profiles (
      user_id       INT            PRIMARY KEY,
      category      VARCHAR(100)   NULL,
      experience    VARCHAR(255)   NULL,
      hourly_rate   DECIMAL(10,2)  NULL,
      phone         VARCHAR(50)    NULL,
      working_hours VARCHAR(500)   NULL,
      is_available  TINYINT(1)     NOT NULL DEFAULT 1
    )`);

    const alterCols = [
      'ALTER TABLE users ADD COLUMN dnd_mode           TINYINT(1)   NOT NULL DEFAULT 0',
      'ALTER TABLE users ADD COLUMN is_available        TINYINT(1)   NOT NULL DEFAULT 1',
      'ALTER TABLE users ADD COLUMN email_verified     TINYINT(1)   NOT NULL DEFAULT 1',
      'ALTER TABLE users ADD COLUMN verification_token  VARCHAR(64)  NULL',
      'ALTER TABLE users ADD COLUMN is_admin            TINYINT(1)   NOT NULL DEFAULT 0',
      'ALTER TABLE users ADD COLUMN pw_change_token     VARCHAR(64)  NULL',
      'ALTER TABLE users ADD COLUMN pw_change_hash      VARCHAR(255) NULL',
      'ALTER TABLE users ADD COLUMN pw_change_expires   DATETIME     NULL',
      'ALTER TABLE users ADD COLUMN first_name          VARCHAR(100) NULL AFTER name',
      'ALTER TABLE users ADD COLUMN last_name           VARCHAR(100) NULL AFTER first_name',
      'ALTER TABLE users ADD COLUMN role_id             INT NULL',
    ];
    for (const sql of alterCols) {
      try { await db.query(sql); } catch { /* column already exists — skip */ }
    }

    try { await db.query('UPDATE users SET email_verified = 1 WHERE email_verified IS NULL OR email_verified = 0'); } catch { /* skip */ }
    try {
      await db.query(`UPDATE users
        SET first_name = TRIM(SUBSTRING_INDEX(name, ' ', 1)),
            last_name  = NULLIF(TRIM(SUBSTRING(name, CHAR_LENGTH(SUBSTRING_INDEX(name, ' ', 1)) + 2)), '')
        WHERE first_name IS NULL AND name IS NOT NULL AND name != ''`);
    } catch { /* skip */ }
    try {
      await db.query(`UPDATE users u JOIN roles r ON r.name = u.role SET u.role_id = r.id WHERE u.role_id IS NULL`);
    } catch { /* skip */ }
    try {
      await db.query(`INSERT INTO provider_profiles
          (user_id, category, experience, hourly_rate, phone, working_hours, is_available)
        SELECT id, category, experience, hourly_rate, phone, working_hours, COALESCE(is_available, 1)
        FROM users WHERE role = 'dienstverlener'
        ON DUPLICATE KEY UPDATE
          category=VALUES(category), experience=VALUES(experience),
          hourly_rate=VALUES(hourly_rate), phone=VALUES(phone),
          working_hours=VALUES(working_hours), is_available=VALUES(is_available)`);
    } catch { /* skip */ }

    console.log('DB init complete — server starting.');
  } catch (e) {
    console.error('DB init error:', e.message);
  }

  app.listen(3000, () => console.log('Server running on http://localhost:3000'));
})();
