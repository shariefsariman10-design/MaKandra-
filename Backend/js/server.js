import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';
import { db } from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Ensure uploads directory exists ──────────────────────────────────────────
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory:', uploadsDir);
}

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename:    (req, file, cb) => cb(null, 'avatar-' + req.params.id + path.extname(file.originalname)),
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  cb(null, /image\/(jpeg|png|webp|gif)/.test(file.mimetype));
}});

// ─────────────────────────────────────────
// EMAIL SERVICE
// ─────────────────────────────────────────

const mailer = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendEmail(to, subject, html) {
  if (!process.env.SMTP_USER || process.env.SMTP_USER === 'your-email@gmail.com') {
    console.log('[EMAIL] SMTP not configured — skipping send to', to, '| Subject:', subject);
    return;
  }
  await mailer.sendMail({ from: process.env.FROM_EMAIL || process.env.SMTP_USER, to, subject, html });
}

const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:5500';

function genToken() { return crypto.randomBytes(32).toString('hex'); }

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

// ─────────────────────────────────────────
// ADMIN MIDDLEWARE
// ─────────────────────────────────────────

async function requireAdmin(req, res, next) {
  const userId = req.headers['x-user-id'] || req.body?.requesterId;
  if (!userId) return res.status(401).json({ error: 'Niet gemachtigd.' });
  const [rows] = await db.query('SELECT is_admin FROM users WHERE id = ?', [userId]);
  if (!rows.length || !rows[0].is_admin) return res.status(403).json({ error: 'Geen beheerdersrechten.' });
  req.adminId = userId;
  next();
}

// ─────────────────────────────────────────
// HELPERS — USER PAYLOAD
// ─────────────────────────────────────────

/** Consistent user shape returned by signup & login. */
function buildUserPayload(u) {
  return {
    id:            u.id,
    name:          u.name,
    first_name:    u.first_name  || null,
    last_name:     u.last_name   || null,
    email:         u.email,
    role:          u.role,
    role_id:       u.role_id     || null,
    buurt:         u.buurt,
    category:      u.category    || null,
    experience:    u.experience  || null,
    bio:           u.bio         || null,
    hourly_rate:   u.hourly_rate || null,
    phone:         u.phone       || null,
    working_hours: u.working_hours || null,
    profile_picture: u.profile_picture || null,
    is_available:  u.is_available ?? 1,
    is_admin:      u.is_admin    || 0,
  };
}

// ─────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────

// SIGNUP
app.post('/signup', async (req, res) => {
  try {
    const {
      first_name, last_name,
      name: rawName,                 // legacy: combined name from old clients
      email, password, role, buurt,
      category, experience, bio, hourly_rate, phone, working_hours,
    } = req.body;

    // Accept either separate names (new) or a combined name (old clients)
    const fn = (first_name || '').trim();
    const ln = (last_name  || '').trim();
    const displayName = fn
      ? (ln ? fn + ' ' + ln : fn)
      : (rawName || '').trim();

    if (!displayName)              return res.status(400).json({ error: 'Naam is verplicht.' });
    if (!email)                    return res.status(400).json({ error: 'E-mailadres is verplicht.' });
    if (!isValidEmail(email))      return res.status(400).json({ error: 'Voer een geldig e-mailadres in.' });
    if (!password)                 return res.status(400).json({ error: 'Wachtwoord is verplicht.' });
    if (password.length < 6)       return res.status(400).json({ error: 'Wachtwoord moet minimaal 6 tekens zijn.' });
    if (!role)                     return res.status(400).json({ error: 'Rol is verplicht.' });
    if (!buurt)                    return res.status(400).json({ error: 'District is verplicht.' });

    const hashed = await bcrypt.hash(password, 10);

    // Resolve role_id from roles table (gracefully null if table not yet seeded)
    let roleId = null;
    try {
      const [roleRows] = await db.query('SELECT id FROM roles WHERE name = ?', [role]);
      roleId = roleRows.length ? roleRows[0].id : null;
    } catch { /* roles table may not exist yet on very first boot — skip */ }

    const [result] = await db.query(
      `INSERT INTO users
         (name, first_name, last_name, email, password, role, role_id,
          buurt, category, experience, bio, hourly_rate, phone, working_hours)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        displayName,
        fn || null, ln || null,
        email.toLowerCase(), hashed, role, roleId,
        buurt,
        category || null, experience || null, bio || null,
        (parseFloat(hourly_rate) || null), phone || null, working_hours || null,
      ]
    );

    // Sync provider_profiles for dienstverleners (gracefully skip if table missing)
    if (role === 'dienstverlener') {
      try {
        await db.query(
          `INSERT INTO provider_profiles
             (user_id, category, experience, hourly_rate, phone, working_hours, is_available)
           VALUES (?, ?, ?, ?, ?, ?, 1)
           ON DUPLICATE KEY UPDATE
             category = VALUES(category), experience = VALUES(experience),
             hourly_rate = VALUES(hourly_rate), phone = VALUES(phone),
             working_hours = VALUES(working_hours)`,
          [result.insertId, category || null, experience || null,
           parseFloat(hourly_rate) || null, phone || null, working_hours || null]
        );
      } catch { /* provider_profiles table may not exist yet — skip */ }
    }

    // Welcome e-mail
    await sendEmail(
      email,
      'Welkom bij MaKandra!',
      `<h2>Welkom bij MaKandra, ${displayName}!</h2>
       <p>Je account is succesvol aangemaakt. Je kunt nu direct inloggen.</p>
       <p style="color:#aaa;font-size:.8rem">Als je dit account niet hebt aangemaakt, neem dan contact met ons op.</p>`
    );

    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    const u = rows[0];
    res.status(201).json({
      message: 'Account aangemaakt!',
      user: buildUserPayload(u),
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Dit e-mailadres is al in gebruik.' });
    } else {
      console.error('SIGNUP ERROR:', err.message);
      res.status(500).json({ error: 'Er is een serverfout opgetreden.' });
    }
  }
});

// VERIFY EMAIL
app.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).send(htmlPage('Ongeldige link', 'De verificatielink is ongeldig.', false));

    const [rows] = await db.query('SELECT id, name FROM users WHERE verification_token = ?', [token]);
    if (!rows.length) return res.status(400).send(htmlPage('Link verlopen', 'Deze verificatielink is al gebruikt of ongeldig.', false));

    await db.query('UPDATE users SET email_verified = 1, verification_token = NULL WHERE id = ?', [rows[0].id]);
    res.send(htmlPage('E-mail bevestigd!', `Welkom, ${rows[0].name}! Je account is geactiveerd. Je kunt nu inloggen.`, true));
  } catch (err) {
    res.status(500).send(htmlPage('Fout', 'Er is een fout opgetreden.', false));
  }
});

// RESEND VERIFICATION EMAIL
app.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'E-mailadres is verplicht.' });

    const [rows] = await db.query('SELECT id, name, email_verified FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!rows.length) return res.status(404).json({ error: 'E-mailadres niet gevonden.' });
    if (rows[0].email_verified) return res.status(400).json({ error: 'Dit account is al geverifieerd.' });

    const newToken = genToken();
    await db.query('UPDATE users SET verification_token = ? WHERE id = ?', [newToken, rows[0].id]);

    const verifyLink = `${process.env.BACKEND_URL || 'http://localhost:3000'}/verify-email?token=${newToken}`;
    await sendEmail(
      email,
      'Nieuwe verificatielink — MaKandra',
      `<h2>Bevestig je e-mailadres</h2>
       <p>Klik op de knop hieronder om je e-mailadres te bevestigen.</p>
       <a href="${verifyLink}" style="display:inline-block;background:#6c47ff;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">E-mailadres bevestigen</a>`
    );
    res.json({ message: 'Verificatiemail opnieuw verstuurd. Controleer je inbox.' });
  } catch (err) {
    res.status(500).json({ error: 'Er is een fout opgetreden.' });
  }
});

// LOGIN
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email)    return res.status(400).json({ error: 'E-mailadres is verplicht.' });
    if (!password) return res.status(400).json({ error: 'Wachtwoord is verplicht.' });

    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Verkeerd e-mailadres of wachtwoord.' });
    }
    const valid = await bcrypt.compare(password, rows[0].password);
    if (!valid) {
      return res.status(401).json({ error: 'Verkeerd e-mailadres of wachtwoord.' });
    }
    const user = rows[0];
    res.json({ message: 'Ingelogd!', user: buildUserPayload(user) });
  } catch (err) {
    res.status(500).json({ error: 'Er is een serverfout opgetreden.' });
  }
});

// ─────────────────────────────────────────
// USERS
// ─────────────────────────────────────────

// GET all users (admin use)
app.get('/users', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, role, buurt, created_at FROM users'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET platform stats
app.get('/stats', async (req, res) => {
  try {
    const [[{ dv_count }]]       = await db.query("SELECT COUNT(*) AS dv_count FROM users WHERE role = 'dienstverlener'");
    const [[{ voltooid_count }]] = await db.query("SELECT COUNT(*) AS voltooid_count FROM bookings WHERE status = 'accepted'");
    res.json({ dv_count, voltooid_count });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET categories with provider count + booking count, sorted by bookings
app.get('/categories', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.category,
              COUNT(DISTINCT u.id)  AS provider_count,
              COUNT(DISTINCT b.id)  AS booking_count,
              COUNT(DISTINCT j.id)  AS job_count
       FROM users u
       LEFT JOIN bookings b ON b.dienstverlener_id = u.id
       LEFT JOIN jobs j ON j.category = u.category AND j.status = 'open'
       WHERE u.role = 'dienstverlener' AND u.category IS NOT NULL AND u.category != ''
       GROUP BY u.category
       ORDER BY booking_count DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET dienstverleners (with optional buurt filter)
// Returns avg_score (Beoordelingsscore), vertrouwenscore, and total_clients.
//
// Vertrouwenscore formula:
//   VS = MIN(100, MIN(60, total_clients × 3) + MIN(40, total_reviews × 4))
//   • 60 pts max from clients (20 clients = full client share)
//   • 40 pts max from reviews (10 reviews = full review share)
app.get('/dienstverleners', async (req, res) => {
  try {
    const { buurt } = req.query;
    let query = `
      SELECT u.id, u.name, u.first_name, u.last_name,
             u.email, u.category, u.experience, u.bio, u.hourly_rate, u.buurt,
             u.profile_picture, u.phone, u.working_hours, u.is_available,
             ROUND(AVG(r.score), 1)      AS avg_score,
             COUNT(DISTINCT r.id)        AS review_count,
             COALESCE((
               SELECT COUNT(DISTINCT b.klant_id)
               FROM bookings b
               WHERE b.dienstverlener_id = u.id AND b.status = 'accepted'
             ), 0)                       AS total_clients,
             LEAST(100, ROUND(
               LEAST(60, COALESCE((
                 SELECT COUNT(DISTINCT b2.klant_id)
                 FROM bookings b2
                 WHERE b2.dienstverlener_id = u.id AND b2.status = 'accepted'
               ), 0) * 3) +
               LEAST(40, COUNT(DISTINCT r.id) * 4)
             ))                          AS vertrouwenscore
      FROM users u
      LEFT JOIN reviews r ON r.provider_id = u.id
      WHERE u.role = ?`;
    const params = ['dienstverlener'];
    if (buurt) {
      query += ' AND u.buurt = ?';
      params.push(buurt);
    }
    query += ' GROUP BY u.id';
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE dienstverlener profile (name / first_name / last_name, category, experience, …)
app.put('/profile/:id', async (req, res) => {
  try {
    const { first_name, last_name, name: rawName, category, experience, bio, hourly_rate, buurt, phone, working_hours } = req.body;

    const fn = (first_name || '').trim();
    const ln = (last_name  || '').trim();
    const displayName = fn ? (ln ? fn + ' ' + ln : fn) : (rawName || '').trim();

    if (!displayName) return res.status(400).json({ error: 'Naam is verplicht.' });

    await db.query(
      'UPDATE users SET name=?, first_name=?, last_name=?, category=?, experience=?, bio=?, hourly_rate=?, buurt=?, phone=?, working_hours=? WHERE id=?',
      [displayName, fn || null, ln || null, category, experience, bio,
       (parseFloat(hourly_rate) || null), buurt, phone || null, working_hours || null, req.params.id]
    );

    // Keep provider_profiles in sync
    try {
      await db.query(
        `INSERT INTO provider_profiles (user_id, category, experience, hourly_rate, phone, working_hours)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           category=VALUES(category), experience=VALUES(experience),
           hourly_rate=VALUES(hourly_rate), phone=VALUES(phone), working_hours=VALUES(working_hours)`,
        [req.params.id, category, experience, parseFloat(hourly_rate) || null, phone || null, working_hours || null]
      );
    } catch { /* provider_profiles may not exist yet — skip */ }

    res.json({ message: 'Profiel bijgewerkt!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE klant profile (name / first_name / last_name + bio)
app.put('/klant-profile/:id', async (req, res) => {
  try {
    const { first_name, last_name, name: rawName, bio } = req.body;

    const fn = (first_name || '').trim();
    const ln = (last_name  || '').trim();
    const displayName = fn ? (ln ? fn + ' ' + ln : fn) : (rawName || '').trim();

    if (!displayName) return res.status(400).json({ error: 'Naam is verplicht.' });

    await db.query(
      'UPDATE users SET name=?, first_name=?, last_name=?, bio=? WHERE id=?',
      [displayName, fn || null, ln || null, bio || null, req.params.id]
    );
    res.json({ message: 'Profiel bijgewerkt!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE name only (for klanten) — kept for compatibility
app.put('/update-name/:id', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Naam is verplicht.' });
    await db.query('UPDATE users SET name=? WHERE id=?', [name.trim(), req.params.id]);
    res.json({ message: 'Naam bijgewerkt!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE account settings (email, buurt) — requires current password
app.put('/account/:id', async (req, res) => {
  try {
    const { current_password, email, buurt } = req.body;
    if (!email && !buurt) return res.status(400).json({ error: 'Niets om bij te werken.' });
    if (email && !current_password) return res.status(400).json({ error: 'Huidig wachtwoord is verplicht om je e-mailadres te wijzigen.' });

    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Gebruiker niet gevonden.' });

    if (email) {
      const valid = await bcrypt.compare(current_password, rows[0].password);
      if (!valid) return res.status(401).json({ error: 'Huidig wachtwoord is onjuist.' });
    }

    const updates = [];
    const params  = [];

    if (email) {
      if (!isValidEmail(email)) return res.status(400).json({ error: 'Voer een geldig e-mailadres in.' });
      updates.push('email = ?');
      params.push(email.toLowerCase());
    }
    if (buurt) {
      updates.push('buurt = ?');
      params.push(buurt);
    }

    if (!updates.length) return res.status(400).json({ error: 'Niets om bij te werken.' });

    params.push(req.params.id);
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ message: 'Account bijgewerkt!' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Dit e-mailadres is al in gebruik.' });
    } else {
      res.status(500).json({ error: 'Er is een serverfout opgetreden.' });
    }
  }
});

// ─────────────────────────────────────────
// PASSWORD CHANGE WITH EMAIL CONFIRMATION
// ─────────────────────────────────────────

// Step 1: Request password change (verifies current pw, sends confirmation email)
app.post('/change-password/request', async (req, res) => {
  try {
    const { user_id, current_password, new_password } = req.body;
    if (!user_id || !current_password || !new_password) {
      return res.status(400).json({ error: 'Alle velden zijn verplicht.' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'Nieuw wachtwoord moet minimaal 6 tekens zijn.' });
    }

    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [user_id]);
    if (!rows.length) return res.status(404).json({ error: 'Gebruiker niet gevonden.' });

    const valid = await bcrypt.compare(current_password, rows[0].password);
    if (!valid) return res.status(401).json({ error: 'Huidig wachtwoord is onjuist.' });

    const token      = genToken();
    const newHash    = await bcrypt.hash(new_password, 10);
    const expiresAt  = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await db.query(
      'UPDATE users SET pw_change_token=?, pw_change_hash=?, pw_change_expires=? WHERE id=?',
      [token, newHash, expiresAt, user_id]
    );

    const confirmLink = `${process.env.BACKEND_URL || 'http://localhost:3000'}/change-password/confirm?token=${token}`;
    await sendEmail(
      rows[0].email,
      'Bevestig wachtwoordwijziging — MaKandra',
      `<h2>Wachtwoord wijzigen</h2>
       <p>Er is een verzoek ingediend om je wachtwoord te wijzigen. Klik op de knop om dit te bevestigen.</p>
       <a href="${confirmLink}" style="display:inline-block;background:#6c47ff;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">Wachtwoord bevestigen</a>
       <p style="color:#888;font-size:.9rem">Deze link vervalt over 30 minuten.</p>
       <p style="color:#aaa;font-size:.8rem">Als je dit verzoek niet hebt gedaan, kun je deze e-mail negeren. Je wachtwoord blijft ongewijzigd.</p>`
    );
    res.json({ message: 'Bevestigingsmail verstuurd. Controleer je inbox om de wachtwoordwijziging te voltooien.' });
  } catch (err) {
    res.status(500).json({ error: 'Er is een fout opgetreden.' });
  }
});

// Step 2: Confirm password change via token link
app.get('/change-password/confirm', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.send(htmlPage('Ongeldige link', 'De link is ongeldig.', false));

    const [rows] = await db.query(
      'SELECT id, pw_change_hash, pw_change_expires FROM users WHERE pw_change_token = ?',
      [token]
    );
    if (!rows.length) return res.send(htmlPage('Link ongeldig', 'Deze link is al gebruikt of ongeldig.', false));

    const expired = rows[0].pw_change_expires && new Date() > new Date(rows[0].pw_change_expires);
    if (expired) return res.send(htmlPage('Link verlopen', 'De bevestigingslink is verlopen. Vraag een nieuwe aan.', false));

    await db.query(
      'UPDATE users SET password=?, pw_change_token=NULL, pw_change_hash=NULL, pw_change_expires=NULL WHERE id=?',
      [rows[0].pw_change_hash, rows[0].id]
    );
    res.send(htmlPage('Wachtwoord gewijzigd!', 'Je wachtwoord is succesvol bijgewerkt. Je kunt nu inloggen met je nieuwe wachtwoord.', true));
  } catch (err) {
    res.send(htmlPage('Fout', 'Er is een fout opgetreden.', false));
  }
});

// FORGOT PASSWORD — send reset link
app.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'E-mailadres is verplicht.' });

    const [rows] = await db.query('SELECT id, name FROM users WHERE email = ?', [email.toLowerCase()]);
    // Always return success to prevent email enumeration
    if (!rows.length) return res.json({ message: 'Als dit e-mailadres bekend is, ontvang je een herstelmail.' });

    const token     = genToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await db.query('UPDATE users SET pw_change_token=?, pw_change_expires=? WHERE id=?', [token, expiresAt, rows[0].id]);

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5500'}?reset_token=${token}`;
    await sendEmail(
      email,
      'Wachtwoord herstellen — MaKandra',
      `<h2>Wachtwoord herstellen</h2>
       <p>Hallo ${rows[0].name}, klik op de knop hieronder om je wachtwoord te herstellen.</p>
       <a href="${resetLink}" style="display:inline-block;background:#6c47ff;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">Wachtwoord herstellen</a>
       <p style="color:#888;font-size:.9rem">Deze link is 1 uur geldig.</p>
       <p style="color:#aaa;font-size:.8rem">Heb je dit niet aangevraagd? Dan hoef je niets te doen.</p>`
    );
    res.json({ message: 'Als dit e-mailadres bekend is, ontvang je een herstelmail.' });
  } catch (err) {
    res.status(500).json({ error: 'Er is een fout opgetreden.' });
  }
});

// RESET PASSWORD — apply new password via token
app.post('/reset-password', async (req, res) => {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password) return res.status(400).json({ error: 'Token en wachtwoord zijn verplicht.' });
    if (new_password.length < 6) return res.status(400).json({ error: 'Wachtwoord moet minimaal 6 tekens zijn.' });

    const [rows] = await db.query('SELECT id, pw_change_expires FROM users WHERE pw_change_token = ?', [token]);
    if (!rows.length) return res.status(400).json({ error: 'Ongeldige of verlopen link.' });

    if (rows[0].pw_change_expires && new Date() > new Date(rows[0].pw_change_expires)) {
      return res.status(400).json({ error: 'De link is verlopen. Vraag een nieuwe herstelmail aan.' });
    }

    const hashed = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password=?, pw_change_token=NULL, pw_change_expires=NULL WHERE id=?', [hashed, rows[0].id]);
    res.json({ message: 'Wachtwoord succesvol gewijzigd! Je kunt nu inloggen.' });
  } catch (err) {
    res.status(500).json({ error: 'Er is een fout opgetreden.' });
  }
});

// ─────────────────────────────────────────
// ADMIN ENDPOINTS
// ─────────────────────────────────────────

// Create/promote first admin (protected by ADMIN_SECRET header)
app.post('/admin/promote', async (req, res) => {
  try {
    const secret = req.headers['x-admin-secret'];
    if (!secret || secret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Ongeldig beheerderswachtwoord.' });
    }
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'E-mailadres is verplicht.' });

    const [rows] = await db.query('SELECT id, name FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!rows.length) return res.status(404).json({ error: 'Gebruiker niet gevonden.' });

    await db.query('UPDATE users SET is_admin = 1, email_verified = 1 WHERE id = ?', [rows[0].id]);
    res.json({ message: `${rows[0].name} is nu beheerder.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all users — admin only
app.get('/admin/users', requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, name, email, role, buurt, email_verified, is_admin, created_at FROM users ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET admin dashboard stats
app.get('/admin/stats', requireAdmin, async (req, res) => {
  try {
    const [[{ total_users }]]   = await db.query('SELECT COUNT(*) AS total_users FROM users');
    const [[{ total_klanten }]] = await db.query("SELECT COUNT(*) AS total_klanten FROM users WHERE role = 'klant'");
    const [[{ total_dv }]]      = await db.query("SELECT COUNT(*) AS total_dv FROM users WHERE role = 'dienstverlener'");
    const [[{ total_bookings }]]= await db.query('SELECT COUNT(*) AS total_bookings FROM bookings');
    const [[{ total_jobs }]]    = await db.query('SELECT COUNT(*) AS total_jobs FROM jobs');
    const [[{ unverified }]]    = await db.query('SELECT COUNT(*) AS unverified FROM users WHERE email_verified = 0');
    res.json({ total_users, total_klanten, total_dv, total_bookings, total_jobs, unverified });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE user — admin only
app.delete('/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    if (req.params.id == req.adminId) return res.status(400).json({ error: 'Je kunt je eigen account niet verwijderen.' });
    await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'Gebruiker verwijderd.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// BOOKINGS
// ─────────────────────────────────────────

// CREATE booking (with time + duration)
app.post('/bookings', async (req, res) => {
  try {
    const { klant_id, dienstverlener_id, date, time, duration_minutes, message } = req.body;

    if (!klant_id || !dienstverlener_id || !date) {
      return res.status(400).json({ error: 'Klant, dienstverlener en datum zijn verplicht.' });
    }

    await db.query(
      'INSERT INTO bookings (klant_id, dienstverlener_id, date, time, duration_minutes, message) VALUES (?, ?, ?, ?, ?, ?)',
      [klant_id, dienstverlener_id, date, time || null, duration_minutes || 60, message || null]
    );

    const [klant] = await db.query('SELECT name FROM users WHERE id = ?', [klant_id]);
    const klantName = klant[0]?.name || 'Iemand';
    const timeLabel = time ? ` om ${time}` : '';
    const durLabel  = duration_minutes ? ` (${formatDur(duration_minutes)})` : '';

    await db.query(
      'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
      [dienstverlener_id, `📅 ${klantName} heeft een boeking aangevraagd op ${date}${timeLabel}${durLabel}.`]
    );

    res.status(201).json({ message: 'Boeking aangemaakt!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET bookings for a dienstverlener
app.get('/bookings/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT b.*, u.name AS klant_name, u.email AS klant_email
       FROM bookings b
       JOIN users u ON b.klant_id = u.id
       WHERE b.dienstverlener_id = ?
       ORDER BY b.date ASC, b.time ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET bookings made BY a klant
app.get('/my-bookings/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT b.*, u.name AS dienstverlener_name
       FROM bookings b
       JOIN users u ON b.dienstverlener_id = u.id
       WHERE b.klant_id = ?
       ORDER BY b.date ASC, b.time ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE booking status (accept / decline / cancel)
app.put('/bookings/:id', async (req, res) => {
  try {
    const { status, klant_id, dienstverlener_id, dienstverlener_name, klant_name } = req.body;

    if (!['accepted', 'declined', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Ongeldige status.' });
    }

    await db.query('UPDATE bookings SET status = ? WHERE id = ?', [status, req.params.id]);

    if (status === 'accepted' || status === 'declined') {
      const emoji = status === 'accepted' ? '✅' : '❌';
      const word  = status === 'accepted' ? 'geaccepteerd' : 'afgewezen';
      await db.query('INSERT INTO notifications (user_id, message) VALUES (?, ?)',
        [klant_id, `${emoji} ${dienstverlener_name} heeft jouw boeking ${word}.`]);
    }

    if (status === 'cancelled' && dienstverlener_id) {
      await db.query('INSERT INTO notifications (user_id, message) VALUES (?, ?)',
        [dienstverlener_id, `❌ ${klant_name || 'Klant'} heeft de boeking geannuleerd.`]);
    }

    res.json({ message: 'Status bijgewerkt!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET reviews written by a klant
app.get('/my-reviews/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.*, u.name AS provider_name FROM reviews r
       JOIN users u ON r.provider_id = u.id
       WHERE r.reviewer_id = ?
       ORDER BY r.created_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────

app.get('/notifications/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/notifications/:id/read', async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.params.id]);
    res.json({ message: 'Gelezen' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/availability/:id', async (req, res) => {
  try {
    const { is_available } = req.body;
    await db.query('UPDATE users SET is_available = ? WHERE id = ?', [is_available ? 1 : 0, req.params.id]);
    res.json({ message: 'Status bijgewerkt!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// REVIEWS
// ─────────────────────────────────────────

app.post('/reviews', async (req, res) => {
  try {
    const { reviewer_id, provider_id, score, text } = req.body;
    if (!reviewer_id || !provider_id || !score || !text) {
      return res.status(400).json({ error: 'Vul alle velden in.' });
    }
    await db.query(
      'INSERT INTO reviews (reviewer_id, provider_id, score, text) VALUES (?, ?, ?, ?)',
      [reviewer_id, provider_id, score, text]
    );
    res.status(201).json({ message: 'Review geplaatst!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/reviews/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.*, u.name AS reviewer_name FROM reviews r
       JOIN users u ON r.reviewer_id = u.id
       WHERE r.provider_id = ?
       ORDER BY r.created_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/provider-stats/:id', async (req, res) => {
  try {
    const [[stats]] = await db.query(
      `SELECT COUNT(DISTINCT klant_id) AS total_clients
       FROM bookings WHERE dienstverlener_id = ? AND status = 'accepted'`,
      [req.params.id]
    );
    const [[ret]] = await db.query(
      `SELECT COUNT(*) AS returning_clients
       FROM (
         SELECT klant_id FROM bookings
         WHERE dienstverlener_id = ? AND status = 'accepted'
         GROUP BY klant_id HAVING COUNT(*) > 1
       ) sub`,
      [req.params.id]
    );
    const [[rev]] = await db.query(
      `SELECT COUNT(*) AS total_reviews FROM reviews WHERE provider_id = ?`,
      [req.params.id]
    );

    const total_clients  = stats.total_clients     || 0;
    const total_reviews  = rev.total_reviews       || 0;
    // Vertrouwenscore: 60 pts from clients (max 20), 40 pts from reviews (max 10)
    const vertrouwenscore = Math.min(100, Math.round(
      Math.min(60, total_clients * 3) +
      Math.min(40, total_reviews * 4)
    ));

    res.json({
      total_clients,
      returning_clients: ret.returning_clients || 0,
      total_reviews,
      vertrouwenscore,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

function formatDur(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}u${m ? m + 'min' : ''}`;
}

function htmlPage(title, message, success) {
  const color = success ? '#166534' : '#842029';
  const bg    = success ? '#d1e7dd' : '#f8d7da';
  return `<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"><title>${title} — MaKandra</title>
  <style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f3ef}
  .box{background:#fff;border-radius:16px;padding:40px;max-width:480px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.1)}
  h1{color:${color};margin-bottom:12px}.msg{background:${bg};color:${color};border-radius:10px;padding:16px;margin:20px 0;font-size:.95rem}
  a{display:inline-block;margin-top:16px;background:#6c47ff;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600}</style>
  </head><body><div class="box"><h1>${title}</h1><div class="msg">${message}</div>
  <a href="${FRONTEND}">Terug naar MaKandra</a></div></body></html>`;
}

// ─────────────────────────────────────────
// UPLOAD AVATAR
app.post('/upload/avatar/:id', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Geen geldig afbeeldingsbestand.' });
    const url = '/uploads/' + req.file.filename;
    await db.query('UPDATE users SET profile_picture = ? WHERE id = ?', [url, req.params.id]);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// PORTFOLIO
// ─────────────────────────────────────────

const portfolioStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename:    (req, file, cb) => cb(null, 'portfolio-' + req.params.userId + '-' + Date.now() + path.extname(file.originalname)),
});
const uploadPortfolio = multer({
  storage: portfolioStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /image\/(jpeg|png|webp|gif)|video\/(mp4|webm|ogg)/.test(file.mimetype)),
});

app.post('/portfolio/:userId', uploadPortfolio.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Ongeldig bestand.' });
    const isVideo    = req.file.mimetype.startsWith('video/');
    const file_path  = '/uploads/' + req.file.filename;
    const caption    = req.body.caption || null;
    await db.query('INSERT INTO portfolio (user_id, file_path, file_type, caption) VALUES (?, ?, ?, ?)',
      [req.params.userId, file_path, isVideo ? 'video' : 'image', caption]);
    res.status(201).json({ url: file_path, type: isVideo ? 'video' : 'image' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/portfolio/:userId', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM portfolio WHERE user_id = ? ORDER BY created_at DESC', [req.params.userId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/portfolio/item/:itemId', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT file_path, user_id FROM portfolio WHERE id = ?', [req.params.itemId]);
    if (!rows.length) return res.status(404).json({ error: 'Item niet gevonden.' });
    await db.query('DELETE FROM portfolio WHERE id = ?', [req.params.itemId]);
    res.json({ message: 'Verwijderd.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// CHAT / MESSAGES
// ─────────────────────────────────────────

app.get('/conversations/:userId', async (req, res) => {
  try {
    const uid = req.params.userId;
    const [rows] = await db.query(`
      SELECT
        u.id, u.name, u.profile_picture, u.role,
        (SELECT message FROM messages
         WHERE (sender_id = ? AND receiver_id = u.id) OR (sender_id = u.id AND receiver_id = ?)
         ORDER BY created_at DESC LIMIT 1) AS last_message,
        (SELECT created_at FROM messages
         WHERE (sender_id = ? AND receiver_id = u.id) OR (sender_id = u.id AND receiver_id = ?)
         ORDER BY created_at DESC LIMIT 1) AS last_time,
        (SELECT COUNT(*) FROM messages
         WHERE sender_id = u.id AND receiver_id = ? AND is_read = 0) AS unread_count
      FROM users u
      WHERE u.id IN (
        SELECT DISTINCT IF(sender_id = ?, receiver_id, sender_id)
        FROM messages WHERE sender_id = ? OR receiver_id = ?
      )
      ORDER BY last_time DESC
    `, [uid, uid, uid, uid, uid, uid, uid, uid]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/messages/unread/:userId', async (req, res) => {
  try {
    const [[{ count }]] = await db.query(
      'SELECT COUNT(*) AS count FROM messages WHERE receiver_id = ? AND is_read = 0',
      [req.params.userId]
    );
    res.json({ count });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/messages/:userId1/:userId2', async (req, res) => {
  try {
    const { userId1, userId2 } = req.params;
    const [rows] = await db.query(`
      SELECT m.*, u.name AS sender_name FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE (m.sender_id = ? AND m.receiver_id = ?)
         OR (m.sender_id = ? AND m.receiver_id = ?)
      ORDER BY m.created_at ASC
    `, [userId1, userId2, userId2, userId1]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/messages', async (req, res) => {
  try {
    const { sender_id, receiver_id, message } = req.body;
    if (!sender_id || !receiver_id || !message) {
      return res.status(400).json({ error: 'Alle velden zijn verplicht.' });
    }
    const [[receiver]] = await db.query('SELECT dnd_mode FROM users WHERE id = ?', [receiver_id]);
    if (receiver?.dnd_mode) return res.json({ dnd: true });
    await db.query(
      'INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)',
      [sender_id, receiver_id, message]
    );
    res.status(201).json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/messages/read', async (req, res) => {
  try {
    const { reader_id, sender_id } = req.body;
    await db.query(
      'UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ?',
      [sender_id, reader_id]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/dnd/:id', async (req, res) => {
  try {
    const { dnd_mode } = req.body;
    await db.query('UPDATE users SET dnd_mode = ? WHERE id = ?', [dnd_mode ? 1 : 0, req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─────────────────────────────────────────
// JOBS
// ─────────────────────────────────────────

app.post('/jobs', async (req, res) => {
  try {
    const { klant_id, title, description, category, buurt, budget, date_needed } = req.body;
    if (!klant_id || !title || !category) return res.status(400).json({ error: 'Vul alle verplichte velden in.' });
    const [result] = await db.query(
      'INSERT INTO jobs (klant_id, title, description, category, buurt, budget, date_needed) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [klant_id, title, description || null, category, buurt || null, budget || null, date_needed || null]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/jobs', async (req, res) => {
  try {
    const { category } = req.query;
    const where  = category ? 'WHERE j.status = "open" AND j.category = ?' : 'WHERE j.status = "open"';
    const params = category ? [category] : [];
    const [rows] = await db.query(
      `SELECT j.*, u.name AS klant_name,
        (SELECT COUNT(*) FROM job_responses jr WHERE jr.job_id = j.id) AS response_count
       FROM jobs j JOIN users u ON j.klant_id = u.id
       ${where} ORDER BY j.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/jobs/mine/:klantId', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT j.*,
        (SELECT COUNT(*) FROM job_responses jr WHERE jr.job_id = j.id) AS response_count
       FROM jobs j WHERE j.klant_id = ? ORDER BY j.created_at DESC`,
      [req.params.klantId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/jobs/:id/close', async (req, res) => {
  try {
    await db.query('UPDATE jobs SET status = "closed" WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/job-responses', async (req, res) => {
  try {
    const { job_id, dienstverlener_id, message } = req.body;
    if (!job_id || !dienstverlener_id) return res.status(400).json({ error: 'Ongeldige aanvraag.' });
    const [existing] = await db.query('SELECT id FROM job_responses WHERE job_id = ? AND dienstverlener_id = ?', [job_id, dienstverlener_id]);
    if (existing.length) return res.status(409).json({ error: 'Je hebt al gereageerd op deze opdracht.' });
    await db.query('INSERT INTO job_responses (job_id, dienstverlener_id, message) VALUES (?, ?, ?)', [job_id, dienstverlener_id, message || null]);
    const [[job]] = await db.query('SELECT klant_id, title FROM jobs WHERE id = ?', [job_id]);
    const [[dv]]  = await db.query('SELECT name FROM users WHERE id = ?', [dienstverlener_id]);
    if (job) await db.query('INSERT INTO notifications (user_id, message) VALUES (?, ?)',
      [job.klant_id, `💼 ${dv.name} heeft gereageerd op jouw opdracht: "${job.title}"`]);
    res.status(201).json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/job-responses/:jobId', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT jr.*, u.name AS dv_name, u.category, u.buurt, u.hourly_rate, u.profile_picture
       FROM job_responses jr JOIN users u ON jr.dienstverlener_id = u.id
       WHERE jr.job_id = ? ORDER BY jr.created_at ASC`,
      [req.params.jobId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─────────────────────────────────────────
// DB INIT — runs fully before server starts
// ─────────────────────────────────────────

(async () => {
  try {
    // ── Core tables that bookings / reviews / notifications depend on ──
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

    // ── roles table (issue 10) ─────────────────────────────────────────────────
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

    // ── user_roles pivot (multi-role future support) ───────────────────────────
    await db.query(`CREATE TABLE IF NOT EXISTS user_roles (
      user_id    INT NOT NULL,
      role_id    INT NOT NULL,
      granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, role_id)
    )`);

    // ── provider_profiles extension table (issue 9) ───────────────────────────
    await db.query(`CREATE TABLE IF NOT EXISTS provider_profiles (
      user_id       INT            PRIMARY KEY,
      category      VARCHAR(100)   NULL,
      experience    VARCHAR(255)   NULL,
      hourly_rate   DECIMAL(10,2)  NULL,
      phone         VARCHAR(50)    NULL,
      working_hours VARCHAR(500)   NULL,
      is_available  TINYINT(1)     NOT NULL DEFAULT 1
    )`);

    // Add new columns to users — silently skipped if they already exist
    const alterCols = [
      'ALTER TABLE users ADD COLUMN dnd_mode          TINYINT(1)   NOT NULL DEFAULT 0',
      'ALTER TABLE users ADD COLUMN is_available       TINYINT(1)   NOT NULL DEFAULT 1',
      'ALTER TABLE users ADD COLUMN email_verified    TINYINT(1)   NOT NULL DEFAULT 1',
      'ALTER TABLE users ADD COLUMN verification_token VARCHAR(64)  NULL',
      'ALTER TABLE users ADD COLUMN is_admin           TINYINT(1)   NOT NULL DEFAULT 0',
      'ALTER TABLE users ADD COLUMN pw_change_token    VARCHAR(64)  NULL',
      'ALTER TABLE users ADD COLUMN pw_change_hash     VARCHAR(255) NULL',
      'ALTER TABLE users ADD COLUMN pw_change_expires  DATETIME     NULL',
      // Issue 8 — separate names
      'ALTER TABLE users ADD COLUMN first_name VARCHAR(100) NULL AFTER name',
      'ALTER TABLE users ADD COLUMN last_name  VARCHAR(100) NULL AFTER first_name',
      // Issue 10 — role FK
      'ALTER TABLE users ADD COLUMN role_id INT NULL',
    ];
    for (const sql of alterCols) {
      try { await db.query(sql); } catch { /* column already exists — skip */ }
    }

    // Ensure any pre-existing users without email_verified get set to 1
    try {
      await db.query('UPDATE users SET email_verified = 1 WHERE email_verified IS NULL OR email_verified = 0');
    } catch { /* column might not exist yet on very first run */ }

    // Populate first_name / last_name for existing rows (idempotent — only NULL rows)
    try {
      await db.query(`UPDATE users
        SET
          first_name = TRIM(SUBSTRING_INDEX(name, ' ', 1)),
          last_name  = NULLIF(TRIM(SUBSTRING(name, CHAR_LENGTH(SUBSTRING_INDEX(name, ' ', 1)) + 2)), '')
        WHERE first_name IS NULL AND name IS NOT NULL AND name != ''`);
    } catch { /* skip */ }

    // Populate role_id from role string (idempotent — only NULL rows)
    try {
      await db.query(`UPDATE users u
        JOIN roles r ON r.name = u.role
        SET u.role_id = r.id
        WHERE u.role_id IS NULL`);
    } catch { /* roles table may not be ready yet — skip */ }

    // Sync provider_profiles from users (idempotent)
    try {
      await db.query(`INSERT INTO provider_profiles
          (user_id, category, experience, hourly_rate, phone, working_hours, is_available)
        SELECT id, category, experience, hourly_rate, phone, working_hours, COALESCE(is_available, 1)
        FROM users
        WHERE role = 'dienstverlener'
        ON DUPLICATE KEY UPDATE
          category = VALUES(category), experience = VALUES(experience),
          hourly_rate = VALUES(hourly_rate), phone = VALUES(phone),
          working_hours = VALUES(working_hours), is_available = VALUES(is_available)`);
    } catch { /* skip */ }

    console.log('DB init complete — server starting.');
  } catch (e) {
    console.error('DB init error:', e.message);
  }

  // Server only starts AFTER all DB migrations are done
  app.listen(3000, () => console.log('Server running on http://localhost:3000'));
})();
