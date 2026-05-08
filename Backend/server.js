import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { db } from './config/db.js';

const app = express();
app.use(cors());
app.use(express.json());

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

// GET categories with provider count + booking count, sorted by bookings
app.get('/categories', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.category,
              COUNT(DISTINCT u.id)  AS provider_count,
              COUNT(b.id)           AS booking_count
       FROM users u
       LEFT JOIN bookings b ON b.dienstverlener_id = u.id
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
      SELECT u.id, u.name, u.category, u.experience, u.bio, u.hourly_rate, u.buurt,
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

// UPDATE booking status (accept / decline)
app.put('/bookings/:id', async (req, res) => {
  try {
    const { status, klant_id, dienstverlener_name } = req.body;

    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'Ongeldige status.' });
    }

    await db.query('UPDATE bookings SET status = ? WHERE id = ?', [status, req.params.id]);

    const emoji = status === 'accepted' ? '✅' : '❌';
    const word = status === 'accepted' ? 'geaccepteerd' : 'afgewezen';

    // Notify klant
    await db.query(
      'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
      [klant_id, `${emoji} ${dienstverlener_name} heeft jouw boeking ${word}.`]
    );

    res.json({ message: 'Status bijgewerkt!' });
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
// START
// ─────────────────────────────────────────

app.listen(3000, () => console.log('Server running on http://localhost:3000'));