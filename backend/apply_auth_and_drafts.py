import re

with open('backend/main.py', 'r') as f:
    content = f.read()

# Add get_current_user_id dependency
dep_code = """
from fastapi import Header, Depends

def get_current_user_id(authorization: str = Header(None)) -> int | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ")[1]
    try:
        payload = _decode_token(token)
        if payload and "id" in payload:
            return payload["id"]
    except Exception:
        pass
    return None

class DraftRequest(BaseModel):
    draft_data: str
"""

if "def get_current_user_id" not in content:
    content = content.replace('class LoginRequest(BaseModel):', dep_code + '\nclass LoginRequest(BaseModel):')

# Add draft endpoints
drafts_code = """
@app.get("/api/subjects/{subject_id}/user-draft")
def get_user_draft(subject_id: int, user_id: int | None = Depends(get_current_user_id)):
    if not user_id:
        return {"success": False, "message": "Not authenticated"}
    
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
        
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        cursor.execute(
            f"SELECT active_job_id, draft_data FROM user_drafts WHERE user_id = {placeholder} AND subject_id = {placeholder}",
            (user_id, subject_id)
        )
        row = cursor.fetchone()
        
        if row:
            # Only return job_id if it's still an active job in memory
            active_job_id = row['active_job_id']
            if active_job_id and active_job_id not in GENERATION_JOBS:
                active_job_id = None
                
            return {
                "success": True, 
                "active_job_id": active_job_id,
                "draft_data": row['draft_data']
            }
        return {"success": True, "active_job_id": None, "draft_data": None}
    finally:
        cursor.close()
        connection.close()

@app.post("/api/subjects/{subject_id}/user-draft")
def save_user_draft(subject_id: int, request: DraftRequest, user_id: int | None = Depends(get_current_user_id)):
    if not user_id:
        return {"success": False, "message": "Not authenticated"}
        
    connection = get_db_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
        
    try:
        cursor = get_cursor(connection)
        placeholder = get_placeholder()
        
        # Check if exists
        cursor.execute(f"SELECT id FROM user_drafts WHERE user_id = {placeholder} AND subject_id = {placeholder}", (user_id, subject_id))
        if cursor.fetchone():
            cursor.execute(
                f"UPDATE user_drafts SET draft_data = {placeholder} WHERE user_id = {placeholder} AND subject_id = {placeholder}",
                (request.draft_data, user_id, subject_id)
            )
        else:
            cursor.execute(
                f"INSERT INTO user_drafts (user_id, subject_id, draft_data) VALUES ({placeholder}, {placeholder}, {placeholder})",
                (user_id, subject_id, request.draft_data)
            )
        connection.commit()
        return {"success": True}
    finally:
        cursor.close()
        connection.close()
"""

if "@app.get(\"/api/subjects/{subject_id}/user-draft\")" not in content:
    content = content.replace('@app.post("/api/subjects/{subject_id}/generate-questions")', drafts_code + '\n@app.post("/api/subjects/{subject_id}/generate-questions")')

# Modify generate-questions to take user_id and update active_job_id
if "user_id: int | None = Depends(get_current_user_id)" not in content.split('@app.post("/api/subjects/{subject_id}/generate-questions")')[1].split("def ")[1]:
    old_def = "def generate_questions(subject_id: int, request: QuestionGenerationRequest, background_tasks: BackgroundTasks):"
    new_def = "def generate_questions(subject_id: int, request: QuestionGenerationRequest, background_tasks: BackgroundTasks, user_id: int | None = Depends(get_current_user_id)):"
    content = content.replace(old_def, new_def)
    
    # inject db update for job_id
    job_injection = """    GENERATION_JOBS[job_id] = {"status": "pending"}
    
    if user_id:
        try:
            conn = get_db_connection()
            if conn:
                c = get_cursor(conn)
                p = get_placeholder()
                c.execute(f"SELECT id FROM user_drafts WHERE user_id = {p} AND subject_id = {p}", (user_id, subject_id))
                if c.fetchone():
                    c.execute(f"UPDATE user_drafts SET active_job_id = {p} WHERE user_id = {p} AND subject_id = {p}", (job_id, user_id, subject_id))
                else:
                    c.execute(f"INSERT INTO user_drafts (user_id, subject_id, active_job_id) VALUES ({p}, {p}, {p})", (user_id, subject_id, job_id))
                conn.commit()
                c.close()
                conn.close()
        except Exception as e:
            print(f"Failed to update active_job_id: {e}")
"""
    content = content.replace('    GENERATION_JOBS[job_id] = {"status": "pending"}', job_injection, 1)

# Modify generate_all_questions
if "user_id: int | None = Depends(get_current_user_id)" not in content.split('@app.post("/api/subjects/{subject_id}/generate-all-questions")')[1].split("def ")[1]:
    old_def_all = "def generate_all_questions(subject_id: int, requests: List[QuestionGenerationRequest], background_tasks: BackgroundTasks):"
    new_def_all = "def generate_all_questions(subject_id: int, requests: List[QuestionGenerationRequest], background_tasks: BackgroundTasks, user_id: int | None = Depends(get_current_user_id)):"
    content = content.replace(old_def_all, new_def_all)
    
    job_injection_all = """    GENERATION_JOBS[job_id] = {"status": "pending"}
    
    if user_id:
        try:
            conn = get_db_connection()
            if conn:
                c = get_cursor(conn)
                p = get_placeholder()
                c.execute(f"SELECT id FROM user_drafts WHERE user_id = {p} AND subject_id = {p}", (user_id, subject_id))
                if c.fetchone():
                    c.execute(f"UPDATE user_drafts SET active_job_id = {p} WHERE user_id = {p} AND subject_id = {p}", (job_id, user_id, subject_id))
                else:
                    c.execute(f"INSERT INTO user_drafts (user_id, subject_id, active_job_id) VALUES ({p}, {p}, {p})", (user_id, subject_id, job_id))
                conn.commit()
                c.close()
                conn.close()
        except Exception as e:
            print(f"Failed to update active_job_id: {e}")
"""
    # find the next instance after generate_all_questions
    idx = content.find('@app.post("/api/subjects/{subject_id}/generate-all-questions")')
    if idx != -1:
        part1 = content[:idx]
        part2 = content[idx:]
        part2 = part2.replace('    GENERATION_JOBS[job_id] = {"status": "pending"}', job_injection_all, 1)
        content = part1 + part2

with open('backend/main.py', 'w') as f:
    f.write(content)

print("Applied backend changes")
