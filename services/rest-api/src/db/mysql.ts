import mysql from 'mysql2/promise';

// mysql2 accepted parameter types for parameterised queries
type SqlParam = string | number | boolean | null | Date | Buffer;

const pool = mysql.createPool({
  host:               process.env['DB_HOST']     ?? 'localhost',
  port:               Number(process.env['DB_PORT'] ?? 3306),
  user:               process.env['DB_USER']     ?? 'root',
  password:           process.env['DB_PASSWORD'] ?? '',
  database:           process.env['DB_NAME']     ?? 'securewatch',
  waitForConnections: true,
  connectionLimit:    20,
  queueLimit:         0,
  timezone:           'Z',
  dateStrings:        false,
  typeCast:           true,
});

pool.on('connection', (connection) => {
  connection.query("SET NAMES 'utf8mb4'");
  connection.query("SET time_zone = '+00:00'");
});

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: SqlParam[],
): Promise<T[]> {
  const [rows] = await pool.execute(sql, params);
  return rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: SqlParam[],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function execute(
  sql: string,
  params?: SqlParam[],
): Promise<{ insertId: number; affectedRows: number }> {
  const [result] = await pool.execute(sql, params);
  const r = result as { insertId: number; affectedRows: number };
  return { insertId: r.insertId, affectedRows: r.affectedRows };
}

export async function testConnection(): Promise<boolean> {
  try {
    await pool.execute('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export default pool;
