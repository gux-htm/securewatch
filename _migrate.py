import psycopg2, sys

conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/securewatch")
conn.autocommit = True
cur = conn.cursor()

stmts = [
    # devices new columns
    "ALTER TABLE devices ADD COLUMN IF NOT EXISTS username TEXT",
    "ALTER TABLE devices ADD COLUMN IF NOT EXISTS password_hash TEXT",
    "ALTER TABLE devices ADD COLUMN IF NOT EXISTS passkey_credential_id TEXT",
    "ALTER TABLE devices ADD COLUMN IF NOT EXISTS passkey_public_key TEXT",
    "ALTER TABLE devices ADD COLUMN IF NOT EXISTS passkey_counter INTEGER DEFAULT 0",
    "ALTER TABLE devices ADD COLUMN IF NOT EXISTS passkey_challenge TEXT",
    # Add new status values to enum (safe — just adds, doesn't remove)
    "ALTER TYPE device_status ADD VALUE IF NOT EXISTS 'pending_approval'",
    "ALTER TYPE device_status ADD VALUE IF NOT EXISTS 'approved_awaiting_setup'",
    # file_events new columns
    "ALTER TABLE file_events ADD COLUMN IF NOT EXISTS mac_address TEXT",
    "ALTER TABLE file_events ADD COLUMN IF NOT EXISTS ip_address TEXT",
    "ALTER TABLE file_events ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'info'",
]

for s in stmts:
    try:
        cur.execute(s)
        print(f"OK: {s[:60]}")
    except Exception as e:
        print(f"SKIP ({e}): {s[:60]}")

# Add unique constraint on username only if not exists
try:
    cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS devices_username_unique ON devices(username) WHERE username IS NOT NULL")
    print("OK: unique index on devices.username")
except Exception as e:
    print(f"SKIP: {e}")

cur.close()
conn.close()
print("Migration complete.")
