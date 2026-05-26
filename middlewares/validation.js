/**
 * Request Validation Middleware
 *
 * Provides validation functions for common fields used across the application.
 * Usage: Pass validation functions as middleware in your routes.
 *
 * Example:
 *   router.post('/signup', validateSignup(), async (req, res) => { ... })
 */

/**
 * Validates signup request body
 */
export function validateSignup() {
  return (req, res, next) => {
    const errors = [];
    const { first_name, last_name, name, email, password, role, buurt } = req.body;

    // Name validation
    const displayName = (first_name || '').trim() || (last_name || '').trim() || (name || '').trim();
    if (!displayName) errors.push('Naam is verplicht.');

    // Email validation
    if (!email) {
      errors.push('E-mailadres is verplicht.');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      errors.push('Voer een geldig e-mailadres in.');
    }

    // Password validation
    if (!password) {
      errors.push('Wachtwoord is verplicht.');
    } else if (password.length < 6) {
      errors.push('Wachtwoord moet minimaal 6 tekens zijn.');
    }

    // Role validation
    if (!role) errors.push('Rol is verplicht.');

    // District validation
    if (!buurt) errors.push('District is verplicht.');

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    next();
  };
}

/**
 * Validates login request body
 */
export function validateLogin() {
  return (req, res, next) => {
    const errors = [];
    const { email, password } = req.body;

    if (!email) errors.push('E-mailadres is verplicht.');
    if (!password) errors.push('Wachtwoord is verplicht.');

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    next();
  };
}

/**
 * Validates booking request body
 */
export function validateBooking() {
  return (req, res, next) => {
    const errors = [];
    const { dienstverlener_id, date, duration_minutes } = req.body;

    if (!dienstverlener_id) errors.push('Service provider ID is verplicht.');
    if (!date) errors.push('Datum is verplicht.');
    if (!duration_minutes || duration_minutes < 30) errors.push('Duration moet minimaal 30 minuten zijn.');

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    next();
  };
}

/**
 * Validates review request body
 */
export function validateReview() {
  return (req, res, next) => {
    const errors = [];
    const { provider_id, score, text } = req.body;

    if (!provider_id) errors.push('Provider ID is verplicht.');
    if (!score || score < 1 || score > 5) errors.push('Score moet tussen 1 en 5 zijn.');
    if (!text || text.trim().length === 0) errors.push('Review tekst is verplicht.');
    if (text && text.length > 5000) errors.push('Review moet korter zijn dan 5000 karakters.');

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    next();
  };
}

/**
 * Validates job request body
 */
export function validateJob() {
  return (req, res, next) => {
    const errors = [];
    const { title, description, category } = req.body;

    if (!title || title.trim().length === 0) errors.push('Job titel is verplicht.');
    if (!description || description.trim().length === 0) errors.push('Beschrijving is verplicht.');
    if (!category) errors.push('Categorie is verplicht.');

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    next();
  };
}

/**
 * Validates message request body
 */
export function validateMessage() {
  return (req, res, next) => {
    const errors = [];
    const { recipient_id, message } = req.body;

    if (!recipient_id) errors.push('Ontvanger ID is verplicht.');
    if (!message || message.trim().length === 0) errors.push('Bericht is verplicht.');
    if (message && message.length > 5000) errors.push('Bericht moet korter zijn dan 5000 karakters.');

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    next();
  };
}

/**
 * Validates password change request body
 */
export function validatePasswordChange() {
  return (req, res, next) => {
    const errors = [];
    const { user_id, current_password, new_password } = req.body;

    if (!user_id) errors.push('User ID is verplicht.');
    if (!current_password) errors.push('Huidig wachtwoord is verplicht.');
    if (!new_password) {
      errors.push('Nieuw wachtwoord is verplicht.');
    } else if (new_password.length < 6) {
      errors.push('Nieuw wachtwoord moet minimaal 6 tekens zijn.');
    }

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    next();
  };
}

/**
 * Generic validation for required fields
 * Usage: validateRequired(['email', 'password'], req, res, next)
 */
export function validateRequired(fields) {
  return (req, res, next) => {
    const errors = [];
    for (const field of fields) {
      const value = req.body[field];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        errors.push(`${field} is verplicht.`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    next();
  };
}
