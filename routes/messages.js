import express from 'express';
import { db } from '../config/db.js';

const router = express.Router();

// GET all conversations for a user
router.get('/conversations/:userId', async (req, res) => {
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

// GET unread message count
router.get('/messages/unread/:userId', async (req, res) => {
  try {
    const [[{ count }]] = await db.query(
      'SELECT COUNT(*) AS count FROM messages WHERE receiver_id = ? AND is_read = 0',
      [req.params.userId]
    );
    res.json({ count });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET messages between two users
router.get('/messages/:userId1/:userId2', async (req, res) => {
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

// SEND message
router.post('/messages', async (req, res) => {
  try {
    const { sender_id, receiver_id, message } = req.body;
    if (!sender_id || !receiver_id || !message)
      return res.status(400).json({ error: 'Alle velden zijn verplicht.' });
    const [[receiver]] = await db.query('SELECT dnd_mode FROM users WHERE id = ?', [receiver_id]);
    if (receiver?.dnd_mode) return res.json({ dnd: true });
    await db.query('INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)',
      [sender_id, receiver_id, message]);
    res.status(201).json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// MARK messages as read
router.put('/messages/read', async (req, res) => {
  try {
    const { reader_id, sender_id } = req.body;
    await db.query('UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ?',
      [sender_id, reader_id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// TOGGLE do-not-disturb
router.put('/dnd/:id', async (req, res) => {
  try {
    const { dnd_mode } = req.body;
    await db.query('UPDATE users SET dnd_mode = ? WHERE id = ?', [dnd_mode ? 1 : 0, req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
