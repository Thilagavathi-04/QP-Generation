#!/usr/bin/env python3
"""
Seed demo data for the Role Based Access Control (admin / hod / staff) demo.

Creates:
  - Demo users for each role (with department + assigned courses)
  - Demo subjects spread across two departments

Safe to re-run: existing users/subjects are updated instead of duplicated.
"""

import hashlib
import json
import sys
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

from core.database import get_db_connection, get_cursor, get_placeholder, init_database


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


DEMO_USERS = [
    {
        "email": "admin@qpgen.local",
        "name": "System Administrator",
        "password": "admin@123",
        "role": "admin",
        "department": "Administration",
        "courses": [],
    },
    {
        "email": "hod.aiml@qpgen.local",
        "name": "Dr. AIML Head",
        "password": "hod@123",
        "role": "hod",
        "department": "AIML",
        "courses": [],
    },
    {
        "email": "hod.cse@qpgen.local",
        "name": "Dr. CSE Head",
        "password": "hod@123",
        "role": "hod",
        "department": "CSE",
        "courses": [],
    },
    {
        "email": "staff.aiml@qpgen.local",
        "name": "AIML Staff One",
        "password": "staff@123",
        "role": "staff",
        "department": "AIML",
        "courses": [{"regulation": "2021", "subject": "Machine Learning"}],
    },
    {
        "email": "staff.cse@qpgen.local",
        "name": "CSE Staff One",
        "password": "staff@123",
        "role": "staff",
        "department": "CSE",
        "courses": [{"regulation": "2021", "subject": "Data Structures"}],
    },
]

DEMO_SUBJECTS = [
    ("CS8491", "Machine Learning", "AIML"),
    ("CS8402", "Deep Learning", "AIML"),
    ("CS8501", "Data Structures", "CSE"),
    ("CS8601", "Operating Systems", "CSE"),
]


def seed_users(connection):
    cursor = get_cursor(connection)
    placeholder = get_placeholder()
    for user in DEMO_USERS:
        cursor.execute(f"SELECT id FROM users WHERE email = {placeholder}", (user["email"],))
        existing = cursor.fetchone()
        pw_hash = _hash_password(user["password"])
        courses_str = json.dumps(user["courses"])
        if existing:
            cursor.execute(
                f"UPDATE users SET name = {placeholder}, role = {placeholder}, department = {placeholder}, "
                f"password_hash = {placeholder}, status = 'approved', must_change_password = 0, courses = {placeholder} "
                f"WHERE id = {placeholder}",
                (user["name"], user["role"], user["department"], pw_hash, courses_str, existing["id"]),
            )
            print(f"~ Updated {user['role'].upper()}: {user['email']}")
        else:
            cursor.execute(
                f"INSERT INTO users (email, name, role, department, password_hash, status, must_change_password, courses) "
                f"VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, 'approved', 0, {placeholder})",
                (user["email"], user["name"], user["role"], user["department"], pw_hash, courses_str),
            )
            print(f"+ Created {user['role'].upper()}: {user['email']}")
    connection.commit()
    cursor.close()


def seed_subjects(connection):
    cursor = get_cursor(connection)
    placeholder = get_placeholder()
    for code, name, department in DEMO_SUBJECTS:
        cursor.execute(f"SELECT id FROM subjects WHERE subject_id = {placeholder}", (code,))
        existing = cursor.fetchone()
        if existing:
            cursor.execute(
                f"UPDATE subjects SET department = {placeholder} WHERE id = {placeholder}",
                (department, existing["id"]),
            )
            print(f"~ Updated subject {name} ({code}) -> {department}")
        else:
            cursor.execute(
                f"INSERT INTO subjects (subject_id, name, department, use_book_for_generation) "
                f"VALUES ({placeholder}, {placeholder}, {placeholder}, 0)",
                (code, name, department),
            )
            print(f"+ Created subject {name} ({code}) -> {department}")
    connection.commit()
    cursor.close()


def main():
    print("=" * 60)
    print("Seeding RBAC demo users and subjects")
    print("=" * 60)

    if not init_database():
        print("❌ Failed to initialize database")
        sys.exit(1)

    connection = get_db_connection()
    if not connection:
        print("❌ Failed to connect to database")
        sys.exit(1)

    seed_users(connection)
    seed_subjects(connection)
    connection.close()

    print("\nDemo credentials (all passwords are the part after the colon):")
    for user in DEMO_USERS:
        print(f"  {user['role'].upper():6s} {user['email']:26s} -> {user['password']}")
    print("=" * 60)


if __name__ == "__main__":
    main()
