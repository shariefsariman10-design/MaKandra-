/**
 * JWT Authentication Middleware
 *
 * Verifies JWT tokens in the Authorization header.
 * Expects header format: Authorization: Bearer <token>
 *
 * If token is valid, attaches decoded user info to req.user
 * If token is missing or invalid, returns 401 error
 */
import jwt from 'jsonwebtoken';

export function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header ontbreekt.' });
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production-env');
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token is verlopen. Log alstublieft opnieuw in.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Ongeldige token.' });
    }
    res.status(401).json({ error: 'Authenticatie vereist.' });
  }
}

/**
 * Optional token verification — doesn't fail if token is missing,
 * but verifies it if provided
 */
export function verifyTokenOptional(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.startsWith('Bearer ') 
        ? authHeader.slice(7) 
        : authHeader;
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production-env');
      req.user = decoded;
    }
  } catch (err) {
    // Silently ignore invalid tokens in optional mode
  }
  next();
}

/**
 * Admin role verification — requires user to be admin
 * Must be used AFTER verifyToken
 */
export function verifyAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authenticatie vereist.' });
  }
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Alleen beheerders hebben toegang.' });
  }
  next();
}
