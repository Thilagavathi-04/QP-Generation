import sys
from core.database import get_db_connection, get_db_type

def main():
    conn = get_db_connection()
    if not conn:
        print("Failed to connect to database")
        sys.exit(1)
        
    cursor = conn.cursor()
    db_type = get_db_type()
    
    if db_type == "mysql":
        query = """
            CREATE TABLE IF NOT EXISTS user_drafts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                subject_id INT NOT NULL,
                active_job_id VARCHAR(100),
                draft_data LONGTEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY user_subject (user_id, subject_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
            )
        """
    else:
        query = """
            CREATE TABLE IF NOT EXISTS user_drafts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                subject_id INTEGER NOT NULL,
                active_job_id TEXT,
                draft_data TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, subject_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
            )
        """
        
    try:
        cursor.execute(query)
        conn.commit()
        print("Table user_drafts created successfully.")
    except Exception as e:
        print(f"Error creating table: {e}")
        
    cursor.close()
    conn.close()

if __name__ == "__main__":
    main()
