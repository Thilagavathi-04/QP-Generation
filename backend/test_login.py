from core.database import get_db_connection, get_cursor
import hashlib
import json

conn = get_db_connection()
cursor = get_cursor(conn)

# Test login with admin user
email = "admin@qpgen.local"
password = "admin@123"

print(f"Testing login for: {email}")
print("=" * 60)

# Hash the password
pw_hash = hashlib.sha256(password.encode()).hexdigest()

# First query: get user
cursor.execute(
    "SELECT id, email, name, role, department, status, must_change_password, courses FROM users WHERE email = ?",
    (email.lower(),)
)
user = cursor.fetchone()

if user:
    print("✓ User found:")
    print(f"  ID: {user['id']}")
    print(f"  Email: {user['email']}")
    print(f"  Name: {user['name']}")
    print(f"  Role: {user['role']}")
    print(f"  Department: {user['department']}")
    print(f"  Status: {user['status']}")
    print(f"  Must Change: {user['must_change_password']}")
    print(f"  Courses: {user['courses']}")
    
    # Second query: verify password
    cursor.execute(
        "SELECT id FROM users WHERE email = ? AND password_hash = ?",
        (email.lower(), pw_hash)
    )
    match = cursor.fetchone()
    if match:
        print("\n✓ Password verified successfully!")
    else:
        print("\n✗ Password verification failed!")
        # Let's debug this
        cursor.execute("SELECT password_hash FROM users WHERE email = ?", (email.lower(),))
        db_row = cursor.fetchone()
        if db_row:
            db_hash = db_row['password_hash']
            print(f"  Expected hash: {pw_hash}")
            print(f"  Database hash: {db_hash}")
            print(f"  Match: {pw_hash == db_hash}")
else:
    print("✗ User not found!")
    
    # List all users
    cursor.execute("SELECT id, email, name, role FROM users")
    all_users = cursor.fetchall()
    print("\nAvailable users:")
    for u in all_users:
        print(f"  - {u['email']} ({u['name']}, role: {u['role']})")

conn.close()
