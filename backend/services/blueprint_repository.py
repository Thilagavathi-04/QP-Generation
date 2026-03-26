import json
import os
import re
import time
from pathlib import Path
from core.database import get_db_connection, get_cursor, get_placeholder
from services.default_blueprint import DEFAULT_BLUEPRINT_STRUCTURE

NUMBER_WORDS = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
}


def _effective_count_from_instruction(instruction: str, configured_count: int) -> int:
    text = (instruction or "").strip().lower()
    match = re.search(r"answer\s+any\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)", text)
    if match:
        token = match.group(1)
        parsed = int(token) if token.isdigit() else NUMBER_WORDS.get(token)
        if parsed is not None:
            return max(0, min(parsed, configured_count))
    return max(0, configured_count)

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "data" / "uploads"
BLUEPRINTS_DIR = UPLOAD_DIR / "blueprints"
BLUEPRINTS_DIR.mkdir(parents=True, exist_ok=True)

class BlueprintRepository:
    @staticmethod
    def save_blueprint(name, description=None, parts_config=None, blueprint_id=None, file_path=None):
        """
        Saves or updates a blueprint record and its parts.
        Ensures a JSON file exists for the blueprint structure.
        """
        connection = get_db_connection()
        if not connection:
            return None
        
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        
        try:
            # 1. Determine or generate file_path
            sync_data = None
            if parts_config:
                sync_data = json.loads(parts_config) if isinstance(parts_config, str) else parts_config
            
            if not file_path and sync_data:
                safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in name)
                filename = f"{safe_name}_{int(time.time())}.json"
                file_path = str(BLUEPRINTS_DIR / filename)
                
                # Save structure to physical file for paper_generator.py compatibility
                full_data = {
                    "name": name,
                    "description": description,
                    "parts": sync_data
                }
                with open(file_path, "w", encoding='utf-8') as f:
                    json.dump(full_data, f, indent=2, ensure_ascii=False)

            # 2. Update existing or Insert new
            if blueprint_id:
                query = f"""
                    UPDATE blueprints 
                    SET name = {placeholder}, description = {placeholder}, file_path = {placeholder}, parts_config = {placeholder}, updated_at = CURRENT_TIMESTAMP
                    WHERE id = {placeholder}
                """
                cursor.execute(query, (name, description, file_path, json.dumps(sync_data) if sync_data else None, blueprint_id))
            else:
                query = f"""
                    INSERT INTO blueprints (name, description, file_path, parts_config) 
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder})
                """
                cursor.execute(query, (name, description, file_path, json.dumps(sync_data) if sync_data else None))
                blueprint_id = cursor.lastrowid

            connection.commit()

            # 3. Use sync helper for blueprint_parts table
            if sync_data:
                BlueprintRepository.sync_parts(connection, blueprint_id, sync_data)

            return blueprint_id
        except Exception as e:
            print(f"Repository Error (save): {e}")
            if connection:
                connection.rollback()
            return None
        finally:
            cursor.close()
            connection.close()

    @staticmethod
    def sync_parts(connection, blueprint_id, parts_data):
        """Internal helper to keep blueprint_parts table in sync with the config."""
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        
        try:
            # Clear existing parts for this blueprint
            cursor.execute(f"DELETE FROM blueprint_parts WHERE blueprint_id = {placeholder}", (blueprint_id,))
            
            total_questions = 0
            total_marks = 0
            
            for i, part in enumerate(parts_data):
                p_name = part.get('part_name') or part.get('name')
                p_instr = part.get('instructions') or part.get('instruction') or "Answer all questions."
                p_count = part.get('num_questions') or part.get('count') or 0
                p_marks = part.get('marks_per_question') or 0
                p_diff = part.get('difficulty') or "medium"
                effective_count = _effective_count_from_instruction(str(p_instr), int(p_count))
                
                cursor.execute(
                    f"""INSERT INTO blueprint_parts 
                       (blueprint_id, part_name, instructions, num_questions, marks_per_question, difficulty, part_order)
                       VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})""",
                    (blueprint_id, p_name, p_instr, p_count, p_marks, p_diff, i)
                )
                
                total_questions += int(p_count)
                total_marks += (effective_count * float(p_marks))
                
            # Update blueprint totals in the main table
            cursor.execute(
                f"UPDATE blueprints SET total_questions = {placeholder}, total_marks = {placeholder} WHERE id = {placeholder}",
                (total_questions, total_marks, blueprint_id)
            )
            connection.commit()
        finally:
            cursor.close()

    @staticmethod
    def get_by_id(blueprint_id):
        connection = get_db_connection()
        if not connection:
            return None
        try:
            cursor = get_cursor(connection)
            placeholder = get_placeholder()
            cursor.execute(f"SELECT * FROM blueprints WHERE id = {placeholder}", (blueprint_id,))
            return cursor.fetchone()
        finally:
            connection.close()

    @staticmethod
    def get_with_parts(blueprint_id):
        """Loads a blueprint and all its parts into a structured dictionary."""
        connection = get_db_connection()
        if not connection:
            return None
        
        try:
            cursor = get_cursor(connection)
            placeholder = get_placeholder()
            
            cursor.execute(f"SELECT * FROM blueprints WHERE id = {placeholder}", (blueprint_id,))
            blueprint = cursor.fetchone()
            
            if not blueprint:
                return None
                
            blueprint_dict = dict(blueprint)
            
            cursor.execute(f"""
                SELECT * FROM blueprint_parts 
                WHERE blueprint_id = {placeholder} 
                ORDER BY part_order
            """, (blueprint_id,))
            parts = cursor.fetchall()
            
            blueprint_dict['parts'] = [dict(p) for p in parts]
            return blueprint_dict
        finally:
            connection.close()
