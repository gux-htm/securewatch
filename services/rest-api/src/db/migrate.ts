import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

async function runMigrations(): Promise<void> {
  const dbName = process.env['DB_NAME'] ?? 'securewatch';

  // Connect WITHOUT a database first so we can CREATE it
  const connection = await mysql.createConnection({
    host:               process.env['DB_HOST']     ?? 'localhost',
    port:               Number(process.env['DB_PORT'] ?? 3306),
    user:               process.env['DB_USER']     ?? 'root',
    password:           process.env['DB_PASSWORD'] ?? '',
    multipleStatements: true,
  });

  console.log('[migrate] Connected to MySQL');

  // DDL statements must use query(), not execute()
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await connection.query(`USE \`${dbName}\``);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      filename   VARCHAR(255) NOT NULL UNIQUE,
      applied_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Use query() for SELECT too — execute() is for parameterised DML
  const [applied] = await connection.query('SELECT filename FROM _migrations');
  const appliedSet = new Set(
    (applied as Array<{ filename: string }>).map((r) => r.filename),
  );

  const migrationsDir = path.join(__dirname, '../../../../database/migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  ✓ Already applied: ${file}`);
      continue;
    }

    console.log(`  → Running: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

    try {
      await connection.query(sql);
      // Use execute() only for parameterised INSERT
      await connection.execute('INSERT INTO _migrations (filename) VALUES (?)', [file]);
      console.log(`  ✓ Done: ${file}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ FAILED: ${file}\n    ${msg}`);
      process.exit(1);
    }
  }

  console.log('\n✅ All migrations complete');
  await connection.end();
}

runMigrations().catch(console.error);
