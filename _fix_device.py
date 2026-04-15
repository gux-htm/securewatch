import psycopg2
conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/securewatch")
conn.autocommit = True
cur = conn.cursor()
cur.execute("UPDATE devices SET status = 'active' WHERE id = 11 AND status = 'approved_awaiting_setup'")
print(f"Rows updated: {cur.rowcount}")
cur.execute("SELECT id, hostname, status, username FROM devices WHERE id = 11")
print(cur.fetchone())
cur.close(); conn.close()
