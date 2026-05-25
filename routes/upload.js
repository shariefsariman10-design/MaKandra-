import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '../uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename:    (req, file, cb) => cb(null, 'avatar-' + req.params.id + path.extname(file.originalname)),
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /image\/(jpeg|png|webp|gif)/.test(file.mimetype)),
});

const portfolioStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename:    (req, file, cb) => cb(null, 'portfolio-' + req.params.userId + '-' + Date.now() + path.extname(file.originalname)),
});
const uploadPortfolio = multer({
  storage: portfolioStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /image\/(jpeg|png|webp|gif)|video\/(mp4|webm|ogg)/.test(file.mimetype)),
});

const router = express.Router();

// UPLOAD avatar
router.post('/upload/avatar/:id', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Geen geldig afbeeldingsbestand.' });
    const url = '/uploads/' + req.file.filename;
    await db.query('UPDATE users SET profile_picture = ? WHERE id = ?', [url, req.params.id]);
    res.json({ url });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// UPLOAD portfolio item
router.post('/portfolio/:userId', uploadPortfolio.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Ongeldig bestand.' });
    const isVideo   = req.file.mimetype.startsWith('video/');
    const file_path = '/uploads/' + req.file.filename;
    const caption   = req.body.caption || null;
    await db.query('INSERT INTO portfolio (user_id, file_path, file_type, caption) VALUES (?, ?, ?, ?)',
      [req.params.userId, file_path, isVideo ? 'video' : 'image', caption]);
    res.status(201).json({ url: file_path, type: isVideo ? 'video' : 'image' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET portfolio items
router.get('/portfolio/:userId', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM portfolio WHERE user_id = ? ORDER BY created_at DESC', [req.params.userId]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE portfolio item
router.delete('/portfolio/item/:itemId', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT file_path, user_id FROM portfolio WHERE id = ?', [req.params.itemId]);
    if (!rows.length) return res.status(404).json({ error: 'Item niet gevonden.' });
    await db.query('DELETE FROM portfolio WHERE id = ?', [req.params.itemId]);
    res.json({ message: 'Verwijderd.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
