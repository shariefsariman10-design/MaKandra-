import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../config/db.js';
import { isValidEmail } from '../utils/helpers.js';

const router = express.Router();

// GET all users (admin use)
router.get('/users', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, name, email, role, buurt, created_at FROM users');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// UPDATE dienstverlener profile
router.put('/profile/:id', async (req, res) => {
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
    try {
      await db.query(
        `INSERT INTO provider_profiles (user_id, category, experience, hourly_rate, phone, working_hours)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           category=VALUES(category), experience=VALUES(experience),
           hourly_rate=VALUES(hourly_rate), phone=VALUES(phone), working_hours=VALUES(working_hours)`,
        [req.params.id, category, experience, parseFloat(hourly_rate) || null, phone || null, working_hours || null]
      );
    } catch { /* skip */ }
    res.json({ message: 'Profiel bijgewerkt!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// UPDATE klant profile
router.put('/klant-profile/:id', async (req, res) => {
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// UPDATE name only (compat)
router.put('/update-name/:id', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Naam is verplicht.' });
    await db.query('UPDATE users SET name=? WHERE id=?', [name.trim(), req.params.id]);
    res.json({ message: 'Naam bijgewerkt!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// UPDATE account settings (email, buurt)
router.put('/account/:id', async (req, res) => {
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
    const updates = [], params = [];
    if (email) {
      if (!isValidEmail(email)) return res.status(400).json({ error: 'Voer een geldig e-mailadres in.' });
      updates.push('email = ?'); params.push(email.toLowerCase());
    }
    if (buurt) { updates.push('buurt = ?'); params.push(buurt); }
    if (!updates.length) return res.status(400).json({ error: 'Niets om bij te werken.' });
    params.push(req.params.id);
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ message: 'Account bijgewerkt!' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') res.status(400).json({ error: 'Dit e-mailadres is al in gebruik.' });
    else res.status(500).json({ error: 'Er is een serverfout opgetreden.' });
  }
});

export default router;
