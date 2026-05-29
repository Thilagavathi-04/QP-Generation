from core.database import get_db_connection
import sqlite3

conn = get_db_connection()
cursor = conn.cursor()
cursor.execute('PRAGMA table_info(users)')
result = cursor.fetchall()
print("Current users table schema:")
print("=" * 60)
for row in result:
    print(f"  Column: {row[1]:<25} Type: {row[2]:<15} NotNull: {row[3]} Default: {row[4]}")
print("=" * 60)

# Also test a query
try:
    cursor.execute('SELECT id, email, name, role, department FROM users LIMIT 1')
    user = cursor.fetchone()
    print(f"\nTest query successful: {user}")
except Exception as e:
    print(f"\nTest query failed: {e}")

conn.close()
