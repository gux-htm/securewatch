import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool({
  host:               process.env['DB_HOST']     ?? 'localhost',
  port:               Number(process.env['DB_PORT'] ?? 3306),
  user:               process.env['DB_USER']     ?? 'root',
  password:           process.env['DB_PASSWORD'] ?? '',
  database:           process.env['DB_NAME']     ?? 'securewatch',
  waitForConnections: true,
  connectionLimit:    10,
  timezone:           'Z',
});

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const [rows] = await pool.execute(sql, params);
  return rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function execute(
  sql: string,
  params?: unknown[],
): Promise<{ insertId: number; affectedRows: number }> {
  const [result] = (await pool.execute(sql, params)) as unknown[];
  const r = result as { insertId: number; affectedRows: number };
  return { insertId: r.insertId, affectedRows: r.affectedRows };
}

export default pool;
