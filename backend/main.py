from fastapi import FastAPI, HTTPException, status, UploadFile, File, Form, Body
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from typing import List, Optional
from datetime import datetime
import uvicorn
import os
import warnings
import shutil
import json
import sqlite3
import re
import tempfile
import time
from pathlib import Path

from email.message import EmailMessage

warnings.filterwarnings(
    "ignore",
    message=".*on_event is deprecated.*",
    category=DeprecationWarning,
)
warnings.filterwarnings("ignore", category=DeprecationWarning)

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

# Core imports
from core.database import get_db_connection, init_database, get_db_type, get_cursor, get_placeholder
from core.models import (
    SubjectCreate, SubjectUpdate, SubjectResponse,
    QuestionBankCreate, QuestionBankResponse,
    QuestionCreate, QuestionResponse,
    BlueprintCreate, BlueprintResponse,
    QuestionPaperCreate, QuestionPaperResponse,
    QuestionGenerationRequest
)

# Utils imports
from utils.syllabus_parser import parse_syllabus, save_syllabus_to_db

# Services imports
from services.default_blueprint import DEFAULT_BLUEPRINT_STRUCTURE
from services.paper_generator import generate_question_paper
from services.qdrant_client import sync_subject_files_to_qdrant
from services.rag_retrieval import retrieve_context, format_context_for_prompt
from services.question_generator import generate_questions_with_ollama, test_ollama_connection
from services.grading_engine import generate_answer_script, grade_student_paper, extract_text_from_pdf

# Blueprint Persistence Safety Layers
from services.blueprint_repository import BlueprintRepository
from services.blueprint_loader import BlueprintLoader
from services.blueprint_guard import BlueprintGuard

# Create upload directories
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
SYLLABUS_DIR = UPLOAD_DIR / "syllabus"
BOOK_DIR = UPLOAD_DIR / "books"
PAPERS_DIR = UPLOAD_DIR / "papers"
BLUEPRINTS_DIR = UPLOAD_DIR / "blueprints"
TEMP_BLUEPRINTS_DIR = BLUEPRINTS_DIR / "temp"
STUDENT_UPLOADS_DIR = UPLOAD_DIR / "student_submissions"

for directory in [DATA_DIR, UPLOAD_DIR, SYLLABUS_DIR, BOOK_DIR, PAPERS_DIR, BLUEPRINTS_DIR, TEMP_BLUEPRINTS_DIR, STUDENT_UPLOADS_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Quest Generator API", version="1.0.0")

# CORS middleware "*", 
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*", "http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    init_database()
    ensure_default_blueprint()
    print("--------------------------------------------------")
    print("SYSTEM: Auth Routes are fully loaded and active.")
    print("--------------------------------------------------")

# In-memory OTP storage
otp_store = {}

# ==================== AUTH ENDPOINTS ====================


# ==================== AUTH & ADMIN ENDPOINTS ====================

class AdminAction(BaseModel):
    user_id: int
    action: str # "approve" or "reject"

class UserStatusRequest(BaseModel):
    email: str
    name: str

@app.post("/api/auth/sync-user")
async def sync_user(request: UserStatusRequest):
    """Sync user from Firebase to DB and return status"""
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        
        # Check if user exists
        cursor.execute(f"SELECT * FROM users WHERE email = {placeholder}", (request.email,))
        user = cursor.fetchone()
        
        status_val = "pending"
        
        if not user:
            # Create user if new (came from Firebase Signup)
            cursor.execute(
                f"INSERT INTO users (email, name, status, last_login) VALUES ({placeholder}, {placeholder}, 'pending', {placeholder})",
                (request.email, request.name, datetime.now())
            )
            connection.commit()
            status_val = "pending"
        else:
            # Update login time
            cursor.execute(
                f"UPDATE users SET last_login = {placeholder} WHERE id = {placeholder}",
                (datetime.now(), user['id'])
            )
            connection.commit()
            status_val = user['status']
            
        cursor.close()
        connection.close()
        
        # Admin Bypass: Specific email is always approved
        if request.email.lower() == "gsrinath222@gmail.com":
             return {"status": "approved", "role": "admin"}

        return {"status": status_val, "role": "user"}
        
    except Exception as e:
        if connection:
            connection.close()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/api/admin/users")
async def get_all_users():
    """Get list of all users for admin dashboard"""
    connection = get_db_connection()
    try:
        cursor = get_cursor(connection)
        cursor.execute("SELECT id, email, name, status, created_at, last_login FROM users ORDER BY created_at DESC")
        users = cursor.fetchall()
        
        # Convert to list of dicts if sqlite Row objects
        user_list = []
        for u in users:
             user_list.append(dict(u))
             
        cursor.close()
        connection.close()
        return user_list
    except Exception as e:
        if connection: connection.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/action")
async def admin_action(action: AdminAction):
    """Approve or Reject a user"""
    connection = get_db_connection()
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        
        new_status = "approved" if action.action == "approve" else "rejected"
        
        cursor.execute(
            f"UPDATE users SET status = {placeholder} WHERE id = {placeholder}", 
            (new_status, action.user_id)
        )
        connection.commit()
        cursor.close()
        connection.close()
        return {"success": True, "new_status": new_status}
    except Exception as e:
        if connection: connection.close()
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/")
async def root():
    return {"message": "Quest Generator API", "version": "1.0.0"}

# ==================== SUBJECT ENDPOINTS ====================

@app.post("/api/subjects", response_model=SubjectResponse, status_code=status.HTTP_201_CREATED)
async def create_subject(
    subject_id: str = Form(...),
    name: str = Form(...),
    syllabus_file: Optional[UploadFile] = File(None),
    book_file: Optional[UploadFile] = File(None),
    use_book_for_generation: bool = Form(False)
):
    """Create a new subject with file uploads"""
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        
        cursor.execute(f"SELECT id FROM subjects WHERE subject_id = {placeholder} OR name = {placeholder}", (subject_id, name))
        existing = cursor.fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Subject with this ID or name already exists")
        
        safe_subject_id = "".join(c if c.isalnum() or c in "-_" else "_" for c in subject_id)
        
        syllabus_path = None
        if syllabus_file and syllabus_file.filename:
            file_extension = os.path.splitext(syllabus_file.filename)[1]
            syllabus_filename = f"{safe_subject_id}{file_extension}"
            syllabus_path = SYLLABUS_DIR / syllabus_filename
            
            with open(syllabus_path, "wb") as buffer:
                shutil.copyfileobj(syllabus_file.file, buffer)
            
            syllabus_path = str(syllabus_path)
        
        book_path = None
        if book_file and book_file.filename:
            file_extension = os.path.splitext(book_file.filename)[1]
            book_filename = f"{safe_subject_id}{file_extension}"
            book_path = BOOK_DIR / book_filename
            
            with open(book_path, "wb") as buffer:
                shutil.copyfileobj(book_file.file, buffer)
            
            book_path = str(book_path)
        
        query = f"""
            INSERT INTO subjects (subject_id, name, syllabus_file, book_file, use_book_for_generation)
            VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
        """
        cursor.execute(query, (subject_id, name, syllabus_path, book_path, use_book_for_generation))
        connection.commit()
        
        subject_db_id = cursor.lastrowid
        
        if syllabus_path and syllabus_path.lower().endswith('.pdf'):
            try:
                parsed_data = parse_syllabus(syllabus_path)
                if parsed_data['success']:
                    save_syllabus_to_db(connection, subject_db_id, parsed_data, subject_id)
                else:
                    print(f"Warning: Failed to parse syllabus: {parsed_data.get('error')}")
            except Exception as e:
                print(f"Warning: Error parsing syllabus: {str(e)}")
        
        cursor.execute(f"SELECT * FROM subjects WHERE id = {placeholder}", (subject_db_id,))
        result = cursor.fetchone()
        
        cursor.close()
        connection.close()
        
        return dict(result)
    except HTTPException:
        raise
    except Exception as e:
        if connection:
            connection.rollback()
            connection.close()
        raise HTTPException(status_code=500, detail=f"Error creating subject: {str(e)}")

@app.get("/api/subjects", response_model=List[SubjectResponse])
async def get_subjects():
    """Get all subjects"""
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = get_cursor(connection)
        cursor.execute("SELECT * FROM subjects ORDER BY created_at DESC")
        subjects = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        return [dict(s) for s in subjects]
    except Exception as e:
        if connection:
            connection.close()
        raise HTTPException(status_code=500, detail=f"Error fetching subjects: {str(e)}")

@app.get("/api/subjects/{subject_id}", response_model=SubjectResponse)
async def get_subject(subject_id: int):
    """Get a specific subject by ID"""
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        cursor.execute(f"SELECT * FROM subjects WHERE id = {placeholder}", (subject_id,))
        subject = cursor.fetchone()
        
        cursor.close()
        connection.close()
        
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
        
        return dict(subject)
    except HTTPException:
        raise
    except Exception as e:
        if connection:
            connection.close()
        raise HTTPException(status_code=500, detail=f"Error fetching subject: {str(e)}")

@app.put("/api/subjects/{subject_id}", response_model=SubjectResponse)
async def update_subject(subject_id: int, subject: SubjectUpdate):
    """Update a subject"""
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        
        cursor.execute(f"SELECT id FROM subjects WHERE id = {placeholder}", (subject_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Subject not found")
        
        update_fields = []
        values = []
        
        if subject.name is not None:
            update_fields.append(f"name = {placeholder}")
            values.append(subject.name)
        if subject.syllabus_file is not None:
            update_fields.append(f"syllabus_file = {placeholder}")
            values.append(subject.syllabus_file)
        if subject.book_file is not None:
            update_fields.append(f"book_file = {placeholder}")
            values.append(subject.book_file)
        if subject.use_book_for_generation is not None:
            update_fields.append(f"use_book_for_generation = {placeholder}")
            values.append(subject.use_book_for_generation)
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        values.append(subject_id)
        query = f"UPDATE subjects SET {', '.join(update_fields)} WHERE id = {placeholder}"
        cursor.execute(query, tuple(values))
        connection.commit()
        
        cursor.execute(f"SELECT * FROM subjects WHERE id = {placeholder}", (subject_id,))
        result = cursor.fetchone()
        
        cursor.close()
        connection.close()
        
        return dict(result)
    except HTTPException:
        raise
    except Exception as e:
        if connection:
            connection.rollback()
            connection.close()
        raise HTTPException(status_code=500, detail=f"Error updating subject: {str(e)}")

@app.get("/api/subjects/{subject_id}/syllabus")
async def get_subject_syllabus(subject_id: int):
    """Get parsed syllabus structure for a subject"""
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        
        cursor.execute(f"SELECT * FROM subjects WHERE id = {placeholder}", (subject_id,))
        subject = cursor.fetchone()
        
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
        
        cursor.execute(f"""
            SELECT * FROM units 
            WHERE subject_id = {placeholder} 
            ORDER BY unit_number
        """, (subject_id,))
        units = cursor.fetchall()
        
        result = []
        for unit in units:
            cursor.execute(f"""
                SELECT * FROM topics 
                WHERE unit_id = {placeholder}
            """, (unit['id'],))
            topics = cursor.fetchall()
            
            topics_data = []
            for topic in topics:
                cursor.execute(f"""
                    SELECT * FROM subtopics 
                    WHERE topic_id = {placeholder}
                """, (topic['id'],))
                subtopics = cursor.fetchall()
                
                topics_data.append({
                    'id': topic['id'],
                    'topic_name': topic['topic_name'],
                    'subtopics': [s['subtopic_name'] for s in subtopics]
                })
            
            result.append({
                'id': unit['id'],
                'unit_number': unit['unit_number'],
                'unit_title': unit['unit_title'],
                'topics': topics_data
            })
        
        cursor.close()
        connection.close()
        
        return {
            'subject_id': subject['subject_id'],
            'subject_name': subject['name'],
            'units': result
        }
    except HTTPException:
        raise
    except Exception as e:
        if connection:
            connection.close()
        raise HTTPException(status_code=500, detail=f"Error fetching syllabus: {str(e)}")

@app.get("/api/subjects/{subject_id}/units")
async def get_subject_units(subject_id: int):
    """Get units for a subject"""
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        
        cursor.execute(f"SELECT * FROM subjects WHERE id = {placeholder}", (subject_id,))
        subject = cursor.fetchone()
        
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
        
        cursor.execute(f"""
            SELECT id, unit_number, unit_title 
            FROM units 
            WHERE subject_id = {placeholder} 
            ORDER BY unit_number
        """, (subject_id,))
        units = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        return {
            'subject_id': subject['subject_id'],
            'subject_name': subject['name'],
            'units': [dict(u) for u in units]
        }
    except HTTPException:
        raise
    except Exception as e:
        if connection:
            connection.close()
        raise HTTPException(status_code=500, detail=f"Error fetching units: {str(e)}")

@app.get("/api/subjects/{subject_id}/topics")
async def get_subject_topics(subject_id: int, from_unit: Optional[int] = None, to_unit: Optional[int] = None):
    """Get topics for a subject, optionally filtered by unit range"""
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        
        if from_unit is not None and to_unit is not None:
            query = f"""
                SELECT t.*, u.unit_number, u.unit_title 
                FROM topics t
                JOIN units u ON t.unit_id = u.id
                WHERE u.subject_id = {placeholder} AND u.unit_number BETWEEN {placeholder} AND {placeholder}
                ORDER BY u.unit_number, t.id
            """
            cursor.execute(query, (subject_id, from_unit, to_unit))
        else:
            query = f"""
                SELECT t.*, u.unit_number, u.unit_title 
                FROM topics t
                JOIN units u ON t.unit_id = u.id
                WHERE u.subject_id = {placeholder}
                ORDER BY u.unit_number, t.id
            """
            cursor.execute(query, (subject_id,))
        
        topics = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        return {'topics': [dict(t) for t in topics]}
    except HTTPException:
        raise
    except Exception as e:
        if connection:
            connection.close()
        raise HTTPException(status_code=500, detail=f"Error fetching topics: {str(e)}")

@app.post("/api/subjects/{subject_id}/generate-questions")
async def generate_questions(subject_id: int, request: QuestionGenerationRequest):
    """Generate questions using Ollama based on topics from database"""
    
    if not test_ollama_connection(request.ai_provider):
        raise HTTPException(
            status_code=503, 
            detail="No AI provider is reachable. Set request.ai_provider as ollama/xai/openai/gemini or configure AI_MODE in backend/.env."
        )
    
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        
        # Get topics between the unit range
        query = f"""
            SELECT t.topic_name, u.unit_number, u.unit_title
            FROM topics t
            JOIN units u ON t.unit_id = u.id
            WHERE u.subject_id = {placeholder} AND u.unit_number BETWEEN {placeholder} AND {placeholder}
            ORDER BY u.unit_number
        """
        cursor.execute(query, (subject_id, request.from_unit, request.to_unit))
        topics_data = cursor.fetchall()

        # Get subject details for RAG
        cursor.execute(f"SELECT subject_id FROM subjects WHERE id = {placeholder}", (subject_id,))
        subject_record = cursor.fetchone()
        
        cursor.close()
        connection.close()
        
        if not topics_data:
            raise HTTPException(status_code=404, detail="No topics found for the specified unit range")
        
        # Determine the safe subject code for RAG
        if subject_record:
            raw_id = subject_record['subject_id']
            safe_subject_code = "".join(c if c.isalnum() or c in "-_" else "_" for c in raw_id)
        else:
            safe_subject_code = str(subject_id)

        topics = [f"{t['topic_name']} (Unit {t['unit_number']})" for t in topics_data]
        
        # RAG INTEGRATION: Sync files to Qdrant and retrieve context
        try:
            sync_subject_files_to_qdrant(safe_subject_code)
            query_str = f"Topics: {', '.join(topics)}"
            retrieved_data = retrieve_context(query_str, subject_id=safe_subject_code)
            context_str = format_context_for_prompt(retrieved_data)
        except Exception as rag_err:
            print(f"RAG Error (continuing without RAG): {rag_err}")
            context_str = None

        try:
            questions = generate_questions_with_ollama(
                topics=topics,
                count=request.count,
                marks=request.marks,
                difficulty=request.difficulty,
                part_name=request.part_name,
                context=context_str,
                ai_provider=request.ai_provider,
            )
            
            return {
                'success': True,
                'count': len(questions),
                'questions': questions,
                'topics_covered': len(topics)
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    except HTTPException:
        raise
    except Exception as e:
        if connection:
            connection.close()
        raise HTTPException(status_code=500, detail=f"Error generating questions: {str(e)}")

@app.post("/api/subjects/{subject_id}/generate-all-questions")
async def generate_all_questions(subject_id: int, requests: List[QuestionGenerationRequest]):
    """Generate questions for all parts at once"""

    default_provider = requests[0].ai_provider if requests else None
    if not test_ollama_connection(default_provider):
        raise HTTPException(
            status_code=503, 
            detail="No AI provider is reachable. Set request.ai_provider as ollama/xai/openai/gemini or configure AI_MODE in backend/.env."
        )
    
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        # Get subject code for RAG once
        cursor.execute(f"SELECT subject_id FROM subjects WHERE id = {placeholder}", (subject_id,))
        subject_record = cursor.fetchone()
        if subject_record:
            raw_id = subject_record['subject_id']
            safe_subject_code = "".join(c if c.isalnum() or c in "-_" else "_" for c in raw_id)
        else:
            safe_subject_code = str(subject_id)

        # Sync files to Qdrant once for the whole request
        try:
            sync_subject_files_to_qdrant(safe_subject_code)
        except Exception as rag_err:
            print(f"RAG Sync Error: {rag_err}")

        import asyncio
        
        tasks_inputs = []
        
        for request in requests:
            query = f"""
                SELECT t.topic_name, u.unit_number, u.unit_title
                FROM topics t
                JOIN units u ON t.unit_id = u.id
                WHERE u.subject_id = {placeholder} AND u.unit_number BETWEEN {placeholder} AND {placeholder}
                ORDER BY u.unit_number
            """
            cursor.execute(query, (subject_id, request.from_unit, request.to_unit))
            topics_data = cursor.fetchall()
            
            if topics_data:
                # Extract topic names from the query result
                topics = [dict(row)['topic_name'] for row in topics_data]
                
                # RAG INTEGRATION: Try to get context for each part
                context_str = None
                try:
                    query_str = f"Topics: {', '.join(topics)}"
                    retrieved_data = retrieve_context(query_str, subject_id=safe_subject_code)
                    context_str = format_context_for_prompt(retrieved_data)
                except Exception as rag_err:
                    print(f"RAG Retrieval Error: {rag_err}")

                tasks_inputs.append({
                    'topics': topics,
                    'request': request,
                    'context_str': context_str
                })

        async def fetch_questions(input_data):
            req = input_data['request']
            try:
                # Run the blocking AI model generation in a dedicated thread
                questions = await asyncio.to_thread(
                    generate_questions_with_ollama,
                    topics=input_data['topics'],
                    count=req.count,
                    marks=req.marks,
                    difficulty=req.difficulty,
                    part_name=req.part_name,
                    context=input_data['context_str'],
                    ai_provider=req.ai_provider,
                )
                
                return {
                    'part_name': req.part_name,
                    'success': True,
                    'count': len(questions),
                    'questions': questions,
                    'topics_covered': len(input_data['topics'])
                }
            except Exception as e:
                return {
                    'part_name': req.part_name,
                    'success': False,
                    'error': str(e)
                }

        if tasks_inputs:
            # Execute all part generations concurrently
            all_results = await asyncio.gather(*(fetch_questions(inp) for inp in tasks_inputs))
        else:
            all_results = []
        
        cursor.close()
        connection.close()
        
        return {
            'success': True,
            'parts': all_results,
            'total_parts': len(requests)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        if connection:
            connection.close()
        raise HTTPException(status_code=500, detail=f"Error generating questions: {str(e)}")


    
@app.delete("/api/subjects/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subject(subject_id: int):
    """Delete a subject and cascade delete all related data (question banks, questions, papers)"""
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        
        # Get subject details
        cursor.execute(f"""
            SELECT id, syllabus_file, book_file 
            FROM subjects 
            WHERE id = {placeholder}
        """, (subject_id,))
        subject = cursor.fetchone()
        
        if not subject:
            cursor.close()
            connection.close()
            raise HTTPException(status_code=404, detail="Subject not found")
        
        # Get all question banks for this subject (for logging/info)
        cursor.execute(f"""
            SELECT id, name 
            FROM question_banks 
            WHERE subject_id = {placeholder}
        """, (subject_id,))
        question_banks = cursor.fetchall()
        
        # Get all question paper files for this subject
        cursor.execute(f"""
            SELECT DISTINCT file_path 
            FROM question_papers 
            WHERE subject_id = {placeholder} AND file_path IS NOT NULL
        """, (subject_id,))
        paper_files = [row['file_path'] for row in cursor.fetchall()]
        
        # Delete the subject (cascade will handle question_banks, questions, etc.)
        cursor.execute(f"DELETE FROM subjects WHERE id = {placeholder}", (subject_id,))
        connection.commit()
        
        # Collect files to delete
        files_to_delete = []
        
        if subject['syllabus_file']:
            files_to_delete.append(subject['syllabus_file'])
        
        if subject['book_file']:
            files_to_delete.append(subject['book_file'])
        
        files_to_delete.extend(paper_files)
        
        # Delete files
        for file_path in files_to_delete:
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception as e:
                    print(f"Warning: Could not delete file {file_path}: {str(e)}")
        
        # Log deletion info
        if question_banks:
            qb_names = ', '.join([qb['name'] for qb in question_banks])
            print(f"✓ Deleted subject {subject_id} and {len(question_banks)} question bank(s): {qb_names}")
        else:
            print(f"✓ Deleted subject {subject_id}")
        
        cursor.close()
        connection.close()
        
        return None
    except HTTPException:
        raise
    except Exception as e:
        if connection:
            connection.rollback()
            connection.close()
        raise HTTPException(status_code=500, detail=f"Error deleting subject: {str(e)}")

# ==================== QUESTION BANK ENDPOINTS ====================

@app.post("/api/question-banks", response_model=QuestionBankResponse, status_code=status.HTTP_201_CREATED)
async def create_question_bank(question_bank: QuestionBankCreate):
    """Create a new question bank"""
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        
        cursor.execute(f"SELECT id FROM subjects WHERE id = {placeholder}", (question_bank.subject_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Subject not found")
        
        query = f"""
            INSERT INTO question_banks (name, subject_id, description, total_questions)
            VALUES ({placeholder}, {placeholder}, {placeholder}, 0)
        """
        cursor.execute(query, (question_bank.name, question_bank.subject_id, question_bank.description))
        connection.commit()
        
        bank_id = cursor.lastrowid
        
        cursor.execute(f"SELECT * FROM question_banks WHERE id = {placeholder}", (bank_id,))
        result = cursor.fetchone()
        
        cursor.close()
        connection.close()
        
        return dict(result)
    except HTTPException:
        raise
    except Exception as e:
        if connection:
            connection.close()
        raise HTTPException(status_code=500, detail=f"Error creating question bank: {str(e)}")

@app.get("/api/question-banks", response_model=List[QuestionBankResponse])
async def get_all_question_banks():
    """Get all question banks"""
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = get_cursor(connection)
        cursor.execute("SELECT * FROM question_banks ORDER BY created_at DESC")
        banks = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        return [dict(bank) for bank in banks]
    except Exception as e:
        if connection:
            connection.close()
        raise HTTPException(status_code=500, detail=f"Error fetching question banks: {str(e)}")

@app.get("/api/question-banks/subject/{subject_id}", response_model=List[QuestionBankResponse])
async def get_question_banks_by_subject(subject_id: int):
    """Get all question banks for a specific subject"""
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        cursor.execute(
            f"SELECT * FROM question_banks WHERE subject_id = {placeholder} ORDER BY created_at DESC",
            (subject_id,)
        )
        banks = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        return [dict(bank) for bank in banks]
    except Exception as e:
        if connection:
            connection.close()
        raise HTTPException(status_code=500, detail=f"Error fetching question banks: {str(e)}")

@app.delete("/api/question-banks/{bank_id}")
async def delete_question_bank(bank_id: int):
    """Delete a question bank and all its questions"""
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        
        cursor.execute(f"SELECT id FROM question_banks WHERE id = {placeholder}", (bank_id,))
        if not cursor.fetchone():
            cursor.close()
            connection.close()
            raise HTTPException(status_code=404, detail="Question bank not found")
        
        cursor.execute(f"DELETE FROM question_banks WHERE id = {placeholder}", (bank_id,))
        connection.commit()
        
        cursor.close()
        connection.close()
        
        return {"success": True, "message": "Question bank deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        if connection:
            connection.close()
        raise HTTPException(status_code=500, detail=f"Error deleting question bank: {str(e)}")

# ==================== QUESTION ENDPOINTS ====================

@app.post("/api/questions/batch", status_code=status.HTTP_201_CREATED)
async def create_questions_batch(questions: List[QuestionCreate]):
    """Create multiple questions at once"""
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        
        if not questions:
            raise HTTPException(status_code=400, detail="No questions provided")
        
        cursor.execute(f"SELECT id FROM question_banks WHERE id = {placeholder}", (questions[0].question_bank_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Question bank not found")
        
        cursor.execute(f"SELECT id FROM subjects WHERE id = {placeholder}", (questions[0].subject_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Subject not found")
        
        question_ids = []
        for question in questions:
            query = f"""
                INSERT INTO questions (question_bank_id, subject_id, content, part, unit, topic, difficulty, marks)
                VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
            """
            values = (
                question.question_bank_id,
                question.subject_id,
                question.content,
                question.part,
                question.unit,
                question.topic,
                question.difficulty,
                question.marks
            )
            cursor.execute(query, values)
            question_ids.append(cursor.lastrowid)
        
        cursor.execute(
            f"UPDATE question_banks SET total_questions = total_questions + {placeholder} WHERE id = {placeholder}",
            (len(questions), questions[0].question_bank_id)
        )
        
        connection.commit()
        
        placeholders = ','.join([placeholder] * len(question_ids))
        cursor.execute(f"SELECT * FROM questions WHERE id IN ({placeholders})", tuple(question_ids))
        results = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        return {
            'success': True,
            'count': len(results),
            'question_bank_id': questions[0].question_bank_id,
            'questions': [dict(r) for r in results]
        }
    except HTTPException:
        raise
    except Exception as e:
        if connection:
            connection.rollback()
            connection.close()
        raise HTTPException(status_code=500, detail=f"Error creating questions: {str(e)}")

@app.post("/api/questions", response_model=QuestionResponse, status_code=status.HTTP_201_CREATED)
async def create_question(question: QuestionCreate):
    """Create a new question"""
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        
        cursor.execute(f"SELECT id FROM subjects WHERE id = {placeholder}", (question.subject_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Subject not found")
        
        query = f"""
            INSERT INTO questions (subject_id, content, part, unit, topic, difficulty, marks)
            VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
        """
        values = (
            question.subject_id,
            question.content,
            question.part,
            question.unit,
            question.topic,
            question.difficulty,
            question.marks
        )
        cursor.execute(query, values)
        connection.commit()
        
        question_id = cursor.lastrowid
        cursor.execute(f"SELECT * FROM questions WHERE id = {placeholder}", (question_id,))
        result = cursor.fetchone()
        
        cursor.close()
        connection.close()
        
        return dict(result)
    except HTTPException:
        raise
    except Exception as e:
        if connection:
            connection.rollback()
            connection.close()
        raise HTTPException(status_code=500, detail=f"Error creating question: {str(e)}")

@app.get("/api/questions/subject/{subject_id}", response_model=List[QuestionResponse])
async def get_questions_by_subject(subject_id: int):
    """Get all questions for a specific subject"""
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        cursor.execute(
            f"SELECT * FROM questions WHERE subject_id = {placeholder} ORDER BY created_at DESC",
            (subject_id,)
        )
        questions = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        return [dict(q) for q in questions]
    except Exception as e:
        if connection:
            connection.close()
        raise HTTPException(status_code=500, detail=f"Error fetching questions: {str(e)}")

@app.get("/api/questions/bank/{bank_id}", response_model=List[QuestionResponse])
async def get_questions_by_bank(bank_id: int):
    """Get all questions for a specific question bank"""
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        
        cursor.execute(
            f"SELECT id, name FROM question_banks WHERE id = {placeholder}",
            (bank_id,)
        )
        bank = cursor.fetchone()
        
        if not bank:
            cursor.close()
            connection.close()
            raise HTTPException(status_code=404, detail=f"Question bank with ID {bank_id} not found")
        
        cursor.execute(
            f"SELECT * FROM questions WHERE question_bank_id = {placeholder} ORDER BY created_at DESC",
            (bank_id,)
        )
        questions = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        if not questions:
            raise HTTPException(
                status_code=404, 
                detail=f"No questions found in question bank '{bank['name']}'. Please add questions first."
            )
        
        return [dict(q) for q in questions]
    except HTTPException:
        raise
    except Exception as e:
        if connection:
            connection.close()
        raise HTTPException(status_code=500, detail=f"Error fetching questions: {str(e)}")

@app.get("/api/questions/by-question-bank/{question_bank_id}", response_model=List[QuestionResponse])
async def get_questions_by_question_bank_id(question_bank_id: int):
    """Get all questions for a specific question bank - alternative endpoint"""
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        
        cursor.execute(
            f"SELECT id, name FROM question_banks WHERE id = {placeholder}",
            (question_bank_id,)
        )
        bank = cursor.fetchone()
        
        if not bank:
            cursor.close()
            connection.close()
            raise HTTPException(status_code=404, detail=f"Question bank with ID {question_bank_id} not found")
        
        cursor.execute(
            f"SELECT * FROM questions WHERE question_bank_id = {placeholder} ORDER BY created_at DESC",
            (question_bank_id,)
        )
        questions = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        if not questions:
            raise HTTPException(
                status_code=404, 
                detail=f"No questions found in question bank '{bank['name']}'. Please add questions first."
            )
        
        return [dict(q) for q in questions]
    except HTTPException:
        raise
    except Exception as e:
        if connection:
            connection.close()
        raise HTTPException(status_code=500, detail=f"Error fetching questions: {str(e)}")

@app.delete("/api/questions/{question_id}")
async def delete_question(question_id: int):
    """Delete a question by ID"""
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        
        cursor.execute(f"SELECT id FROM questions WHERE id = {placeholder}", (question_id,))
        question = cursor.fetchone()
        
        if not question:
            cursor.close()
            connection.close()
            raise HTTPException(status_code=404, detail="Question not found")
        
        cursor.execute(f"DELETE FROM questions WHERE id = {placeholder}", (question_id,))
        connection.commit()
        
        cursor.close()
        connection.close()
        
        return {"success": True, "message": "Question deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        if connection:
            connection.close()
        raise HTTPException(status_code=500, detail=f"Error deleting question: {str(e)}")

# ==================== BLUEPRINT ENDPOINTS WITH PARTS ====================

def sync_blueprint_data(connection, blueprint_id, parts_data):
    """Sync blueprint parts and update total counts/marks."""
    cursor = get_cursor(connection)
    placeholder = get_placeholder()
    
    try:
        # Delete existing parts
        cursor.execute(f"DELETE FROM blueprint_parts WHERE blueprint_id = {placeholder}", (blueprint_id,))
        
        total_questions = 0
        total_marks = 0
        
        for i, part in enumerate(parts_data):
            # Support both frontend format (part_name, num_questions, marks_per_question)
            # and DEFAULT_BLUEPRINT_STRUCTURE format (name, count, marks_per_question)
            part_name = part.get('part_name') or part.get('name')
            instructions = part.get('instructions') or part.get('instruction') or "Answer all questions."
            num_questions = part.get('num_questions') or part.get('count') or 0
            marks_per = part.get('marks_per_question') or 0
            difficulty = part.get('difficulty') or "medium"
            effective_count = _effective_count_from_instruction(str(instructions), int(num_questions))
            
            cursor.execute(
                f"""INSERT INTO blueprint_parts 
                   (blueprint_id, part_name, instructions, num_questions, marks_per_question, difficulty, part_order)
                   VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})""",
                (blueprint_id, part_name, instructions, num_questions, marks_per, difficulty, i)
            )
            
            total_questions += int(num_questions)
            total_marks += (effective_count * float(marks_per))
            
        # Update blueprint totals
        cursor.execute(
            f"UPDATE blueprints SET total_questions = {placeholder}, total_marks = {placeholder}, parts_config = {placeholder} WHERE id = {placeholder}",
            (total_questions, total_marks, json.dumps(parts_data), blueprint_id)
        )
        connection.commit()
    finally:
        cursor.close()

def ensure_default_blueprint():
    """Ensure the database has the blueprints table and at least one default blueprint."""
    init_database()

    connection = get_db_connection()
    if not connection:
        print("Error ensuring default blueprint: database connection failed")
        return None

    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()

        cursor.execute("SELECT COUNT(*) as count FROM blueprints")
        count_row = cursor.fetchone()
        count = count_row['count'] if isinstance(count_row, dict) or hasattr(count_row, '__getitem__') else 0

        if count == 0:
            blueprints_dir = UPLOAD_DIR / "blueprints"
            blueprints_dir.mkdir(exist_ok=True)

            file_name = "default_blueprint.json"
            file_path = blueprints_dir / file_name

            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(DEFAULT_BLUEPRINT_STRUCTURE, f, indent=2)

            cursor.execute(
                f"""INSERT INTO blueprints (name, description, file_name, file_path) 
                   VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder})""",
                (
                    DEFAULT_BLUEPRINT_STRUCTURE['name'],
                    DEFAULT_BLUEPRINT_STRUCTURE['description'],
                    file_name,
                    str(file_path)
                )
            )
            connection.commit()
            blueprint_id = cursor.lastrowid
            
            # Sync parts
            sync_blueprint_data(connection, blueprint_id, DEFAULT_BLUEPRINT_STRUCTURE['parts'])

        cursor.close()
        connection.close()
        return True
    except Exception as e:
        if "no such table" in str(e).lower():
            print("Blueprints table missing. Re-initializing database...")
            init_database()
            return ensure_default_blueprint()
        print(f"Error ensuring default blueprint: {e}")
        if connection:
            connection.close()
        return None


def ensure_default_blueprint_exists():
    """Backward-compatible wrapper used by other endpoints."""
    return ensure_default_blueprint()

@app.post("/api/blueprints", response_model=BlueprintResponse)
async def create_blueprint(blueprint: BlueprintCreate):
    """Create a new blueprint from JSON structure"""
    
    print("=" * 60)
    print("📥 RECEIVED BLUEPRINT DATA:")
    print(f"Name: {blueprint.name}")
    print(f"Description: {blueprint.description}")
    print(f"Parts config: {blueprint.parts_config}")
    print(f"Number of parts: {len(blueprint.parts_config)}")
    for i, part in enumerate(blueprint.parts_config):
        print(f"  Part {i+1}: {part.part_name} - {part.difficulty} - {part.num_questions}q × {part.marks_per_question}m")
    print("=" * 60)
    
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        blueprints_dir = UPLOAD_DIR / "blueprints"
        blueprints_dir.mkdir(exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_name = "".join(c if c.isalnum() or c in (' ', '-', '_') else '_' for c in blueprint.name)
        safe_name = safe_name.replace(' ', '_')[:50]
        file_name = f"{safe_name}_{timestamp}.json"
        file_path = str(blueprints_dir / file_name)
        
        total_questions = sum(part.num_questions for part in blueprint.parts_config)
        total_marks = sum(part.num_questions * part.marks_per_question for part in blueprint.parts_config)
        
        json_data = {
            "name": blueprint.name,
            "description": blueprint.description or "",
            "total_marks": total_marks,
            "total_questions": total_questions,
            "parts": [
                {
                    "part_name": part.part_name,
                    "instructions": part.instructions or "Answer all questions",
                    "num_questions": part.num_questions,
                    "marks_per_question": part.marks_per_question,
                    "difficulty": part.difficulty
                }
                for part in blueprint.parts_config
            ]
        }
        
        with open(file_path, "w", encoding='utf-8') as f:
            json.dump(json_data, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Saved blueprint file to: {file_path}")
        
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        
        cursor.execute(
            f"""INSERT INTO blueprints (name, description, file_name, file_path, total_questions, total_marks) 
               VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})""",
            (blueprint.name, blueprint.description, file_name, file_path, total_questions, total_marks)
        )
        connection.commit()
        blueprint_id = cursor.lastrowid
        
        print(f"✅ Created blueprint with ID: {blueprint_id}")
        
        # Insert blueprint parts
        for i, part in enumerate(blueprint.parts_config):
            cursor.execute(
                f"""INSERT INTO blueprint_parts 
                   (blueprint_id, part_order, part_name, instructions, num_questions, marks_per_question, difficulty)
                   VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})""",
                (blueprint_id, i + 1, part.part_name, part.instructions or "Answer all questions", 
                 part.num_questions, part.marks_per_question, part.difficulty)
            )
            print(f"  ✅ Inserted part: {part.part_name} (order: {i + 1})")
        
        connection.commit()
        print(f"✅ Inserted {len(blueprint.parts_config)} parts for blueprint {blueprint_id}")
        
        cursor.execute(f"SELECT * FROM blueprints WHERE id = {placeholder}", (blueprint_id,))
        result = cursor.fetchone()
        
        cursor.close()
        connection.close()
        
        return dict(result)
        
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        
        if 'file_path' in locals() and os.path.exists(file_path):
            os.remove(file_path)
        if connection:
            connection.rollback()
            connection.close()
        raise HTTPException(status_code=500, detail=f"Error creating blueprint: {str(e)}")

@app.get("/api/blueprints", response_model=List[BlueprintResponse])
async def get_blueprints():
    """Get all blueprints"""
    ensure_default_blueprint()
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = get_cursor(connection)
        cursor.execute("SELECT * FROM blueprints ORDER BY created_at DESC")
        blueprints = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        return [dict(p) for p in blueprints]
    except Exception as e:
        if connection:
            connection.close()
        raise HTTPException(status_code=500, detail=f"Error fetching blueprints: {str(e)}")



@app.get("/api/blueprints/{blueprint_id}")
async def get_blueprint(blueprint_id: int):
    """Get a specific blueprint with its parts"""
    try:
        # Verify blueprint exists
        BlueprintGuard.verify_existence(blueprint_id)
        
        # Get blueprint with parts
        blueprint_dict = BlueprintRepository.get_with_parts(blueprint_id)
        
        if not blueprint_dict:
            raise HTTPException(status_code=404, detail="Blueprint not found")
        
        return blueprint_dict
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching blueprint: {str(e)}")



@app.delete("/api/blueprints/{blueprint_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_blueprint(blueprint_id: int):
    """Delete a blueprint"""
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        
        cursor.execute(f"SELECT file_path FROM blueprints WHERE id = {placeholder}", (blueprint_id,))
        blueprint = cursor.fetchone()
        
        if not blueprint:
            cursor.close()
            connection.close()
            raise HTTPException(status_code=404, detail="Blueprint not found")
        
        blueprint_dict = dict(blueprint)
        
        if blueprint_dict.get('file_path') and os.path.exists(blueprint_dict['file_path']):
            os.remove(blueprint_dict['file_path'])
        
        cursor.execute(f"DELETE FROM blueprints WHERE id = {placeholder}", (blueprint_id,))
        connection.commit()
        
        cursor.close()
        connection.close()
        
        return None
    except HTTPException:
        raise
    except Exception as e:
        if connection:
            connection.rollback()
            connection.close()
        raise HTTPException(status_code=500, detail=f"Error deleting blueprint: {str(e)}")

# ==================== DASHBOARD ENDPOINTS ====================

@app.get("/api/dashboard/stats")
async def get_dashboard_stats():
    """Get dashboard statistics"""
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = get_cursor(connection)
        
        cursor.execute("SELECT COUNT(*) as count FROM subjects")
        subjects_count = cursor.fetchone()['count']
        
        cursor.execute("SELECT COUNT(*) as count FROM questions")
        questions_count = cursor.fetchone()['count']
        
        cursor.execute("SELECT COUNT(*) as count FROM blueprints")
        blueprints_count = cursor.fetchone()['count']
        
        cursor.execute("SELECT COUNT(*) as count FROM question_papers")
        papers_count = cursor.fetchone()['count']
        
        cursor.close()
        connection.close()
        
        return {
            "subjects": subjects_count,
            "questions": questions_count,
            "blueprints": blueprints_count,
            "papers": papers_count
        }
    except Exception as e:
        if connection:
            connection.close()
        raise HTTPException(status_code=500, detail=f"Error fetching stats: {str(e)}")

@app.get("/api/dashboard/recent-activity")
async def get_recent_activity():
    """Get recent activity from multiple sources"""
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = get_cursor(connection)
        
        activities = []
        
        cursor.execute("""
            SELECT qb.name, s.name as subject_name, qb.created_at, 'question_bank' as type
            FROM question_banks qb
            JOIN subjects s ON qb.subject_id = s.id
            ORDER BY qb.created_at DESC
            LIMIT 5
        """)
        qbanks = cursor.fetchall()
        for qb in qbanks:
            activities.append({
                "action": f"Created question bank '{qb['name']}'",
                "subject": qb['subject_name'],
                "time": qb['created_at'],
                "type": "question_bank"
            })
        
        cursor.execute("""
            SELECT name, created_at
            FROM subjects
            ORDER BY created_at DESC
            LIMIT 3
        """)
        subjects = cursor.fetchall()
        for subj in subjects:
            activities.append({
                "action": "Added new subject",
                "subject": subj['name'],
                "time": subj['created_at'],
                "type": "subject"
            })
        
        cursor.execute("""
            SELECT name, created_at
            FROM blueprints
            ORDER BY created_at DESC
            LIMIT 3
        """)
        blueprints = cursor.fetchall()
        for bp in blueprints:
            activities.append({
                "action": f"Created blueprint '{bp['name']}'",
                "subject": "N/A",
                "time": bp['created_at'],
                "type": "blueprint"
            })
        
        cursor.execute("""
            SELECT qp.title, s.name as subject_name, qp.generated_at
            FROM question_papers qp
            JOIN subjects s ON qp.subject_id = s.id
            ORDER BY qp.generated_at DESC
            LIMIT 3
        """)
        papers = cursor.fetchall()
        for paper in papers:
            activities.append({
                "action": "Generated question paper",
                "subject": paper['subject_name'],
                "time": paper['generated_at'],
                "type": "paper"
            })
        
        activities.sort(key=lambda x: x['time'], reverse=True)
        activities = activities[:10]
        
        cursor.close()
        connection.close()
        
        return activities
    except Exception as e:
        if connection:
            connection.close()
        raise HTTPException(status_code=500, detail=f"Error fetching recent activity: {str(e)}")

# ==================== QUESTION PAPER ENDPOINTS ====================

@app.post("/api/question-papers/generate")
async def generate_question_paper_endpoint(
    title: str = Form(...),
    subject_id: int = Form(...),
    question_bank_id: int = Form(...),
    blueprint_id: Optional[int] = Form(None),
    exam_type: Optional[str] = Form("Regular"),
    exam_date: Optional[str] = Form(None),
    duration: Optional[str] = Form("3"),
    file_format: str = Form("pdf")
):
    """Generate actual question paper document from question bank"""
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        
        if blueprint_id is None:
            ensure_default_blueprint_exists()
            cursor.execute("SELECT id FROM blueprints ORDER BY created_at ASC LIMIT 1")
            first_bp = cursor.fetchone()
            if first_bp:
                blueprint_id = first_bp['id']
        
        cursor.execute(f"SELECT id, name, subject_id FROM subjects WHERE id = {placeholder}", (subject_id,))
        subject = cursor.fetchone()
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
        
        cursor.execute(f"SELECT id, name FROM question_banks WHERE id = {placeholder}", (question_bank_id,))
        qbank = cursor.fetchone()
        if not qbank:
            raise HTTPException(status_code=404, detail="Question bank not found")
        
        cursor.execute(f"SELECT id, name, file_path FROM blueprints WHERE id = {placeholder}", (blueprint_id,))
        blueprint = cursor.fetchone()
        if not blueprint:
            raise HTTPException(status_code=404, detail="Blueprint not found")
        
        if not blueprint['file_path']:
            raise HTTPException(
                status_code=400, 
                detail=f"Blueprint '{blueprint['name']}' (ID: {blueprint['id']}) has no file attached. Please delete and recreate it with a JSON file."
            )
        
        if not os.path.exists(blueprint['file_path']):
            raise HTTPException(
                status_code=404, 
                detail=f"Blueprint file not found: {blueprint['file_path']}. Please re-upload the blueprint."
            )
        
        file_ext = blueprint['file_path'].lower()
        if not (file_ext.endswith('.json') or file_ext.endswith('.docx') or file_ext.endswith('.doc')):
            raise HTTPException(status_code=400, detail="Blueprint must be a JSON or DOCX file.")
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_title = "".join(c for c in title if c.isalnum() or c in (' ', '-', '_')).strip()
        safe_title = safe_title.replace(' ', '_')
        filename = f"{subject['subject_id']}_{safe_title}_{timestamp}.{file_format}"
        output_path = PAPERS_DIR / filename
        
        output_path_str, questions_by_part = generate_question_paper(
            cursor=cursor,
            title=title,
            subject_id=subject_id,
            subject_name=subject['name'],
            question_bank_id=question_bank_id,
            blueprint_path=blueprint['file_path'],
            exam_type=exam_type,
            exam_date=exam_date,
            duration=duration,
            file_format=file_format,
            output_path=str(output_path)
        )
        
        parsed_date = None
        if exam_date:
            try:
                from datetime import datetime as dt
                parsed_date = dt.strptime(exam_date, "%Y-%m-%d").date()
            except:
                pass
        
        total_marks = 0
        try:
            if blueprint['file_path'].lower().endswith('.json'):
                with open(blueprint['file_path'], 'r', encoding='utf-8') as f:
                    content = f.read()
                    if not content.strip():
                        raise HTTPException(status_code=400, detail="Blueprint file is empty")
                    bp_data = json.loads(content)
                    parts = bp_data.get('parts', [])
                    for part in parts:
                        instructions = part.get('instructions') or part.get('instruction') or "Answer all questions"
                        configured_count = int(part.get('num_questions') or part.get('count') or 0)
                        marks_per = float(part.get('marks_per_question') or 0)
                        effective_count = _effective_count_from_instruction(str(instructions), configured_count)
                        total_marks += effective_count * marks_per
        except (UnicodeDecodeError, json.JSONDecodeError):
            total_marks = 100

        if total_marks <= 0:
            total_marks = 100
        
        questions_data_json = json.dumps(questions_by_part)
        
        query = f"""
            INSERT INTO question_papers 
            (title, subject_id, blueprint_id, exam_type, exam_date, total_marks, file_format, file_path, questions_data)
            VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
        """
        cursor.execute(query, (title, subject_id, blueprint_id, exam_type, parsed_date, total_marks, file_format, str(output_path), questions_data_json))
        connection.commit()
        
        paper_id = cursor.lastrowid
        
        cursor.execute(f"""
            SELECT id, title, subject_id, blueprint_id, exam_type, exam_date, 
                   total_marks, file_format, file_path, generated_at
            FROM question_papers WHERE id = {placeholder}
        """, (paper_id,))
        paper = cursor.fetchone()
        
        cursor.close()
        connection.close()
        
        return dict(paper)
    except HTTPException:
        raise
    except Exception as e:
        if connection:
            connection.rollback()
            connection.close()
        raise HTTPException(status_code=500, detail=f"Error generating question paper: {str(e)}")

@app.post("/api/question-papers/generate-from-data", response_model=QuestionPaperResponse)
async def generate_question_paper_from_data(request: dict):
    """Generate PDF/DOCX from paper data sent by frontend"""
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        
        # Extract data from request
        title = request.get('title')
        subject_id = request.get('subject_id')
        blueprint_id = request.get('blueprint_id')
        exam_type = request.get('exam_type', 'Regular')
        exam_date = request.get('exam_date')
        exam_duration = request.get('exam_duration', '3')
        total_marks = 0
        file_format = request.get('file_format', 'pdf')
        paper_data = request.get('paper_data')  # Contains parts and questions
        
        # Validate subject
        cursor.execute(f"SELECT id, subject_id, name FROM subjects WHERE id = {placeholder}", (subject_id,))
        subject = cursor.fetchone()
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
        
        # Create output file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_title = "".join(c for c in title if c.isalnum() or c in (' ', '-', '_')).strip()
        safe_title = safe_title.replace(' ', '_')
        filename = f"{subject['subject_id']}_{safe_title}_{timestamp}.{file_format}"
        output_path = PAPERS_DIR / filename
        
        # Convert paper_data to questions_by_part format
        questions_by_part = {}
        for part in paper_data.get('parts', []):
            questions_by_part[part['part_name']] = part['questions']
        
        # Create blueprint dict from paper_data
        blueprint = {
            'name': title,
            'total_marks': 0,
            'parts': [
                {
                    'part_name': part['part_name'],
                    'instructions': part.get('instructions', 'Answer all questions'),
                    'num_questions': len(part['questions']),
                    'marks_per_question': part.get('marks_per_question', 2),
                    'difficulty': part.get('difficulty', 'medium')
                }
                for part in paper_data.get('parts', [])
            ]
        }

        # Calculate effective total marks based on instructions (e.g., "Answer any two")
        for part in blueprint['parts']:
            instructions = part.get('instructions') or part.get('instruction') or "Answer all questions"
            configured_count = int(part.get('num_questions') or part.get('count') or 0)
            marks_per = float(part.get('marks_per_question') or 0)
            effective_count = _effective_count_from_instruction(str(instructions), configured_count)
            total_marks += effective_count * marks_per

        if total_marks <= 0:
            total_marks = request.get('total_marks', 100)

        blueprint['total_marks'] = total_marks
        
        # Generate the file
        if file_format == 'pdf':
            from services.paper_generator import generate_pdf_paper
            generate_pdf_paper(
                title=title,
                subject_name=subject['name'],
                exam_type=exam_type,
                exam_date=exam_date or '',
                total_marks=total_marks,
                duration=exam_duration,
                blueprint=blueprint,
                questions_by_part=questions_by_part,
                output_path=str(output_path)
            )
        else:  # docx
            from services.paper_generator import generate_docx_paper
            generate_docx_paper(
                title=title,
                subject_name=subject['name'],
                exam_type=exam_type,
                exam_date=exam_date or '',
                total_marks=total_marks,
                duration=exam_duration,
                blueprint=blueprint,
                questions_by_part=questions_by_part,
                output_path=str(output_path)
            )
        
        # Parse exam date
        parsed_date = None
        if exam_date:
            try:
                from datetime import datetime as dt
                parsed_date = dt.strptime(exam_date, "%Y-%m-%d").date()
            except:
                pass
        
        # Save to database
        questions_data_json = json.dumps(questions_by_part)
        
        query = f"""
            INSERT INTO question_papers 
            (title, subject_id, blueprint_id, exam_type, exam_date, total_marks, file_format, file_path, questions_data)
            VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
        """
        
        cursor.execute(
            query,
            (title, subject_id, blueprint_id, exam_type, parsed_date, total_marks, file_format, str(output_path), questions_data_json)
        )
        
        connection.commit()
        
        # Get the inserted paper
        paper_id = cursor.lastrowid if get_db_type() != 'postgresql' else cursor.fetchone()[0]
        cursor.execute(f"SELECT * FROM question_papers WHERE id = {placeholder}", (paper_id,))
        paper = cursor.fetchone()
        
        cursor.close()
        connection.close()
        
        return dict(paper)
        
    except HTTPException:
        raise
    except Exception as e:
        if connection:
            connection.rollback()
            connection.close()
        raise HTTPException(status_code=500, detail=f"Error generating paper: {str(e)}")

@app.post("/api/question-papers", response_model=QuestionPaperResponse)
async def create_question_paper(
    title: str = Form(...),
    subject_id: int = Form(...),
    blueprint_id: Optional[int] = Form(None),
    exam_type: Optional[str] = Form(None),
    exam_date: Optional[str] = Form(None),
    total_marks: Optional[float] = Form(None),
    file_format: Optional[str] = Form("txt"),
    paper_content: UploadFile = File(...)
):
    """Save a pre-generated question paper to database (legacy endpoint)"""
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        
        # Validate subject exists
        cursor.execute(f"SELECT id, subject_id, name FROM subjects WHERE id = {placeholder}", (subject_id,))
        subject = cursor.fetchone()
        if not subject:
            cursor.close()
            connection.close()
            raise HTTPException(status_code=404, detail="Subject not found")
        
        # Save the uploaded file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_title = "".join(c for c in title if c.isalnum() or c in (' ', '-', '_')).strip()
        safe_title = safe_title.replace(' ', '_')
        
        # Determine file extension
        content_type = paper_content.content_type or ''
        if 'pdf' in content_type or file_format == 'pdf':
            ext = 'pdf'
        elif 'word' in content_type or 'officedocument' in content_type or file_format in ['docx', 'doc']:
            ext = 'docx'
        else:
            ext = 'txt'
        
        filename = f"{subject['subject_id']}_{safe_title}_{timestamp}.{ext}"
        file_path = PAPERS_DIR / filename
        
        # Save file
        content = await paper_content.read()
        with open(file_path, 'wb') as f:
            f.write(content)
        
        # Parse exam date
        parsed_date = None
        if exam_date:
            try:
                from datetime import datetime as dt
                parsed_date = dt.strptime(exam_date, "%Y-%m-%d").date()
            except:
                pass
        
        # Insert into database
        query = f"""
            INSERT INTO question_papers 
            (title, subject_id, blueprint_id, exam_type, exam_date, total_marks, file_format, file_path, questions_data)
            VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
        """
        
        cursor.execute(
            query,
            (title, subject_id, blueprint_id, exam_type, parsed_date, total_marks or 100, ext, str(file_path), None)
        )
        
        connection.commit()
        
        # Get the inserted paper
        paper_id = cursor.lastrowid if get_db_type() != 'postgresql' else cursor.fetchone()[0]
        cursor.execute(f"SELECT * FROM question_papers WHERE id = {placeholder}", (paper_id,))
        paper = cursor.fetchone()
        
        cursor.close()
        connection.close()
        
        return dict(paper)
        
    except HTTPException:
        raise
    except Exception as e:
        if connection:
            connection.rollback()
            connection.close()
        raise HTTPException(status_code=500, detail=f"Error saving question paper: {str(e)}")

@app.get("/api/question-papers", response_model=List[QuestionPaperResponse])
async def get_all_question_papers():
    """Get all question papers"""
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = get_cursor(connection)
        cursor.execute("""
            SELECT qp.*, s.name as subject_name,
                   EXISTS(SELECT 1 FROM answer_scripts WHERE question_paper_id = qp.id) as has_answer_script
            FROM question_papers qp
            LEFT JOIN subjects s ON qp.subject_id = s.id
            ORDER BY qp.generated_at DESC
        """)
        papers = cursor.fetchall()
        papers_list = [dict(paper) for paper in papers]
        cursor.close()
        connection.close()
        return [dict(p) for p in papers]
    except Exception as e:
        print(f"DEBUG: Error in get_all_question_papers: {str(e)}")
        if connection:
            connection.close()
        raise HTTPException(status_code=500, detail=f"Error fetching question papers: {str(e)}")

@app.get("/api/question-papers/{paper_id}/download")
async def download_question_paper(paper_id: int):
    """Download the generated question paper file"""
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        cursor.execute(f"SELECT file_path, title, file_format FROM question_papers WHERE id = {placeholder}", (paper_id,))
        paper = cursor.fetchone()
        
        cursor.close()
        connection.close()
        
        if not paper:
            raise HTTPException(status_code=404, detail="Question paper not found")
        
        if not paper['file_path'] or not os.path.exists(paper['file_path']):
            raise HTTPException(status_code=404, detail="Question paper file not found")
        
        # Determine media type based on file format
        file_format = paper['file_format'] or 'pdf'
        if file_format == 'pdf':
            media_type = "application/pdf"
        elif file_format in ['docx', 'doc']:
            media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        else:
            media_type = "text/plain"
        
        filename = os.path.basename(paper['file_path'])
        
        return FileResponse(
            path=paper['file_path'],
            media_type=media_type,
            filename=filename
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error downloading paper: {str(e)}")

@app.delete("/api/question-papers/{paper_id}")
async def delete_question_paper(paper_id: int):
    """Delete a question paper"""
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        
        cursor.execute(f"SELECT file_path FROM question_papers WHERE id = {placeholder}", (paper_id,))
        result = cursor.fetchone()
        
        if not result:
            cursor.close()
            connection.close()
            raise HTTPException(status_code=404, detail="Question paper not found")
        
        file_path = result['file_path'] if result else None
        
        cursor.execute(f"DELETE FROM question_papers WHERE id = {placeholder}", (paper_id,))
        connection.commit()
        
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
        
        cursor.close()
        connection.close()
        
        return {"message": "Question paper deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        if connection:
            connection.rollback()
            connection.close()
        raise HTTPException(status_code=500, detail=f"Error deleting question paper: {str(e)}")

# ==================== GRADING & EVALUATION ENDPOINTS ====================

@app.post("/api/answer-scripts/generate/{paper_id}")
async def generate_script(paper_id: int):
    """Generate answer script for a question paper"""
    connection = get_db_connection()
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()

        # Fast path: if answer script already exists, return immediately
        cursor.execute(
            f"SELECT id, created_at FROM answer_scripts WHERE question_paper_id = {placeholder} ORDER BY created_at DESC LIMIT 1",
            (paper_id,)
        )
        existing_script = cursor.fetchone()
        if existing_script:
            cursor.close()
            connection.close()
            return {
                "success": True,
                "message": "Answer script already exists",
                "already_exists": True,
                "script_id": existing_script["id"] if isinstance(existing_script, dict) else existing_script[0],
            }
        
        cursor.execute(f"SELECT questions_data FROM question_papers WHERE id = {placeholder}", (paper_id,))
        paper = cursor.fetchone()
        if not paper:
            raise HTTPException(status_code=404, detail="Question paper not found")
        
        if not paper['questions_data']:
            raise HTTPException(
                status_code=400, 
                detail="This paper was generated before the automated grading update and doesn't store question data. Please generate a new question paper to use AI grading."
            )
        
        questions_by_part = json.loads(paper['questions_data'])
        answers = generate_answer_script(questions_by_part)
        
        if not answers:
            raise HTTPException(status_code=500, detail="Failed to generate answers using AI")
        
        answer_data_json = json.dumps(answers)
        
        # Save to DB
        cursor.execute(
            f"INSERT INTO answer_scripts (question_paper_id, answer_data) VALUES ({placeholder}, {placeholder})",
            (paper_id, answer_data_json)
        )
        connection.commit()
        
        cursor.close()
        connection.close()
        return {"success": True, "message": "Answer script generated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        if connection: connection.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/answer-scripts/{paper_id}")
async def get_script(paper_id: int):
    """Get answer script for a paper"""
    connection = get_db_connection()
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        cursor.execute(f"SELECT * FROM answer_scripts WHERE question_paper_id = {placeholder} ORDER BY created_at DESC LIMIT 1", (paper_id,))
        script = cursor.fetchone()
        cursor.close()
        connection.close()
        if not script:
            raise HTTPException(status_code=404, detail="Answer script not found")
        return dict(script)
    except HTTPException:
        raise
    except Exception as e:
        if connection: connection.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/answer-scripts/{paper_id}")
async def update_script(paper_id: int, request_data: dict = Body(...)):
    """Update answer script for a paper"""
    connection = get_db_connection()
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        
        # Ensure question paper exists
        cursor.execute(f"SELECT id FROM question_papers WHERE id = {placeholder}", (paper_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Question paper not found")
        
        if 'answer_data' not in request_data:
            raise HTTPException(status_code=400, detail=f"Answer data is required. received keys: {list(request_data.keys())}")
            
        answer_data = request_data.get('answer_data')
        if answer_data is None:
            raise HTTPException(status_code=400, detail="Answer data cannot be null")
            
        # Check if it exists
        cursor.execute(f"SELECT id FROM answer_scripts WHERE question_paper_id = {placeholder} ORDER BY created_at DESC LIMIT 1", (paper_id,))
        existing = cursor.fetchone()
        
        if existing:
            # Update existing
            cursor.execute(
                f"UPDATE answer_scripts SET answer_data = {placeholder} WHERE id = {placeholder}",
                (json.dumps(answer_data), existing['id'])
            )
        else:
            # Create new if doesn't exist (though it should)
            cursor.execute(
                f"INSERT INTO answer_scripts (question_paper_id, answer_data) VALUES ({placeholder}, {placeholder})",
                (paper_id, json.dumps(answer_data))
            )
            
        connection.commit()
        cursor.close()
        connection.close()
        return {"success": True, "message": "Answer script updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        if connection: connection.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/evaluations/evaluate")
async def evaluate_student(
    paper_id: int = Form(...),
    student_name: str = Form(...),
    register_number: str = Form(...),
    department: str = Form(...),
    student_file: UploadFile = File(...)
):
    """Upload student paper and evaluate using AI"""
    connection = get_db_connection()
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        
        # 1. Save uploaded file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{register_number}_{timestamp}_{student_file.filename}"
        file_path = STUDENT_UPLOADS_DIR / filename
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(student_file.file, buffer)
            
        # 2. Extract text from PDF
        student_text = extract_text_from_pdf(str(file_path))
        if not student_text or len(student_text.strip()) < 50:
            raise HTTPException(status_code=400, detail="Could not extract enough text from the student paper. Ensure it is a valid PDF with selectable text.")
            
        # 3. Get official answer script
        cursor.execute(f"SELECT answer_data FROM answer_scripts WHERE question_paper_id = {placeholder} ORDER BY created_at DESC LIMIT 1", (paper_id,))
        script = cursor.fetchone()
        if not script:
            raise HTTPException(status_code=400, detail="No official answer script found for this paper. Generate it first.")
        
        answer_script = json.loads(script['answer_data'])
        
        # 4. AI Grading
        grading_result = grade_student_paper(answer_script, student_text)
        if not grading_result:
            raise HTTPException(status_code=500, detail="AI grading failed")
            
        marks_obtained = grading_result.get('total_marks_obtained', 0)
        total_marks = grading_result.get('total_max_marks', 100)
        result_status = "PASS" if marks_obtained >= (total_marks * 0.4) else "FAIL" # 40% Pass Mark
        
        # 5. Save evaluation to DB
        query = f"""
            INSERT INTO evaluations 
            (question_paper_id, student_name, register_number, department, marks_obtained, total_marks, result_status, evaluation_details, file_path)
            VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
        """
        cursor.execute(query, (
            paper_id, student_name, register_number, department, 
            marks_obtained, total_marks, result_status, 
            json.dumps(grading_result), str(file_path)
        ))
        connection.commit()
        
        cursor.close()
        connection.close()
        return {"success": True, "result": result_status, "marks": marks_obtained}
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        if connection: connection.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/evaluations/results/{paper_id}")
async def get_results(paper_id: int):
    """Get all evaluation results for a paper"""
    connection = get_db_connection()
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        cursor.execute(f"SELECT * FROM evaluations WHERE question_paper_id = {placeholder} ORDER BY created_at DESC", (paper_id,))
        results = cursor.fetchall()
        cursor.close()
        connection.close()
        return [dict(r) for r in results]
    except Exception as e:
        if connection: connection.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/evaluations/report/{paper_id}")
async def get_report(paper_id: int):
    """Get summary report for a paper"""
    connection = get_db_connection()
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        
        cursor.execute(f"SELECT * FROM evaluations WHERE question_paper_id = {placeholder}", (paper_id,))
        results = [dict(r) for r in cursor.fetchall()]
        
        if not results:
            return {"total_students": 0}
            
        total_students = len(results)
        pass_count = sum(1 for r in results if r['result_status'] == 'PASS')
        fail_count = total_students - pass_count
        average_marks = sum(r['marks_obtained'] for r in results) / total_students
        
        # Try to get answer script
        cursor.execute(f"SELECT answer_data FROM answer_scripts WHERE question_paper_id = {placeholder} ORDER BY created_at DESC LIMIT 1", (paper_id,))
        script = cursor.fetchone()
        answer_script = json.loads(script['answer_data']) if script else None

        cursor.close()
        connection.close()
        
        return {
            "total_students": total_students,
            "pass_count": pass_count,
            "fail_count": fail_count,
            "pass_percentage": (pass_count / total_students) * 100,
            "average_marks": average_marks,
            "results": results,
            "answer_script": answer_script
        }
    except HTTPException:
        raise
    except Exception as e:
        if connection: connection.close()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8010")),
        reload=False,
        log_level="info",
        access_log=True,
    )