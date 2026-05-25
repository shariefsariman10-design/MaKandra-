import express from 'express';
import { db } from '../config/db.js';

const router = express.Router();

// GET notifications for a user
router.get('/notifications/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// MARK all as read
router.put('/notifications/:id/read', async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.params.id]);
    res.json({ message: 'Gelezen' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// UPDATE availability
router.put('/availability/:id', async (req, res) => {
  try {
    const { is_available } = req.body;
    await db.query('UPDATE users SET is_available = ? WHERE id = ?', [is_available ? 1 : 0, req.params.id]);
    res.json({ message: 'Status bijgewerkt!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
