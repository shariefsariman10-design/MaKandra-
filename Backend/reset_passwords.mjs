import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const db = await mysql.createConnection({
  host:     process.env.DB_HOST     || 'localhost',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'makandra',
});

const hash = await bcrypt.hash('makandra123', 10);

const [result] = await db.query(
  'UPDATE users SET password = ? WHERE id <= 75',
  [hash]
);

console.log(`✅ Reset ${result.affectedRows} seed accounts to password: makandra123`);
await db.end();
