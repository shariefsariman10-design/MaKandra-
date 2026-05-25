import express from 'express';
import { db } from '../config/db.js';

const router = express.Router();

// Admin middleware (inline — only used here)
async function requireAdmin(req, res, next) {
  const userId = req.headers['x-user-id'] || req.body?.requesterId;
  if (!userId) return res.status(401).json({ error: 'Niet gemachtigd.' });
  try {
    const [rows] = await db.query('SELECT is_admin FROM users WHERE id = ?', [userId]);
    if (!rows.length || !rows[0].is_admin)
      return res.status(403).json({ error: 'Geen beheerdersrechten.' });
    req.adminId = userId;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Er is een serverfout opgetreden.' });
  }
}

// POST /admin/promote — create first admin (protected by ADMIN_SECRET header)
router.post('/promote', async (req, res) => {
  try {
    const secret = req.headers['x-admin-secret'];
    if (!secret || secret !== process.env.ADMIN_SECRET)
      return res.status(403).json({ error: 'Ongeldig beheerderswachtwoord.' });
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'E-mailadres is verplicht.' });
    const [rows] = await db.query('SELECT id, name FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!rows.length) return res.status(404).json({ error: 'Gebruiker niet gevonden.' });
    await db.query('UPDATE users SET is_admin = 1, email_verified = 1 WHERE id = ?', [rows[0].id]);
    res.json({ message: `${rows[0].name} is nu beheerder.` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /admin/users
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, role, buurt, email_verified, is_admin, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /admin/stats
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [[{ total_users }]]    = await db.query('SELECT COUNT(*) AS total_users FROM users');
    const [[{ total_klanten }]]  = await db.query("SELECT COUNT(*) AS total_klanten FROM users WHERE role = 'klant'");
    const [[{ total_dv }]]       = await db.query("SELECT COUNT(*) AS total_dv FROM users WHERE role = 'dienstverlener'");
    const [[{ total_bookings }]] = await db.query('SELECT COUNT(*) AS total_bookings FROM bookings');
    const [[{ total_jobs }]]     = await db.query('SELECT COUNT(*) AS total_jobs FROM jobs');
    const [[{ unverified }]]     = await db.query('SELECT COUNT(*) AS unverified FROM users WHERE email_verified = 0');
    res.json({ total_users, total_klanten, total_dv, total_bookings, total_jobs, unverified });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /admin/users/:id
router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    if (req.params.id == req.adminId)
      return res.status(400).json({ error: 'Je kunt je eigen account niet verwijderen.' });
    await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'Gebruiker verwijderd.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
