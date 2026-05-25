import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../config/db.js';
import { sendEmail } from '../utils/email.js';
import { genToken, isValidEmail, buildUserPayload, htmlPage, FRONTEND } from '../utils/helpers.js';

const router = express.Router();

// SIGNUP
router.post('/signup', async (req, res) => {
  try {
    const {
      first_name, last_name,
      name: rawName,
      email, password, role, buurt,
      category, experience, bio, hourly_rate, phone, working_hours,
    } = req.body;

    const fn = (first_name || '').trim();
    const ln = (last_name  || '').trim();
    const displayName = fn
      ? (ln ? fn + ' ' + ln : fn)
      : (rawName || '').trim();

    if (!displayName)         return res.status(400).json({ error: 'Naam is verplicht.' });
    if (!email)               return res.status(400).json({ error: 'E-mailadres is verplicht.' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Voer een geldig e-mailadres in.' });
    if (!password)            return res.status(400).json({ error: 'Wachtwoord is verplicht.' });
    if (password.length < 6)  return res.status(400).json({ error: 'Wachtwoord moet minimaal 6 tekens zijn.' });
    if (!role)                return res.status(400).json({ error: 'Rol is verplicht.' });
    if (!buurt)               return res.status(400).json({ error: 'District is verplicht.' });

    const hashed = await bcrypt.hash(password, 10);

    let roleId = null;
    try {
      const [roleRows] = await db.query('SELECT id FROM roles WHERE name = ?', [role]);
      roleId = roleRows.length ? roleRows[0].id : null;
    } catch { /* roles table may not exist yet */ }

    const [result] = await db.query(
      `INSERT INTO users
         (name, first_name, last_name, email, password, role, role_id,
          buurt, category, experience, bio, hourly_rate, phone, working_hours)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        displayName, fn || null, ln || null,
        email.toLowerCase(), hashed, role, roleId,
        buurt, category || null, experience || null, bio || null,
        (parseFloat(hourly_rate) || null), phone || null, working_hours || null,
      ]
    );

    if (role === 'dienstverlener') {
      try {
        await db.query(
          `INSERT INTO provider_profiles
             (user_id, category, experience, hourly_rate, phone, working_hours, is_available)
           VALUES (?, ?, ?, ?, ?, ?, 1)
           ON DUPLICATE KEY UPDATE
             category=VALUES(category), experience=VALUES(experience),
             hourly_rate=VALUES(hourly_rate), phone=VALUES(phone), working_hours=VALUES(working_hours)`,
          [result.insertId, category || null, experience || null,
           parseFloat(hourly_rate) || null, phone || null, working_hours || null]
        );
      } catch { /* skip */ }
    }

    await sendEmail(
      email,
      'Welkom bij MaKandra!',
      `<h2>Welkom bij MaKandra, ${displayName}!</h2>
       <p>Je account is succesvol aangemaakt. Je kunt nu direct inloggen.</p>
       <p style="color:#aaa;font-size:.8rem">Als je dit account niet hebt aangemaakt, neem dan contact met ons op.</p>`
    );

    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    res.status(201).json({ message: 'Account aangemaakt!', user: buildUserPayload(rows[0]) });
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
router.get('/verify-email', async (req, res) => {
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
router.post('/resend-verification', async (req, res) => {
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
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email)    return res.status(400).json({ error: 'E-mailadres is verplicht.' });
    if (!password) return res.status(400).json({ error: 'Wachtwoord is verplicht.' });
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!rows.length) return res.status(401).json({ error: 'Verkeerd e-mailadres of wachtwoord.' });
    const valid = await bcrypt.compare(password, rows[0].password);
    if (!valid) return res.status(401).json({ error: 'Verkeerd e-mailadres of wachtwoord.' });
    res.json({ message: 'Ingelogd!', user: buildUserPayload(rows[0]) });
  } catch (err) {
    res.status(500).json({ error: 'Er is een serverfout opgetreden.' });
  }
});

// CHANGE PASSWORD — Step 1: request
router.post('/change-password/request', async (req, res) => {
  try {
    const { user_id, current_password, new_password } = req.body;
    if (!user_id || !current_password || !new_password)
      return res.status(400).json({ error: 'Alle velden zijn verplicht.' });
    if (new_password.length < 6)
      return res.status(400).json({ error: 'Nieuw wachtwoord moet minimaal 6 tekens zijn.' });
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [user_id]);
    if (!rows.length) return res.status(404).json({ error: 'Gebruiker niet gevonden.' });
    const valid = await bcrypt.compare(current_password, rows[0].password);
    if (!valid) return res.status(401).json({ error: 'Huidig wachtwoord is onjuist.' });
    const token     = genToken();
    const newHash   = await bcrypt.hash(new_password, 10);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
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
       <p style="color:#aaa;font-size:.8rem">Als je dit verzoek niet hebt gedaan, kun je deze e-mail negeren.</p>`
    );
    res.json({ message: 'Bevestigingsmail verstuurd. Controleer je inbox om de wachtwoordwijziging te voltooien.' });
  } catch (err) {
    res.status(500).json({ error: 'Er is een fout opgetreden.' });
  }
});

// CHANGE PASSWORD — Step 2: confirm via link
router.get('/change-password/confirm', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.send(htmlPage('Ongeldige link', 'De link is ongeldig.', false));
    const [rows] = await db.query(
      'SELECT id, pw_change_hash, pw_change_expires FROM users WHERE pw_change_token = ?', [token]
    );
    if (!rows.length) return res.send(htmlPage('Link ongeldig', 'Deze link is al gebruikt of ongeldig.', false));
    if (rows[0].pw_change_expires && new Date() > new Date(rows[0].pw_change_expires))
      return res.send(htmlPage('Link verlopen', 'De bevestigingslink is verlopen. Vraag een nieuwe aan.', false));
    await db.query(
      'UPDATE users SET password=?, pw_change_token=NULL, pw_change_hash=NULL, pw_change_expires=NULL WHERE id=?',
      [rows[0].pw_change_hash, rows[0].id]
    );
    res.send(htmlPage('Wachtwoord gewijzigd!', 'Je wachtwoord is succesvol bijgewerkt. Je kunt nu inloggen met je nieuwe wachtwoord.', true));
  } catch (err) {
    res.send(htmlPage('Fout', 'Er is een fout opgetreden.', false));
  }
});

// FORGOT PASSWORD
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'E-mailadres is verplicht.' });
    const [rows] = await db.query('SELECT id, name FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!rows.length) return res.json({ message: 'Als dit e-mailadres bekend is, ontvang je een herstelmail.' });
    const token     = genToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await db.query('UPDATE users SET pw_change_token=?, pw_change_expires=? WHERE id=?', [token, expiresAt, rows[0].id]);
    const resetLink = `${FRONTEND}?reset_token=${token}`;
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

// RESET PASSWORD
router.post('/reset-password', async (req, res) => {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password) return res.status(400).json({ error: 'Token en wachtwoord zijn verplicht.' });
    if (new_password.length < 6) return res.status(400).json({ error: 'Wachtwoord moet minimaal 6 tekens zijn.' });
    const [rows] = await db.query('SELECT id, pw_change_expires FROM users WHERE pw_change_token = ?', [token]);
    if (!rows.length) return res.status(400).json({ error: 'Ongeldige of verlopen link.' });
    if (rows[0].pw_change_expires && new Date() > new Date(rows[0].pw_change_expires))
      return res.status(400).json({ error: 'De link is verlopen. Vraag een nieuwe herstelmail aan.' });
    const hashed = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password=?, pw_change_token=NULL, pw_change_expires=NULL WHERE id=?', [hashed, rows[0].id]);
    res.json({ message: 'Wachtwoord succesvol gewijzigd! Je kunt nu inloggen.' });
  } catch (err) {
    res.status(500).json({ error: 'Er is een fout opgetreden.' });
  }
});

export default router;
