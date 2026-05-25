import nodemailer from 'nodemailer';

export const mailer = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail(to, subject, html) {
  if (!process.env.SMTP_USER || process.env.SMTP_USER === 'your-email@gmail.com') {
    console.log('[EMAIL] SMTP not configured — skipping send to', to, '| Subject:', subject);
    return;
  }
  await mailer.sendMail({ from: process.env.FROM_EMAIL || process.env.SMTP_USER, to, subject, html });
}
