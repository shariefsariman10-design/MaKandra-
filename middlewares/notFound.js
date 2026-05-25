/**
 * notFound — catches any request that didn't match a route.
 * Must be registered AFTER all routes, BEFORE errorHandler.
 *
 * Usage in server.js:
 *   import { notFound } from './middlewares/notFound.js';
 *   app.use(notFound);        // after all routes
 *   app.use(errorHandler);    // last
 */
export function notFound(req, res, next) {
  const err = new Error(`Route niet gevonden: ${req.method} ${req.url}`);
  err.status = 404;
  next(err);
}
