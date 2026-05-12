import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename:    (req, file, cb) => cb(null, 'avatar-' + req.params.id + path.extname(file.originalname)),
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  cb(null, /image\/(jpeg|png|webp|gif)/.test(file.mimetype));
}});

// ─────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────

// SIGNUP
app.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role, buurt, category, experience, bio, hourly_rate, phone, working_hours } = req.body;
    if (!name || !email || !password || !role || !buurt) {
      return res.status(400).json({ error: 'Vul alle velden in.' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (name, email, password, role, buurt, category, experience, bio, hourly_rate, phone, working_hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, email, hashed, role, buurt, category || null, experience || null, bio || null, hourly_rate || null, phone || null, working_hours || null]
    );
    const [rows] = await db.query('SELECT id, name, email, role, buurt, category, experience, bio, hourly_rate, phone, working_hours FROM users WHERE id = ?', [result.insertId]);
    res.status(201).json({ message: 'Account aangemaakt!', user: rows[0] });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Dit e-mailadres is al in gebruik.' });
    } else {
      console.error('SIGNUP ERROR:', err.message);
      res.status(500).json({ error: err.message });
    }
  }
});

// LOGIN
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Verkeerd e-mailadres of wachtwoord.' });
    }
    const valid = await bcrypt.compare(password, rows[0].password);
    if (!valid) {
      return res.status(401).json({ error: 'Verkeerd e-mailadres of wachtwoord.' });
    }
    const user = rows[0];
    res.json({
      message: 'Ingelogd!',
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        email: user.email,
        category: user.category,
        experience: user.experience,
        bio: user.bio,
        hourly_rate: user.hourly_rate,
        buurt: user.buurt,
        phone: user.phone,
        working_hours: user.working_hours,
        profile_picture: user.profile_picture,
        is_available: user.is_available,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
app.get('/dienstverleners', async (req, res) => {
  try {
    const { buurt } = req.query;
    let query = `
      SELECT u.id, u.name, u.email, u.category, u.experience, u.bio, u.hourly_rate, u.buurt,
             u.profile_picture, u.phone, u.working_hours, u.is_available,
             ROUND(AVG(r.score), 1) AS avg_score,
             COUNT(r.id) AS review_count
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

// UPDATE dienstverlener profile (name, category, experience, bio, hourly_rate, buurt)
app.put('/profile/:id', async (req, res) => {
  try {
    const { name, category, experience, bio, hourly_rate, buurt, phone, working_hours } = req.body;
    await db.query(
      'UPDATE users SET name=?, category=?, experience=?, bio=?, hourly_rate=?, buurt=?, phone=?, working_hours=? WHERE id=?',
      [name, category, experience, bio, hourly_rate, buurt, phone || null, working_hours || null, req.params.id]
    );
    res.json({ message: 'Profiel bijgewerkt!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE name only (for klanten)
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

// UPDATE account settings (email, password, buurt) — requires current password
app.put('/account/:id', async (req, res) => {
  try {
    const { current_password, email, new_password, buurt } = req.body;

    // Verify current password first
    const [rows] = await db.query(
      'SELECT * FROM users WHERE id = ? AND password = ?',
      [req.params.id, current_password]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Huidig wachtwoord is onjuist.' });
    }

    const updates = [];
    const params = [];

    if (email) {
      updates.push('email = ?');
      params.push(email);
    }
    if (new_password) {
      updates.push('password = ?');
      params.push(new_password);
    }
    if (buurt) {
      updates.push('buurt = ?');
      params.push(buurt);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Niets om bij te werken.' });
    }

    params.push(req.params.id);
    await db.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    res.json({ message: 'Account bijgewerkt!' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Dit e-mailadres is al in gebruik.' });
    } else {
      res.status(500).json({ error: err.message });
    }
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

    // Get klant name for notification
    const [klant] = await db.query('SELECT name FROM users WHERE id = ?', [klant_id]);
    const klantName = klant[0]?.name || 'Iemand';
    const timeLabel = time ? ` om ${time}` : '';
    const durLabel = duration_minutes ? ` (${formatDur(duration_minutes)})` : '';

    // Notify dienstverlener
    await db.query(
      'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
      [
        dienstverlener_id,
        `📅 ${klantName} heeft een boeking aangevraagd op ${date}${timeLabel}${durLabel}.`,
      ]
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

// GET notifications for a user
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

// MARK all notifications as read for a user
app.put('/notifications/:id/read', async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.params.id]);
    res.json({ message: 'Gelezen' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE availability status
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

// POST review
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

// GET reviews for a provider
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

// GET provider stats (total clients, returning clients)
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
    res.json({
      total_clients:     stats.total_clients     || 0,
      returning_clients: ret.returning_clients   || 0,
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

// START
// ─────────────────────────────────────────

// ─────────────────────────────────────────
// CHAT / MESSAGES
// ─────────────────────────────────────────

// GET all conversations for a user
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

// GET unread message count (must be before /:userId1/:userId2 to avoid route conflict)
app.get('/messages/unread/:userId', async (req, res) => {
  try {
    const [[{ count }]] = await db.query(
      'SELECT COUNT(*) AS count FROM messages WHERE receiver_id = ? AND is_read = 0',
      [req.params.userId]
    );
    res.json({ count });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET messages between two users (after /unread to avoid route conflict)
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

// POST send a message
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

// PUT mark conversation as read
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

// PUT DND mode
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

// POST a new job
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

// GET all open jobs (optional ?category= filter)
app.get('/jobs', async (req, res) => {
  try {
    const { category } = req.query;
    const where = category ? 'WHERE j.status = "open" AND j.category = ?' : 'WHERE j.status = "open"';
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

// GET jobs posted by a klant
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

// PUT close a job
app.put('/jobs/:id/close', async (req, res) => {
  try {
    await db.query('UPDATE jobs SET status = "closed" WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST respond to a job
app.post('/job-responses', async (req, res) => {
  try {
    const { job_id, dienstverlener_id, message } = req.body;
    if (!job_id || !dienstverlener_id) return res.status(400).json({ error: 'Ongeldige aanvraag.' });
    // Prevent duplicate responses
    const [existing] = await db.query('SELECT id FROM job_responses WHERE job_id = ? AND dienstverlener_id = ?', [job_id, dienstverlener_id]);
    if (existing.length) return res.status(409).json({ error: 'Je hebt al gereageerd op deze opdracht.' });
    await db.query('INSERT INTO job_responses (job_id, dienstverlener_id, message) VALUES (?, ?, ?)', [job_id, dienstverlener_id, message || null]);
    // Notify the klant
    const [[job]] = await db.query('SELECT klant_id, title FROM jobs WHERE id = ?', [job_id]);
    const [[dv]]  = await db.query('SELECT name FROM users WHERE id = ?', [dienstverlener_id]);
    if (job) await db.query('INSERT INTO notifications (user_id, message) VALUES (?, ?)',
      [job.klant_id, `💼 ${dv.name} heeft gereageerd op jouw opdracht: "${job.title}"`]);
    res.status(201).json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET responses for a job (for the klant to view)
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

// Auto-create tables on startup
(async () => {
  try {
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
    try { await db.query('ALTER TABLE users ADD COLUMN dnd_mode TINYINT(1) NOT NULL DEFAULT 0'); } catch {}
  } catch (e) { console.error('DB init:', e.message); }
})();

app.listen(3000, () => console.log('Server running on http://localhost:3000'));