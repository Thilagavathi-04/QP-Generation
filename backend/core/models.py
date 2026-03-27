from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime, date

class GenerationPlanItem(BaseModel):
    """Fine-grained generation plan entry for one unit/difficulty/Bloom combination."""
    unit: int = Field(..., ge=1)
    difficulty: str
    blooms_level: Optional[str] = None  # e.g. Remember, Understand, Apply, Analyze, Evaluate, Create
    count: int = Field(..., gt=0)

class QuestionGenerationRequest(BaseModel):
    from_unit: int
    to_unit: int
    count: int = 10  # Default value
    marks: float = 2.0  # Default value
    difficulty: str  # ✅ No default - REQUIRED
    part_name: Optional[str] = "Part A"  # Optional with default
    question_bank_id: Optional[int] = None
    ai_provider: Optional[str] = "auto"  # auto | ollama | xai | openai | gemini
    # Optional advanced per-unit plan; when provided, the backend will ignore
    # the single global `count`/`difficulty` and instead generate per plan item.
    plan: Optional[List[GenerationPlanItem]] = None


class SubjectCreate(BaseModel):
    subject_id: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=255)
    syllabus_file: Optional[str] = None
    book_file: Optional[str] = None
    course_outcome_file: Optional[str] = None
    use_book_for_generation: bool = False

class SubjectUpdate(BaseModel):
    subject_id: Optional[str] = Field(None, min_length=1, max_length=50)
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    syllabus_file: Optional[str] = None
    book_file: Optional[str] = None
    course_outcome_file: Optional[str] = None
    use_book_for_generation: Optional[bool] = None

class SubjectResponse(BaseModel):
    id: int
    subject_id: str
    name: str
    syllabus_file: Optional[str] = None
    book_file: Optional[str] = None
    course_outcome_file: Optional[str] = None
    use_book_for_generation: bool
    created_at: datetime
    updated_at: datetime

class QuestionBankCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    subject_id: int
    description: Optional[str] = None

class QuestionBankResponse(BaseModel):
    id: int
    name: str
    subject_id: int
    description: Optional[str] = None
    total_questions: int
    created_at: datetime

class QuestionCreate(BaseModel):
    question_bank_id: int
    subject_id: int
    content: str
    part: Optional[str] = None
    unit: Optional[str] = None
    topic: Optional[str] = None
    difficulty: Optional[str] = None
    marks: Optional[float] = None

class QuestionResponse(BaseModel):
    id: int
    question_bank_id: int
    subject_id: int
    content: str
    part: Optional[str] = None
    unit: Optional[str] = None
    topic: Optional[str] = None
    difficulty: Optional[str] = None
    marks: Optional[float] = None
    created_at: datetime

class BlueprintPartConfig(BaseModel):
    part_name: str
    instructions: Optional[str] = "Answer all questions"
    num_questions: int
    marks_per_question: float
    difficulty: str = "medium"  # ✅ Default value for backward compatibility

class BlueprintCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    parts_config: List[BlueprintPartConfig]  # ✅ CHANGED: Made REQUIRED (not Optional)

class BlueprintPartResponse(BaseModel):
    id: int
    blueprint_id: int
    part_name: str
    instructions: Optional[str] = None
    num_questions: int
    marks_per_question: float
    difficulty: str
    part_order: int
    created_at: datetime

class BlueprintResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    file_name: Optional[str] = None
    file_path: Optional[str] = None
    parts_config: Optional[str] = None  # JSON string
    total_questions: Optional[int] = None
    total_marks: Optional[float] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class QuestionPaperCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    subject_id: int
    blueprint_id: Optional[int] = None
    exam_type: Optional[str] = None
    exam_date: Optional[date] = None
    total_marks: Optional[float] = None
    file_format: Optional[str] = None
    file_path: Optional[str] = None

class QuestionPaperResponse(BaseModel):
    id: int
    title: str
    subject_id: int
    subject_name: Optional[str] = None
    blueprint_id: Optional[int] = None
    exam_type: Optional[str] = None
    exam_date: Optional[date] = None
    total_marks: Optional[float] = None
    file_format: Optional[str] = None
    file_path: Optional[str] = None
    generated_at: datetime
    has_answer_script: bool = False

# Auth Models
class OTPRequest(BaseModel):
    email: EmailStr
    is_login: bool = True
    name: Optional[str] = None
    app_password: Optional[str] = None

class OTPVerify(BaseModel):
    email: EmailStr
    otp: str
    is_login: bool = True
    name: Optional[str] = None

class AuthResponse(BaseModel):
    success: bool
    message: str
    user: Optional[dict] = None
    token: Optional[str] = None

# Evaluation & Answer Script Models
class AnswerScriptResponse(BaseModel):
    id: int
    question_paper_id: int
    answer_data: str # JSON string
    created_at: datetime

class EvaluationCreate(BaseModel):
    question_paper_id: int
    student_name: str
    register_number: str
    department: str
    student_paper_text: Optional[str] = None # Text extracted from uploaded paper
    file_path: Optional[str] = None

class EvaluationResponse(BaseModel):
    id: int
    question_paper_id: int
    student_name: str
    register_number: str
    department: str
    marks_obtained: float
    total_marks: float
    result_status: str
    evaluation_details: str # JSON string
    file_path: Optional[str] = None
    created_at: datetime

class ReportSummary(BaseModel):
    total_students: int
    pass_count: int
    fail_count: int
    pass_percentage: float
    average_marks: float
    results: List[EvaluationResponse]
