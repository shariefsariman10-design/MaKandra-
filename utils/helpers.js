import crypto from 'crypto';

export const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:5500';

export function genToken() { return crypto.randomBytes(32).toString('hex'); }

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function formatDur(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}u${m ? m + 'min' : ''}`;
}

/** Consistent user shape returned by signup & login. */
export function buildUserPayload(u) {
  return {
    id:              u.id,
    name:            u.name,
    first_name:      u.first_name     || null,
    last_name:       u.last_name      || null,
    email:           u.email,
    role:            u.role,
    role_id:         u.role_id        || null,
    buurt:           u.buurt,
    category:        u.category       || null,
    experience:      u.experience     || null,
    bio:             u.bio            || null,
    hourly_rate:     u.hourly_rate    || null,
    phone:           u.phone          || null,
    working_hours:   u.working_hours  || null,
    profile_picture: u.profile_picture || null,
    is_available:    u.is_available   ?? 1,
    is_admin:        u.is_admin       || 0,
  };
}

export function htmlPage(title, message, success) {
  const color = success ? '#166534' : '#842029';
  const bg    = success ? '#d1e7dd' : '#f8d7da';
  return `<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"><title>${title} — MaKandra</title>
  <style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f3ef}
  .box{background:#fff;border-radius:16px;padding:40px;max-width:480px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.1)}
  h1{color:${color};margin-bottom:12px}.msg{background:${bg};color:${color};border-radius:10px;padding:16px;margin:20px 0;font-size:.95rem}
  a{display:inline-block;margin-top:16px;background:#6c47ff;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600}</style>
  </head><body><div class="box"><h1>${title}</h1><div class="msg">${message}</div>
  <a href="${FRONTEND}">Terug naar MaKandra</a></div></body></html>`;
}
