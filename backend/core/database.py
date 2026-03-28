import os
import sqlite3
from pathlib import Path
from dotenv import load_dotenv

# Calculate base directory relative to this file
CORE_DIR = Path(__file__).resolve().parent
BASE_DIR = CORE_DIR.parent  # Root of backend
DATA_DIR = BASE_DIR / "data"

# Create data directory if it doesn't exist
DATA_DIR.mkdir(exist_ok=True)

# Load environment variables, looking for .env in the backend directory
load_dotenv(BASE_DIR / ".env")

# Import MySQL connector only if MySQL is being used
db_type = os.getenv('DB_TYPE', 'sqlite').lower()
if db_type == 'mysql':
    import mysql.connector
    from mysql.connector import Error
    
else:
    # Define a dummy Error class for SQLite
    class Error(Exception):
        pass

def get_db_type():
    """Return the current database type"""
    return db_type


def _resolve_sqlite_path(raw_path: str) -> Path:
    path = Path(raw_path)
    if not path.is_absolute():
        path = BASE_DIR / path
    path.parent.mkdir(parents=True, exist_ok=True)
    return path

def get_placeholder():
    """Return the correct SQL placeholder for the current database type"""
    return "?" if db_type == "sqlite" else "%s"

def get_cursor(connection):
    """Create and return a cursor appropriate for the database type"""
    db_type = get_db_type()
    if db_type == 'sqlite':
        return connection.cursor()
    else:  # mysql
        return connection.cursor(dictionary=True)

def get_db_connection():
    """Create and return a database connection"""
    db_type = os.getenv('DB_TYPE', 'sqlite').lower()

    if db_type == 'sqlite':
        try:
            default_path = str(DATA_DIR / "quest_generator.db")
            db_path = os.getenv('DB_PATH', default_path)
            resolved_path = _resolve_sqlite_path(db_path)
            connection = sqlite3.connect(str(resolved_path))
            connection.row_factory = sqlite3.Row  # Enable column access by name
            return connection
        except sqlite3.Error as e:
            print(f"Error connecting to SQLite: {e}")
            return None
    else:  # mysql
        try:
            connection = mysql.connector.connect(
                host=os.getenv('DB_HOST', '127.0.0.1'),
                port=int(os.getenv('DB_PORT', 3306)),
                user=os.getenv('DB_USER', 'root'),
                password=os.getenv('DB_PASSWORD', ''),
                database=os.getenv('DB_NAME', 'quest_generator_db')
            )
            return connection
        except Error as e:
            print(f"Error connecting to MySQL: {e}")
            return None

def migrate_database():
    """Ensure all required columns exist in the database."""
    connection = get_db_connection()
    if not connection:
        return
    
    try:
        cursor = connection.cursor()
        db_type = get_db_type()
        
        # Columns to add to blueprints table
        new_columns = [
            ('parts_config', 'TEXT' if db_type == 'sqlite' else 'TEXT'),
            ('total_questions', 'INTEGER' if db_type == 'sqlite' else 'INT'),
            ('total_marks', 'REAL' if db_type == 'sqlite' else 'DECIMAL(6,2)')
        ]
        
        for col_name, col_type in new_columns:
            try:
                cursor.execute(f"ALTER TABLE blueprints ADD COLUMN {col_name} {col_type}")
                print(f"Added column {col_name} to blueprints table.")
            except:
                pass

        # Ensure blueprint_parts table exists (backfill for older schemas)
        try:
            if db_type == 'sqlite':
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS blueprint_parts (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        blueprint_id INTEGER NOT NULL,
                        part_name TEXT NOT NULL,
                        instructions TEXT,
                        num_questions INTEGER NOT NULL,
                        marks_per_question REAL NOT NULL,
                        difficulty TEXT,
                        part_order INTEGER,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (blueprint_id) REFERENCES blueprints(id) ON DELETE CASCADE
                    )
                """)
            else:
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS blueprint_parts (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        blueprint_id INT NOT NULL,
                        part_name VARCHAR(255) NOT NULL,
                        instructions TEXT,
                        num_questions INT NOT NULL,
                        marks_per_question DECIMAL(6,2) NOT NULL,
                        difficulty VARCHAR(50),
                        part_order INT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (blueprint_id) REFERENCES blueprints(id) ON DELETE CASCADE
                    )
                """)
        except:
            pass

        # Add questions_data to question_papers
        try:
            cursor.execute(f"ALTER TABLE question_papers ADD COLUMN questions_data TEXT")
            print("Added column questions_data to question_papers table.")
        except:
            pass

        # Add course_outcome_file to subjects
        try:
            if db_type == 'sqlite':
                cursor.execute("ALTER TABLE subjects ADD COLUMN course_outcome_file TEXT")
            else:
                cursor.execute("ALTER TABLE subjects ADD COLUMN course_outcome_file VARCHAR(500)")
            print("Added column course_outcome_file to subjects table.")
        except:
            pass

        # Add blooms_level to questions
        try:
            if db_type == 'sqlite':
                cursor.execute("ALTER TABLE questions ADD COLUMN blooms_level TEXT")
            else:
                cursor.execute("ALTER TABLE questions ADD COLUMN blooms_level VARCHAR(100)")
            print("Added column blooms_level to questions table.")
        except:
            pass
        
        connection.commit()
        cursor.close()
        connection.close()
    except Exception as e:
        print(f"Migration error: {e}")

def init_database():
    """Initialize database and create tables if they don't exist"""
    db_type = os.getenv('DB_TYPE', 'sqlite').lower()

    try:
        if db_type == 'sqlite':
            # SQLite initialization
            default_path = str(DATA_DIR / "quest_generator.db")
            db_path = os.getenv('DB_PATH', default_path)
            resolved_path = _resolve_sqlite_path(db_path)
            connection = sqlite3.connect(str(resolved_path))
            cursor = connection.cursor()

            # Enable foreign key constraints
            cursor.execute("PRAGMA foreign_keys = ON")

            # Create subjects table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS subjects (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    subject_id TEXT NOT NULL UNIQUE,
                    name TEXT NOT NULL,
                    syllabus_file TEXT,
                    book_file TEXT,
                    course_outcome_file TEXT,
                    use_book_for_generation INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(name)
                )
            """)

            # Create units table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS units (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    subject_id INTEGER NOT NULL,
                    unit_number INTEGER NOT NULL,
                    unit_title TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
                    UNIQUE(subject_id, unit_number)
                )
            """)

            # Create topics table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS topics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    topic_id TEXT NOT NULL UNIQUE,
                    unit_id INTEGER NOT NULL,
                    topic_name TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
                )
            """)

            # Create subtopics table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS subtopics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    topic_id INTEGER NOT NULL,
                    subtopic_name TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
                )
            """)

            # Create question_banks table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS question_banks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    subject_id INTEGER NOT NULL,
                    description TEXT,
                    total_questions INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
                )
            """)

            # Create questions table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS questions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    question_bank_id INTEGER NOT NULL,
                    subject_id INTEGER NOT NULL,
                    content TEXT NOT NULL,
                    part TEXT,
                    unit TEXT,
                    topic TEXT,
                    difficulty TEXT,
                    marks REAL,
                    blooms_level TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (question_bank_id) REFERENCES question_banks(id) ON DELETE CASCADE,
                    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
                )
            """)

            # Create blueprints table with new columns
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS blueprints (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    description TEXT,
                    file_name TEXT,
                    file_path TEXT,
                    parts_config TEXT,
                    total_questions INTEGER,
                    total_marks REAL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Create blueprint_parts table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS blueprint_parts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    blueprint_id INTEGER NOT NULL,
                    part_name TEXT NOT NULL,
                    instructions TEXT,
                    num_questions INTEGER NOT NULL,
                    marks_per_question REAL NOT NULL,
                    difficulty TEXT,
                    part_order INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (blueprint_id) REFERENCES blueprints(id) ON DELETE CASCADE
                )
            """)

            # Create question_papers table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS question_papers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    subject_id INTEGER NOT NULL,
                    blueprint_id INTEGER,
                    exam_type TEXT,
                    exam_date DATE,
                    total_marks REAL,
                    file_format TEXT,
                    file_path TEXT,
                    questions_data TEXT,
                    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
                    FOREIGN KEY (blueprint_id) REFERENCES blueprints(id) ON DELETE SET NULL
                )
            """)

            # Create users table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT NOT NULL UNIQUE,
                    name TEXT NOT NULL,
                    status TEXT DEFAULT 'pending',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_login DATETIME
                )
            """)

            # Create answer_scripts table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS answer_scripts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    question_paper_id INTEGER NOT NULL,
                    answer_data TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (question_paper_id) REFERENCES question_papers(id) ON DELETE CASCADE
                )
            """)

            # Create evaluations table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS evaluations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    question_paper_id INTEGER NOT NULL,
                    student_name TEXT NOT NULL,
                    register_number TEXT NOT NULL,
                    department TEXT NOT NULL,
                    marks_obtained REAL,
                    total_marks REAL,
                    result_status TEXT, -- 'PASS' or 'FAIL'
                    evaluation_details TEXT, -- JSON breakdown per question
                    file_path TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (question_paper_id) REFERENCES question_papers(id) ON DELETE CASCADE
                )
            """)

        else:  # MySQL initialization
            # First connect without database to create it
            connection = mysql.connector.connect(
                host=os.getenv('DB_HOST', '127.0.0.1'),
                port=int(os.getenv('DB_PORT', 3306)),
                user=os.getenv('DB_USER', 'root'),
                password=os.getenv('DB_PASSWORD', '')
            )
            cursor = connection.cursor()

            # Create database if it doesn't exist
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {os.getenv('DB_NAME', 'quest_generator_db')}")
            cursor.close()
            connection.close()

            # Now connect to the database
            connection = get_db_connection()
            if not connection:
                return False
            cursor = connection.cursor()

            # Create subjects table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS subjects (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    subject_id VARCHAR(50) NOT NULL UNIQUE,
                    name VARCHAR(255) NOT NULL,
                    syllabus_file VARCHAR(500),
                    book_file VARCHAR(500),
                    course_outcome_file VARCHAR(500),
                    use_book_for_generation BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY unique_name (name)
                )
            """)

            # Create units table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS units (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    subject_id INT NOT NULL,
                    unit_number INT NOT NULL,
                    unit_title VARCHAR(500) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
                    UNIQUE KEY unique_unit (subject_id, unit_number)
                )
            """)

            # Create topics table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS topics (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    topic_id VARCHAR(100) NOT NULL UNIQUE,
                    unit_id INT NOT NULL,
                    topic_name VARCHAR(500) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
                )
            """)

            # Create subtopics table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS subtopics (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    topic_id INT NOT NULL,
                    subtopic_name VARCHAR(500) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
                )
            """)

            # Create question_banks table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS question_banks (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    subject_id INT NOT NULL,
                    description TEXT,
                    total_questions INT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
                )
            """)

            # Create questions table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS questions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    question_bank_id INT NOT NULL,
                    subject_id INT NOT NULL,
                    content TEXT NOT NULL,
                    part VARCHAR(50),
                    unit VARCHAR(50),
                    topic VARCHAR(255),
                    difficulty VARCHAR(50),
                    marks DECIMAL(5,2),
                    blooms_level VARCHAR(100),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (question_bank_id) REFERENCES question_banks(id) ON DELETE CASCADE,
                    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
                )
            """)

            # Create blueprints table with new columns
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS blueprints (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    file_name VARCHAR(500),
                    file_path VARCHAR(1000),
                    parts_config TEXT,
                    total_questions INT,
                    total_marks DECIMAL(6,2),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            """)

            # Create blueprint_parts table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS blueprint_parts (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    blueprint_id INT NOT NULL,
                    part_name VARCHAR(255) NOT NULL,
                    instructions TEXT,
                    num_questions INT NOT NULL,
                    marks_per_question DECIMAL(6,2) NOT NULL,
                    difficulty VARCHAR(50),
                    part_order INT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (blueprint_id) REFERENCES blueprints(id) ON DELETE CASCADE
                )
            """)
            

            # Create question_papers table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS question_papers (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    title VARCHAR(255) NOT NULL,
                    subject_id INT NOT NULL,
                    blueprint_id INT,
                    exam_type VARCHAR(100),
                    exam_date DATE,
                    total_marks DECIMAL(6,2),
                    file_format VARCHAR(20),
                    file_path VARCHAR(1000),
                    questions_data LONGTEXT,
                    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
                    FOREIGN KEY (blueprint_id) REFERENCES blueprints(id) ON DELETE SET NULL
                )
            """)

            # Create users table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    email VARCHAR(255) NOT NULL UNIQUE,
                    name VARCHAR(255) NOT NULL,
                    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login TIMESTAMP
                )
            """)

            # Create answer_scripts table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS answer_scripts (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    question_paper_id INT NOT NULL,
                    answer_data LONGTEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (question_paper_id) REFERENCES question_papers(id) ON DELETE CASCADE
                )
            """)

            # Create evaluations table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS evaluations (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    question_paper_id INT NOT NULL,
                    student_name VARCHAR(255) NOT NULL,
                    register_number VARCHAR(100) NOT NULL,
                    department VARCHAR(255) NOT NULL,
                    marks_obtained DECIMAL(5,2),
                    total_marks DECIMAL(5,2),
                    result_status VARCHAR(20),
                    evaluation_details LONGTEXT,
                    file_path VARCHAR(1000),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (question_paper_id) REFERENCES question_papers(id) ON DELETE CASCADE
                )
            """)

        connection.commit()
        cursor.close()
        connection.close()
        
        # Run migrations
        migrate_database()
        
        print(f"Database initialized successfully using {db_type.upper()}!")
        return True
    except (sqlite3.Error, Error) as e:
        print(f"Error initializing database: {e}")
        return False