/**
 * errorHandler — global error-handling middleware.
 * Must be registered AFTER all routes (4 arguments = Express error handler).
 *
 * Usage in server.js:
 *   import { errorHandler } from './middlewares/errorHandler.js';
 *   app.use(errorHandler);   // after all routes
 */
export function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${req.method} ${req.url} —`, err.message);

  // Duplicate entry (MySQL)
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(400).json({ error: 'Dit e-mailadres is al in gebruik.' });
  }

  // Multer file size exceeded
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Bestand is te groot.' });
  }

  const status = err.status || err.statusCode || 500;
  const message = status < 500 ? err.message : 'Er is een serverfout opgetreden.';
  res.status(status).json({ error: message });
}
