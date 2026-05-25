import express from 'express';
import { db } from '../config/db.js';
import { formatDur } from '../utils/helpers.js';

const router = express.Router();

// CREATE booking
router.post('/bookings', async (req, res) => {
  try {
    const { klant_id, dienstverlener_id, date, time, duration_minutes, message } = req.body;
    if (!klant_id || !dienstverlener_id || !date)
      return res.status(400).json({ error: 'Klant, dienstverlener en datum zijn verplicht.' });
    await db.query(
      'INSERT INTO bookings (klant_id, dienstverlener_id, date, time, duration_minutes, message) VALUES (?, ?, ?, ?, ?, ?)',
      [klant_id, dienstverlener_id, date, time || null, duration_minutes || 60, message || null]
    );
    const [klant] = await db.query('SELECT name FROM users WHERE id = ?', [klant_id]);
    const klantName = klant[0]?.name || 'Iemand';
    const timeLabel = time ? ` om ${time}` : '';
    const durLabel  = duration_minutes ? ` (${formatDur(duration_minutes)})` : '';
    await db.query('INSERT INTO notifications (user_id, message) VALUES (?, ?)',
      [dienstverlener_id, `📅 ${klantName} heeft een boeking aangevraagd op ${date}${timeLabel}${durLabel}.`]);
    res.status(201).json({ message: 'Boeking aangemaakt!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET bookings for a dienstverlener
router.get('/bookings/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT b.*, u.name AS klant_name, u.email AS klant_email
       FROM bookings b JOIN users u ON b.klant_id = u.id
       WHERE b.dienstverlener_id = ? ORDER BY b.date ASC, b.time ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET bookings made BY a klant
router.get('/my-bookings/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT b.*, u.name AS dienstverlener_name
       FROM bookings b JOIN users u ON b.dienstverlener_id = u.id
       WHERE b.klant_id = ? ORDER BY b.date ASC, b.time ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// UPDATE booking status
router.put('/bookings/:id', async (req, res) => {
  try {
    const { status, klant_id, dienstverlener_id, dienstverlener_name, klant_name } = req.body;
    if (!['accepted', 'declined', 'cancelled'].includes(status))
      return res.status(400).json({ error: 'Ongeldige status.' });
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET reviews written by a klant
router.get('/my-reviews/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.*, u.name AS provider_name FROM reviews r
       JOIN users u ON r.provider_id = u.id
       WHERE r.reviewer_id = ? ORDER BY r.created_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
