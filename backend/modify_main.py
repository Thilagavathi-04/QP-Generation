import re
import os

with open("main.py", "r") as f:
    content = f.read()

# 1. Add PyJWT import and configuration
if "import jwt" not in content:
    content = content.replace("import base64\\n", "import base64\\nimport jwt\\n\\nJWT_SECRET = os.getenv('JWT_SECRET', 'super-secret-key-change-me-to-something-secure-for-production')\\nJWT_ALGORITHM = 'HS256'\\nALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:5174,http://localhost:3000').split(',')\\n")

# 2. Update CORS
old_cors = """app.add_middleware(
    CORSMiddleware,
    allow_origins=["*", "http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)"""
new_cors = """app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)"""
content = content.replace(old_cors, new_cors)

# 3. Update Token Methods
old_make_token = """def _make_token(user_id: int, email: str, role: str) -> str:
    \"\"\"Create a simple base64 token encoding user info\"\"\"
    payload = json.dumps({"id": user_id, "email": email, "role": role})
    return base64.b64encode(payload.encode()).decode()"""
new_make_token = """def _make_token(user_id: int, email: str, role: str) -> str:
    \"\"\"Create a secure JWT token encoding user info\"\"\"
    from datetime import datetime, timedelta
    payload = {
        "id": user_id, 
        "email": email, 
        "role": role,
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)"""
content = content.replace(old_make_token, new_make_token)

old_decode_token = """def _decode_token(token: str) -> dict:
    \"\"\"Decode base64 token and return payload dict\"\"\"
    try:
        payload = base64.b64decode(token.encode()).decode()
        return json.loads(payload)
    except Exception:
        return {}"""
new_decode_token = """def _decode_token(token: str) -> dict:
    \"\"\"Decode JWT token and return payload dict\"\"\"
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:
        return {}"""
content = content.replace(old_decode_token, new_decode_token)

# 4. Modify generate_all_questions to use BackgroundTasks
# First let's find the generate_all_questions signature
old_generate_all = """@app.post("/api/subjects/{subject_id}/generate-all-questions")
def generate_all_questions(subject_id: int, requests: List[QuestionGenerationRequest]):"""
new_generate_all = """@app.post("/api/subjects/{subject_id}/generate-all-questions")
def generate_all_questions(subject_id: int, requests: List[QuestionGenerationRequest], background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    GENERATION_JOBS[job_id] = {"status": "pending"}
    background_tasks.add_task(_run_generate_all_questions, job_id, subject_id, requests)
    return {"success": True, "job_id": job_id}

def _run_generate_all_questions(job_id: str, subject_id: int, requests: List[QuestionGenerationRequest]):"""

content = content.replace(old_generate_all, new_generate_all)

# Replace the end of generate_all_questions where it returns
old_end_generate_all = """        if tasks_inputs:
            # Execute all part generations concurrently
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as executor:
                all_results = list(executor.map(fetch_questions, tasks_inputs))
        else:
            all_results = []
        
        cursor.close()
        connection.close()
        
        return {
            'success': True,
            'parts': all_results,
            'job_id': getattr(request, 'job_id', None) if 'request' in locals() else None
        }
    except HTTPException:
        raise
    except Exception as e:
        if connection:
            connection.close()
        raise HTTPException(status_code=500, detail=f"Error generating all questions: {str(e)}")"""

# Wait, `generate_all_questions` returns are different. Let's write a targeted search to find what to replace.
# Actually, it's safer to just let me view the end of `generate_all_questions`.
with open("main.py", "w") as f:
    f.write(content)
print("Auth and CORS done.")
