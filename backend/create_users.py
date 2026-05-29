#!/usr/bin/env python3
"""
Script to create admin and advisor users in the database.
Ensures all required columns exist in the users table first.
"""

import os
import sqlite3
import sys
import hashlib
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

# Import database functions
from core.database import get_db_connection, get_db_type, get_cursor, get_placeholder

def _hash_password(password: str) -> str:
    """SHA-256 hash of password"""
    return hashlib.sha256(password.encode()).hexdigest()

def ensure_user_columns():
    """Ensure all required columns exist in the users table"""
    connection = get_db_connection()
    if not connection:
        print("❌ Failed to connect to database")
        return False
    
    try:
        cursor = get_cursor(connection)
        db_type = get_db_type()
        
        # Columns to add to users table
        columns_to_add = [
            ('role', 'TEXT' if db_type == 'sqlite' else 'VARCHAR(50)', "DEFAULT 'advisor'"),
            ('department', 'TEXT' if db_type == 'sqlite' else 'VARCHAR(255)', ""),
            ('password_hash', 'TEXT' if db_type == 'sqlite' else 'VARCHAR(255)', ""),
            ('must_change_password', 'INTEGER' if db_type == 'sqlite' else 'BOOLEAN', "DEFAULT 0"),
            ('courses', 'TEXT' if db_type == 'sqlite' else 'JSON', "DEFAULT '[]'"),
        ]
        
        for col_name, col_type, col_default in columns_to_add:
            try:
                if db_type == 'sqlite':
                    alter_sql = f"ALTER TABLE users ADD COLUMN {col_name} {col_type} {col_default}"
                else:
                    alter_sql = f"ALTER TABLE users ADD COLUMN {col_name} {col_type} {col_default}"
                
                cursor.execute(alter_sql)
                print(f"✓ Added column '{col_name}' to users table")
            except Exception as e:
                # Column likely already exists
                if "already exists" in str(e) or "Duplicate column" in str(e):
                    print(f"✓ Column '{col_name}' already exists")
                else:
                    print(f"✓ Column '{col_name}' check passed")
        
        connection.commit()
        cursor.close()
        connection.close()
        return True
    except Exception as e:
        print(f"❌ Error ensuring columns: {e}")
        if connection:
            connection.close()
        return False

def create_user(email: str, name: str, password: str, role: str, department: str = None):
    """Create a new user with the specified details"""
    connection = get_db_connection()
    if not connection:
        print(f"❌ Failed to connect to database for user {name}")
        return False
    
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        email = email.strip().lower()
        
        # Check if user already exists
        cursor.execute(f"SELECT id FROM users WHERE email = {placeholder}", (email,))
        if cursor.fetchone():
            print(f"⚠️  User with email '{email}' already exists")
            cursor.close()
            connection.close()
            return True
        
        # Hash password
        pw_hash = _hash_password(password)
        must_change = 0 if password != "12345678" else 1
        
        # Insert user
        cursor.execute(
            f"INSERT INTO users (email, name, role, department, password_hash, status, must_change_password, courses) "
            f"VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, 'approved', {placeholder}, {placeholder})",
            (email, name, role, department, pw_hash, must_change, "[]")
        )
        connection.commit()
        user_id = cursor.lastrowid
        cursor.close()
        connection.close()
        
        print(f"✓ Created {role.upper()} user: {name} ({email}) - ID: {user_id}")
        return True
    except Exception as e:
        print(f"❌ Error creating user {name}: {e}")
        if connection:
            connection.close()
        return False

def main():
    print("=" * 60)
    print("QP-Generation: Create Admin and Advisor Users")
    print("=" * 60)
    
    # Step 1: Ensure columns exist
    print("\n📋 Step 1: Ensuring database schema is up to date...")
    if not ensure_user_columns():
        print("Failed to update database schema")
        sys.exit(1)
    
    # Step 2: Create admin user
    print("\n👤 Step 2: Creating admin user...")
    admin_created = create_user(
        email="admin@qpgen.local",
        name="System Administrator",
        password="admin@123",  # Change this to a secure password
        role="admin",
        department="Administration"
    )
    
    # Step 3: Create advisor user
    print("\n👤 Step 3: Creating advisor user...")
    advisor_created = create_user(
        email="advisor@qpgen.local",
        name="Academic Advisor",
        password="advisor@123",  # Change this to a secure password
        role="advisor",
        department="Academic Affairs"
    )
    
    # Summary
    print("\n" + "=" * 60)
    if admin_created and advisor_created:
        print("✓ Successfully created all users!")
        print("\nLogin Credentials:")
        print("Admin User:")
        print("  Email: admin@qpgen.local")
        print("  Password: admin@123")
        print("\nAdvisor User:")
        print("  Email: advisor@qpgen.local")
        print("  Password: advisor@123")
        print("\n⚠️  IMPORTANT: Change these passwords immediately in production!")
    else:
        print("⚠️  Some users may not have been created successfully")
    print("=" * 60)

if __name__ == "__main__":
    main()
