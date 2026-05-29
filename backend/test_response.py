from core.database import get_db_connection, get_cursor
import hashlib
import json
import base64

conn = get_db_connection()
cursor = get_cursor(conn)

email = "admin@qpgen.local"
password = "admin@123"

print("Testing full login response...")
print("=" * 60)

# Replicate login endpoint logic
pw_hash = hashlib.sha256(password.encode()).hexdigest()

# Get user
cursor.execute(
    "SELECT id, email, name, role, department, status, must_change_password, courses FROM users WHERE email = ?",
    (email.lower(),)
)
user = cursor.fetchone()

if user:
    # Verify password
    cursor.execute(
        "SELECT id FROM users WHERE email = ? AND password_hash = ?",
        (email.lower(), pw_hash)
    )
    match = cursor.fetchone()
    
    if match:
        # Build the response
        try:
            # Helper function from main.py
            def _make_token(user_id, email, role):
                payload = json.dumps({"id": user_id, "email": email, "role": role})
                return base64.b64encode(payload.encode()).decode()
            
            token = _make_token(user["id"], user["email"], user["role"] or "advisor")
            
            # Parse courses if available
            try:
                courses = json.loads(user["courses"]) if user["courses"] else []
            except (json.JSONDecodeError, TypeError):
                courses = []
            
            response = {
                "success": True,
                "token": token,
                "user": {
                    "id": user["id"],
                    "email": user["email"],
                    "name": user["name"],
                    "role": user["role"] or "advisor",
                    "department": user["department"],
                    "must_change_password": bool(user["must_change_password"]),
                    "mustChangePassword": bool(user["must_change_password"]),
                    "courses": courses
                }
            }
            
            # Try to serialize to JSON
            json_response = json.dumps(response)
            print("✓ Response successfully serialized:")
            print(json.dumps(json.loads(json_response), indent=2))
            
        except Exception as e:
            print(f"✗ Error building response: {e}")
            import traceback
            traceback.print_exc()

conn.close()
