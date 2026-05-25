import express from 'express';
import { db } from '../config/db.js';

const router = express.Router();

// GET platform stats
router.get('/stats', async (req, res) => {
  try {
    const [[{ dv_count }]]       = await db.query("SELECT COUNT(*) AS dv_count FROM users WHERE role = 'dienstverlener'");
    const [[{ voltooid_count }]] = await db.query("SELECT COUNT(*) AS voltooid_count FROM bookings WHERE status = 'accepted'");
    res.json({ dv_count, voltooid_count });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET categories with provider + booking counts
router.get('/categories', async (req, res) => {
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET dienstverleners (optional buurt filter)
router.get('/dienstverleners', async (req, res) => {
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
    if (buurt) { query += ' AND u.buurt = ?'; params.push(buurt); }
    query += ' GROUP BY u.id';
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
