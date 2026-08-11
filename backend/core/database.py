import os
from pathlib import Path
from dotenv import load_dotenv
import mysql.connector
from mysql.connector import Error

# Calculate base directory relative to this file
CORE_DIR = Path(__file__).resolve().parent
BASE_DIR = CORE_DIR.parent  # Root of backend
DATA_DIR = BASE_DIR / "data"

# Create data directory for file uploads
DATA_DIR.mkdir(exist_ok=True)
(DATA_DIR / "uploads").mkdir(exist_ok=True)
(DATA_DIR / "question_images").mkdir(exist_ok=True)
(DATA_DIR / "uploads" / "blueprints").mkdir(exist_ok=True)
(DATA_DIR / "uploads" / "books").mkdir(exist_ok=True)
(DATA_DIR / "uploads" / "papers").mkdir(exist_ok=True)
(DATA_DIR / "uploads" / "syllabus").mkdir(exist_ok=True)
(DATA_DIR / "uploads" / "question_images").mkdir(exist_ok=True)
(DATA_DIR / "uploads" / "student_submissions").mkdir(exist_ok=True)
(DATA_DIR / "uploads" / "course_outcomes").mkdir(exist_ok=True)

# Load environment variables, looking for .env in the backend directory
load_dotenv(BASE_DIR / ".env")

# MySQL only configuration
DB_TYPE = 'mysql'

def get_db_type():
    """Return the current database type (MySQL only)"""
    return DB_TYPE

def get_placeholder():
    """Return the correct SQL placeholder for MySQL"""
    return "%s"

def get_cursor(connection):
    """Create and return a cursor for MySQL with dictionary=True"""
    return connection.cursor(dictionary=True)

def get_db_connection():
    """Create and return a MySQL database connection"""
    try:
        connection = mysql.connector.connect(
            host=os.getenv('DB_HOST', '127.0.0.1'),
            port=int(os.getenv('DB_PORT', 3306)),
            user=os.getenv('DB_USER', 'root'),
            password=os.getenv('DB_PASSWORD', ''),
            database=os.getenv('DB_NAME', 'quest_generator')
        )
        return connection
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
        return None

def migrate_database():
    """Ensure all required columns exist in the database (MySQL only)."""
    connection = get_db_connection()
    if not connection:
        return
    
    try:
        cursor = get_cursor(connection)
        
        # Columns to add to blueprints table
        new_columns = [
            ('parts_config', 'TEXT'),
            ('total_questions', 'INT'),
            ('total_marks', 'DECIMAL(6,2)')
        ]
        
        for col_name, col_type in new_columns:
            try:
                cursor.execute(f"ALTER TABLE blueprints ADD COLUMN {col_name} {col_type}")
                print(f"Added column {col_name} to blueprints table.")
            except:
                pass

        # Ensure blueprint_parts table exists
        try:
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
            cursor.execute("ALTER TABLE subjects ADD COLUMN course_outcome_file VARCHAR(500)")
            print("Added column course_outcome_file to subjects table.")
        except:
            pass

        # Add blooms_level to questions
        try:
            cursor.execute("ALTER TABLE questions ADD COLUMN blooms_level VARCHAR(100)")
            print("Added column blooms_level to questions table.")
        except:
            pass

        # Create question_images table if it doesn't exist
        try:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS question_images (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    keywords TEXT NOT NULL,
                    description TEXT NOT NULL,
                    image_blob LONGBLOB NOT NULL,
                    source_type VARCHAR(100),
                    source_reference VARCHAR(500),
                    file_name VARCHAR(255),
                    file_path VARCHAR(1000),
                    file_hash VARCHAR(64),
                    mime_type VARCHAR(100),
                    width INT,
                    height INT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    KEY idx_keywords (keywords(100)),
                    KEY idx_file_hash (file_hash)
                )
            """)
            print("Created question_images table.")
        except Exception as e:
            print(f"question_images table already exists or error: {e}")

        # Add image file metadata columns if missing
        image_columns = [
            ('file_path', 'VARCHAR(1000)'),
            ('file_hash', 'VARCHAR(64)'),
            ('mime_type', 'VARCHAR(100)'),
            ('width', 'INT'),
            ('height', 'INT'),
        ]
        for col_name, col_type in image_columns:
            try:
                cursor.execute(f"ALTER TABLE question_images ADD COLUMN {col_name} {col_type}")
                print(f"Added column {col_name} to question_images table.")
            except:
                pass

        try:
            cursor.execute("CREATE INDEX idx_file_hash ON question_images(file_hash)")
        except:
            pass
        
        # Add missing columns to users table
        users_columns = [
            ('password_hash', 'VARCHAR(255)'),
            ('role', "VARCHAR(50) DEFAULT 'advisor'"),
            ('department', 'VARCHAR(255)'),
            ('must_change_password', 'BOOLEAN DEFAULT FALSE'),
            ('courses', 'JSON')
        ]
        for col_name, col_type in users_columns:
            try:
                cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
                print(f"Added column {col_name} to users table.")
            except:
                pass
        
        connection.commit()
        cursor.close()
        connection.close()
    except Exception as e:
        print(f"Migration error: {e}")

def init_database():
    """Initialize MySQL database and create tables if they don't exist"""
    try:
        # First connect without database to create it
        connection = mysql.connector.connect(
            host=os.getenv('DB_HOST', '127.0.0.1'),
            port=int(os.getenv('DB_PORT', 3306)),
            user=os.getenv('DB_USER', 'root'),
            password=os.getenv('DB_PASSWORD', '')
        )
        cursor = connection.cursor()

        # Create database if it doesn't exist
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {os.getenv('DB_NAME', 'quest_generator')}")
        cursor.close()
        connection.close()

        # Now connect to the database
        connection = get_db_connection()
        if not connection:
            return False
        cursor = get_cursor(connection)

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
                password_hash VARCHAR(255),
                role VARCHAR(50) DEFAULT 'advisor',
                department VARCHAR(255),
                status VARCHAR(20) DEFAULT 'pending',
                must_change_password BOOLEAN DEFAULT FALSE,
                courses JSON,
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

        # Create question_images table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS question_images (
                id INT AUTO_INCREMENT PRIMARY KEY,
                keywords TEXT NOT NULL,
                description TEXT NOT NULL,
                image_blob LONGBLOB NOT NULL,
                source_type VARCHAR(100),
                source_reference VARCHAR(500),
                file_name VARCHAR(255),
                file_path VARCHAR(1000),
                file_hash VARCHAR(64),
                mime_type VARCHAR(100),
                width INT,
                height INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                KEY idx_keywords (keywords(100)),
                KEY idx_file_hash (file_hash)
            )
        """)

        connection.commit()
        cursor.close()
        connection.close()
        
        # Run migrations
        migrate_database()
        
        print("Database initialized successfully using MySQL!")
        return True
    except Error as e:
        print(f"Error initializing database: {e}")
        return False