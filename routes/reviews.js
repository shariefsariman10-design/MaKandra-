import express from 'express';
import { db } from '../config/db.js';

const router = express.Router();

// POST review
router.post('/reviews', async (req, res) => {
  try {
    const { reviewer_id, provider_id, score, text } = req.body;
    if (!reviewer_id || !provider_id || !score || !text)
      return res.status(400).json({ error: 'Vul alle velden in.' });
    await db.query(
      'INSERT INTO reviews (reviewer_id, provider_id, score, text) VALUES (?, ?, ?, ?)',
      [reviewer_id, provider_id, score, text]
    );
    res.status(201).json({ message: 'Review geplaatst!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET reviews for a provider
router.get('/reviews/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.*, u.name AS reviewer_name FROM reviews r
       JOIN users u ON r.reviewer_id = u.id
       WHERE r.provider_id = ? ORDER BY r.created_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET provider stats (trust score, clients, reviews)
router.get('/provider-stats/:id', async (req, res) => {
  try {
    const [[stats]] = await db.query(
      `SELECT COUNT(DISTINCT klant_id) AS total_clients
       FROM bookings WHERE dienstverlener_id = ? AND status = 'accepted'`,
      [req.params.id]
    );
    const [[ret]] = await db.query(
      `SELECT COUNT(*) AS returning_clients FROM (
         SELECT klant_id FROM bookings
         WHERE dienstverlener_id = ? AND status = 'accepted'
         GROUP BY klant_id HAVING COUNT(*) > 1
       ) sub`,
      [req.params.id]
    );
    const [[rev]] = await db.query(
      'SELECT COUNT(*) AS total_reviews FROM reviews WHERE provider_id = ?',
      [req.params.id]
    );
    const total_clients = stats.total_clients  || 0;
    const total_reviews = rev.total_reviews    || 0;
    const vertrouwenscore = Math.min(100, Math.round(
      Math.min(60, total_clients * 3) + Math.min(40, total_reviews * 4)
    ));
    res.json({ total_clients, returning_clients: ret.returning_clients || 0, total_reviews, vertrouwenscore });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
