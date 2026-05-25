import express from 'express';
import { db } from '../config/db.js';

const router = express.Router();

// CREATE job
router.post('/jobs', async (req, res) => {
  try {
    const { klant_id, title, description, category, buurt, budget, date_needed } = req.body;
    if (!klant_id || !title || !category)
      return res.status(400).json({ error: 'Vul alle verplichte velden in.' });
    const [result] = await db.query(
      'INSERT INTO jobs (klant_id, title, description, category, buurt, budget, date_needed) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [klant_id, title, description || null, category, buurt || null, budget || null, date_needed || null]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET open jobs (optional category filter)
router.get('/jobs', async (req, res) => {
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

// GET jobs by klant
router.get('/jobs/mine/:klantId', async (req, res) => {
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

// CLOSE job
router.put('/jobs/:id/close', async (req, res) => {
  try {
    await db.query('UPDATE jobs SET status = "closed" WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// RESPOND to job
router.post('/job-responses', async (req, res) => {
  try {
    const { job_id, dienstverlener_id, message } = req.body;
    if (!job_id || !dienstverlener_id)
      return res.status(400).json({ error: 'Ongeldige aanvraag.' });
    const [existing] = await db.query(
      'SELECT id FROM job_responses WHERE job_id = ? AND dienstverlener_id = ?', [job_id, dienstverlener_id]
    );
    if (existing.length) return res.status(409).json({ error: 'Je hebt al gereageerd op deze opdracht.' });
    await db.query('INSERT INTO job_responses (job_id, dienstverlener_id, message) VALUES (?, ?, ?)',
      [job_id, dienstverlener_id, message || null]);
    const [[job]] = await db.query('SELECT klant_id, title FROM jobs WHERE id = ?', [job_id]);
    const [[dv]]  = await db.query('SELECT name FROM users WHERE id = ?', [dienstverlener_id]);
    if (job) await db.query('INSERT INTO notifications (user_id, message) VALUES (?, ?)',
      [job.klant_id, `💼 ${dv.name} heeft gereageerd op jouw opdracht: "${job.title}"`]);
    res.status(201).json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET responses for a job
router.get('/job-responses/:jobId', async (req, res) => {
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

export default router;
