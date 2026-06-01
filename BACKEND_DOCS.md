# Quest Generator - Backend Documentation

**Version:** 1.0  
**Last Updated:** May 2026

---

## Table of Contents

1. [Backend Overview](#backend-overview)
2. [Directory Structure](#directory-structure)
3. [Core Module Files](#core-module-files)
4. [Service Module Files](#service-module-files)
5. [Utility Module Files](#utility-module-files)
6. [Configuration Files](#configuration-files)
7. [Database Schema](#database-schema)
8. [API Architecture](#api-architecture)

---

## Backend Overview

The Quest Generator backend is a **FastAPI-based Python 3.10+ application** that handles:
- Document upload and RAG indexing
- AI-powered question generation (hybrid LLM: Ollama + Cloud fallback)
- Question paper assembly and PDF generation
- Automated student answer grading
- Image processing and extraction from documents

### Technology Stack
- **Framework**: FastAPI + Uvicorn
- **Database**: MySQL (relational data)
- **Vector Store**: Qdrant (embeddings for RAG)
- **Document Processing**: PyPDF2, pdfplumber, python-docx, PyMuPDF
- **AI**: Ollama (local), xAI/OpenAI/Gemini (cloud)
- **Embeddings**: SentenceTransformers (all-MiniLM-L6-v2)
- **Image Processing**: Pillow (PIL)

---

## Directory Structure

```
backend/
├── main.py                    # FastAPI application entry point
├── requirements.txt           # Python dependencies
├── Dockerfile                 # Container configuration
├── .env                       # Environment variables (secrets)
├── .dockerignore               # Docker build ignore patterns
│
├── core/                      # Core infrastructure
│   ├── database.py            # MySQL connection and initialization
│   └── models.py              # Pydantic data models (schemas)
│
├── services/                  # Business logic microservices
│   ├── question_generator.py  # AI question generation (Ollama/Cloud)
│   ├── paper_generator.py     # Paper assembly and PDF export
│   ├── grading_engine.py      # Answer parsing and automated grading
│   ├── rag_retrieval.py       # Context retrieval from Qdrant
│   ├── rag_ingestion.py       # Document chunking and indexing
│   ├── rag_chunker.py         # Text splitting strategies
│   ├── rag_config.py          # RAG configuration and logging
│   ├── qdrant_client.py       # Qdrant vector DB interface
│   ├── image_extractor.py     # PDF image extraction + rotation fix
│   ├── image_integration.py   # Image matching for questions
│   ├── image_agents.py        # Image retrieval without LangGraph
│   ├── image_service.py       # Image storage/retrieval from DB
│   ├── image_web_search.py    # Web search fallback for images
│   ├── blueprint_guard.py     # Blueprint validation and safety
│   ├── blueprint_loader.py    # Blueprint file loading
│   ├── blueprint_repository.py # Blueprint persistence layer
│   └── default_blueprint.py   # Default template structure
│
├── utils/                     # Utility functions
│   └── syllabus_parser.py     # Syllabus document parsing
│
├── tests/                     # Test files
│   ├── test_api_generation.py
│   ├── test_paper_gen_api.py
│   ├── test_rag_retrieval.py
│   └── ...
│
├── data/                      # File storage (persistent)
│   └── uploads/
│       ├── syllabus/          # RAG source documents
│       ├── books/             # Reference materials
│       ├── blueprints/        # Paper templates (JSON)
│       ├── papers/            # Generated PDF/DOCX papers
│       ├── student_submissions/ # Student answer files
│       ├── course_outcomes/   # Learning objectives
│       └── question_images/   # Extracted images from PDFs
│
└── logs/                      # Application logs

```

---

## Core Module Files

### 1. `core/database.py`
**Purpose**: Database connection management and initialization for MySQL

**Key Functions**:
```python
get_db_connection()
    ├─ Connects to MySQL using mysql-connector-python
    ├─ Reads credentials from .env (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME)
    └─ Returns connection object or None

get_cursor(connection)
    ├─ Creates cursor with dictionary=True
    └─ Enables row access by column name

get_placeholder()
    └─ Returns "%s" for MySQL parameterized queries (SQL injection prevention)

get_db_type()
    └─ Returns "mysql" (database type is MySQL only)

migrate_database()
    ├─ Ensures all required columns exist
    ├─ Adds missing columns to existing tables
    └─ Creates new tables if needed
    
init_database()
    ├─ Creates all tables if they don't exist (blueprints, questions, papers, etc.)
    └─ Initializes schema
```

**Code Flow**:
```
Application Startup
    ↓
init_database() called in main.py
    ↓
connect to MySQL (host, port, user, password, database from .env)
    ↓
Execute CREATE TABLE statements
    ↓
Verify all columns exist (add missing ones)
    ↓
Ready for operations
```

**Environment Variables Required**:
```
DB_HOST=mysql          # Docker: service name | Local: localhost
DB_PORT=3306           # MySQL port
DB_USER=root           # Username
DB_PASSWORD=password   # Password
DB_NAME=quest_generator # Database name
```

**Error Handling**:
- Tries to connect; logs error and returns None if fails
- Handles missing columns gracefully with ALTER TABLE

---

### 2. `core/models.py`
**Purpose**: Pydantic data models for request/response validation

**Key Data Models**:

#### QuestionGenerationRequest
```python
class QuestionGenerationRequest(BaseModel):
    from_unit: int                    # Starting unit
    to_unit: int                      # Ending unit
    count: int = 10                   # Number of questions to generate
    marks: float = 2.0                # Marks per question
    difficulty: str                   # REQUIRED: "easy", "medium", "hard"
    part_name: str = "Part A"         # Section name
    question_bank_id: Optional[int]   # Associated question bank
    topics: Optional[List[str]]       # Specific topics to focus on
    ai_provider: str = "auto"         # "auto" | "ollama" | "xai" | "openai" | "gemini"
    plan: Optional[List[GenerationPlanItem]]  # Fine-grained generation plan
```

#### SubjectCreate / SubjectUpdate / SubjectResponse
```python
SubjectCreate:
    subject_id: str                   # E.g., "CS-101"
    name: str                         # E.g., "Computer Science Fundamentals"
    syllabus_file: Optional[str]      # Path to syllabus PDF
    book_file: Optional[str]          # Path to reference book
    course_outcome_file: Optional[str]
    use_book_for_generation: bool     # Include book in RAG for generation

SubjectResponse includes:
    id: int                           # Database ID
    created_at: datetime
    updated_at: datetime
```

#### BlueprintCreate
```python
class BlueprintCreate(BaseModel):
    name: str                         # Blueprint name
    description: Optional[str]        # Description
    total_marks: int                  # Total marks
    parts: List[BlueprintPartConfig] # Sections (Part A, B, C, etc.)

class BlueprintPartConfig(BaseModel):
    part_name: str                    # "Part A", "Part B", etc.
    num_questions: int                # Questions in this part
    marks_per_question: float         # Marks per question
    difficulty: str = "medium"        # Difficulty level
    instructions: str = "Answer all"  # Instructions for students
```

#### QuestionCreate / QuestionResponse
```python
QuestionCreate:
    question_bank_id: int
    subject_id: int
    content: str                      # Question text
    part: Optional[str]               # "Part A", "Part B", etc.
    unit: Optional[str]               # Unit number
    topic: Optional[str]              # Topic name
    difficulty: Optional[str]         # "easy", "medium", "hard"
    marks: Optional[float]            # Marks assigned
    blooms_level: Optional[str]       # "Remember", "Understand", "Apply", etc.
```

**Usage in main.py**:
```python
@app.post("/api/questions/generate")
async def generate_questions(request: QuestionGenerationRequest):
    # Pydantic automatically validates request body
    # Raises 422 Validation Error if fields don't match schema
    ...
```

---

## Service Module Files

### Core Question & Paper Generation

---

### 3. `services/question_generator.py`
**Purpose**: Generate exam questions using hybrid AI (Ollama + Cloud fallback)

**Key Functions**:

```python
test_ollama_connection()
    ├─ Tests connection to Ollama at http://ollama:11434
    └─ Returns True if "mistral:latest" model is available

generate_questions_with_ollama(context, count, difficulty, topics)
    ├─ Prepares detailed prompt with RAG context
    ├─ Tries Ollama first (30-second timeout)
    ├─ Falls back to xAI → OpenAI → Gemini if Ollama fails
    ├─ Parses JSON response
    ├─ Validates fields: question, options, correct_answer, explanation
    └─ Returns List[Dict] with questions

generate_json_with_ai(prompt, provider="auto")
    ├─ Maps provider string to API client
    ├─ Calls appropriate LLM (Ollama, xAI, OpenAI, Gemini)
    └─ Extracts JSON from response

get_marks_instruction(marks: float) -> str
    └─ Generates prompt instruction based on marks
       (e.g., 2 marks → concise, 5 marks → detailed, 11 marks → essay)

get_blooms_instruction(level: str) -> str
    └─ Generates instruction for cognitive level
       (Remember, Understand, Apply, Analyze, Evaluate, Create)
```

**Configuration (Environment Variables)**:
```
AI_MODE=hybrid                    # "offline" | "online" | "hybrid"
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=mistral:latest
XAI_API_KEY=...                  # Fallback provider
OPENAI_API_KEY=...               # Fallback provider
GEMINI_API_KEY=...               # Fallback provider
```

**Code Flow - Question Generation**:
```
User Request: Generate 10 questions about "Data Structures"
    ↓
Fetch RAG context (top chunks from Qdrant)
    ↓
Build prompt:
  System: "You are an expert examiner..."
  Context: [RAG chunks]
  Task: "Generate 10 questions about Data Structures
         Difficulty: Medium
         Marks per question: 2"
    ↓
Try Ollama (if AI_MODE != "online")
    └─ POST to http://ollama:11434/api/generate
    └─ Timeout: 30 seconds
    ↓
[If timeout/error → Fallback to Cloud]
    ├─ Try xAI API first
    ├─ Then OpenAI if xAI fails
    └─ Then Gemini if OpenAI fails
    ↓
Parse JSON from response:
  [
    {
      "question": "What is a binary tree?",
      "options": ["A", "B", "C", "D"],
      "correct_answer": "A",
      "explanation": "..."
    },
    ...
  ]
    ↓
Validate each question (all fields present)
    ↓
Remove duplicates (cosine similarity > 0.9)
    ↓
Store in MySQL questions table
    ↓
Return to API caller
```

**Error Handling**:
```
Exception during Ollama call
    ↓
Log error with traceback
    ↓
Try next provider (xAI)
    ↓
If all fail: Return error response to frontend
```

---

### 4. `services/paper_generator.py`
**Purpose**: Assemble question paper from question bank and export as PDF/DOCX

**Key Functions**:

```python
generate_question_paper(blueprint_id, paper_format="pdf", custom_instructions=None)
    ├─ Retrieve blueprint specification
    ├─ Select questions matching difficulty/count
    ├─ Track image deduplication (used_image_ids set)
    ├─ Build DOCX document with headers, instructions, questions
    ├─ Embed images (with brightness correction)
    ├─ Convert to PDF if needed
    ├─ Save to backend/data/uploads/papers/
    └─ Return file path and metadata

_build_question_header(paper_options)
    ├─ Create paper title (Subject, Date, Duration)
    ├─ Add instructions for each section
    └─ Add total marks

_add_question_to_docx(doc, question_num, question_text, options, image_blob)
    ├─ Add question text with formatting
    ├─ For MCQ: Add options A, B, C, D
    ├─ If image exists: add image below question
    └─ Add spacing
```

**Image Deduplication Logic** (Critical Feature):
```python
used_image_ids = set()

for question in selected_questions:
    if question.image_id:
        if question.image_id not in used_image_ids:
            # Add image to document
            used_image_ids.add(question.image_id)
        else:
            # Skip - image already used
            # Show question text only
    
    # Add question to paper
```

**Code Flow - Paper Generation**:
```
User Request: Generate paper from Blueprint ID 1
    ↓
Retrieve Blueprint
    ├─ Part A: 10 questions, 2 marks each, Easy
    ├─ Part B: 5 questions, 5 marks each, Medium
    └─ Part C: 5 questions, 11 marks each, Hard
    ↓
Query MySQL: SELECT questions WHERE blueprint_id=1 AND difficulty='easy'
    └─ Get 10 random easy questions
    ↓
[Repeat for Medium, Hard]
    ↓
Start building DOCX document
    ├─ Add Header (Subject, Date, Duration: 3 hours, Total Marks: 100)
    ├─ Add Instructions for each section
    └─ Initialize used_image_ids = {}
    ↓
For each question:
    ├─ Check if image needed
    ├─ If yes:
    │   ├─ Retrieve image blob from database
    │   ├─ Check if image_id already used
    │   ├─ If new image:
    │   │   ├─ Apply brightness correction
    │   │   ├─ Embed in document at 6cm width
    │   │   └─ Add to used_image_ids
    │   └─ Else:
    │       └─ Skip image (show question text only)
    ├─ Add question text
    ├─ For MCQ: Add options [A] [B] [C] [D]
    └─ Add spacing
    ↓
Save document: backend/data/uploads/papers/paper_<uuid>.docx
    ↓
Convert to PDF using python-docx (or pypdf if needed)
    ↓
Save PDF: backend/data/uploads/papers/paper_<uuid>.pdf
    ↓
Insert into MySQL papers table with metadata
    ↓
Return PDF file to frontend (Download)
```

**Output Example**:
```
QUESTION PAPER - CS 101: Data Structures & Algorithms
Date: 20 May 2026 | Duration: 3 hours | Total Marks: 100

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART A: Short Answer (Answer all questions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. What is a binary search tree? (2 marks)

2. Explain the concept of recursion. (2 marks)
   [IMAGE of recursion example - 6cm width]

...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART B: Long Answer (Answer all questions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

11. Design an algorithm to find the median of two sorted arrays. (5 marks)

...
```

---

### 5. `services/grading_engine.py`
**Purpose**: Parse student submissions and automatically grade answers

**Key Functions**:

```python
extract_text_from_pdf(file_path)
    ├─ Uses pdfplumber to extract text from PDF
    └─ Returns extracted text as string

parse_student_submission(text, paper_questions)
    ├─ Parse student answers from extracted text
    ├─ Match answers to question IDs
    └─ Return Dict[question_id -> student_answer]

grade_student_paper(submission_id, paper_id)
    ├─ Retrieve all questions in paper
    ├─ For each question:
    │   ├─ If MCQ: compare options → 1 mark or 0 marks
    │   ├─ If Short Answer: use LLM grading
    │   └─ If Essay: use LLM rubric evaluation
    ├─ Sum all marks
    ├─ Calculate percentage
    ├─ Assign grade band (A+, A, B, C, etc.)
    ├─ Store results in evaluations table
    └─ Return Dict with scores and feedback

grade_mcq_answer(student_option, correct_option, marks)
    ├─ Compare string values (case-insensitive)
    └─ Return marks if match else 0

grade_short_answer(question, student_answer, marks)
    ├─ Generate LLM prompt:
    │   "Grade this short answer:
    │    Question: {question}
    │    Model Answer: {model_answer}
    │    Student Answer: {student_answer}
    │    Max Marks: {marks}
    │    Return: {score, feedback}"
    ├─ Call hybrid LLM (Ollama/Cloud)
    ├─ Parse score from response
    └─ Return score and feedback

grade_essay_answer(question, student_answer, marks)
    ├─ Evaluate on rubric:
    │   ├─ Structure (25%): intro, body, conclusion
    │   ├─ Content (50%): accuracy, completeness, examples
    │   └─ Language (25%): clarity, grammar, terminology
    ├─ Generate LLM evaluation with rubric breakdown
    ├─ Calculate total score
    └─ Return detailed feedback
```

**Code Flow - Grading**:
```
Student submits File (PDF/Image)
    ↓
Upload to: backend/data/uploads/student_submissions/
    ↓
Parse Submission:
    ├─ If PDF: Extract text via pdfplumber
    ├─ If Image: Run OCR (Tesseract) to extract text
    └─ Build answer dictionary
    ↓
Retrieve Paper Questions
    └─ SELECT * FROM papers WHERE id = paper_id
    └─ Get all questions in paper with answer keys
    ↓
For each question:
    
    Case 1: MCQ
    ├─ Student answered: "B"
    ├─ Correct answer: "B"
    ├─ Score: 1 mark ✓
    
    Case 2: Short Answer (5 marks)
    ├─ Prompt LLM:
    │   "Student gave: '{answer}'
    │    Model answer: '{model}'
    │    Scale: 0-5 marks
    │    Respond: {score: X, feedback: 'comment'}"
    ├─ LLM returns: {score: 3, feedback: "Good but missing detail"}
    └─ Score: 3 marks
    
    Case 3: Essay (11 marks)
    ├─ Evaluate on rubric via LLM
    ├─ Break down: structure (25%), content (50%), language (25%)
    └─ Score: 8.5 marks
    
    ↓
Calculate Total:
    └─ Sum all scores → Total Score
    └─ Calculate % → (Total / Max Marks) × 100
    └─ Assign Grade → A+ (90-100%), A (80-89%), etc.
    ↓
Store Results:
    ├─ INSERT INTO evaluations (score, percentage, grade)
    └─ INSERT INTO evaluation_feedback (question_id, score, feedback)
    ↓
Generate Report:
    └─ Create PDF/HTML with scores and feedback
    ↓
Send Results to Student
```

**Example Grading Levels**:
```
Score >= 90%: A+ (Excellent)
Score >= 80%: A  (Very Good)
Score >= 70%: B  (Good)
Score >= 60%: C  (Satisfactory)
Score >= 50%: D  (Pass)
Score <  50%: F  (Fail)
```

---

### RAG (Retrieval-Augmented Generation) Services

---

### 6. `services/rag_retrieval.py`
**Purpose**: Retrieve relevant context from vector database for question generation

**Key Functions**:

```python
retrieve_context(query, subject_id=None, top_k=5)
    ├─ Search Qdrant collection: quest_generator_rag
    ├─ Query for syllabus chunks first (priority)
    ├─ Query for textbook chunks second
    ├─ Return top_k most similar chunks
    └─ Returns Dict with syllabus_chunks and textbook_chunks
.
format_context_for_prompt(context_dict)
    ├─ Takes context_dict from retrieve_context()
    ├─ Formats chunks into readable prompt text
    ├─ Includes source reference (Syllabus vs Textbook)
    └─ Returns formatted string for LLM prompt
```

**Code Flow**:
```
Question Generation Request: "Generate questions on Sorting Algorithms"
    ↓
Call retrieve_context("sorting algorithms", subject_id=1, top_k=5)
    ↓
Query Qdrant for chunks similar to "sorting algorithms"
    ├─ Use embedding model: all-MiniLM-L6-v2
    ├─ Compute embedding for query string
    ├─ Search collection for similar embeddings
    └─ Return top 5 chunks with scores
    ↓
Prioritize Syllabus chunks (if available)
    └─ Sort by source type (syllabus first, then books)
    ↓
Format chunks for prompt:
    
    === CONTEXT FROM SYLLABUS ===
    Chunk 1 (score: 0.95):
    "Sorting is the process of arranging elements in order...
     Common algorithms: Quick Sort, Merge Sort, Bubble Sort..."
    
    Chunk 2 (score: 0.88):
    "Time Complexity Analysis:
     Quick Sort: O(n log n) average, O(n²) worst case..."
    
    === CONTEXT FROM TEXTBOOKS ===
    ...
    ↓
Return formatted context to question generator
    ↓
Question generator builds prompt with context
    └─ Prompt includes: System Message + Context + Task + Instructions
    ↓
LLM generates questions grounded in context
```

---

### 7. `services/rag_ingestion.py`
**Purpose**: Process documents and store embeddings in Qdrant

**Key Functions**:

```python
ingest_documents(subject_id, doc_type="syllabus", file_path=None)
    ├─ Extract text from PDF/DOCX
    ├─ Chunk text into overlapping segments
    ├─ Generate embeddings for each chunk
    ├─ Store in Qdrant with metadata
    └─ Record in MySQL

process_subject_files(subject_id)
    ├─ Find all syllabus files for subject
    ├─ Find all book files for subject
    ├─ Ingest both (prioritize syllabus)
    └─ Return ingestion report
```

**Code Flow**:
```
Teacher uploads: "CS101_Syllabus.pdf" to /api/upload/syllabus
    ↓
Save file to: backend/data/uploads/syllabus/CS101_Syllabus.pdf
    ↓
Call rag_ingestion.ingest_documents(subject_id=1, doc_type="syllabus")
    ↓
Extract Text:
    ├─ Use pdfplumber (for PDF)
    ├─ Use python-docx (for DOCX)
    └─ Return full text string
    ↓
Chunk Text (rag_chunker.py):
    ├─ Split into chunks of ~500-1000 tokens
    ├─ Add 100-token overlap between chunks
    └─ Return List[chunk_string]
    
    Example chunks:
    Chunk 1: "A binary tree is a tree structure where each node..."
    Chunk 2: "...has at most two children. Properties: balanced..."
    Chunk 3: "...AVL trees maintain balance automatically..."
    ↓
Generate Embeddings:
    ├─ For each chunk, use SentenceTransformer("all-MiniLM-L6-v2")
    ├─ embedding = model.encode(chunk_text)
    └─ Each embedding is 384-dimensional vector
    ↓
Store in Qdrant:
    ├─ Collection: quest_generator_rag
    ├─ For each chunk:
    │   ├─ Store vector (384 dimensions)
    │   ├─ Store metadata:
    │   │   ├─ chunk_text
    │   │   ├─ source_filename
    │   │   ├─ doc_type (syllabus/book)
    │   │   ├─ subject_id
    │   │   └─ chunk_index
    └─ Persist to qdrant_storage/
    ↓
Record in MySQL:
    └─ Track: subject_id, file_path, total_chunks, ingestion_time
    ↓
Return: {success: true, chunks_ingested: 25}
```

---

### 8. `services/rag_chunker.py`
**Purpose**: Split documents into overlapping chunks for RAG

**Key Functions**:

```python
chunk_text(text, chunk_size=500, overlap=100)
    ├─ Split text into overlapping chunks
    ├─ chunk_size: tokens per chunk (default 500)
    ├─ overlap: token overlap between chunks (default 100)
    └─ Returns List[chunk_text]

chunk_by_sentences(text, sentences_per_chunk=10)
    ├─ Split by sentence boundaries (better semantic coherence)
    ├─ sentences_per_chunk: number of sentences per chunk
    └─ Returns List[chunk_text]

chunk_by_paragraphs(text, paragraphs_per_chunk=3)
    ├─ Split by paragraph boundaries
    ├─ Preserves document structure
    └─ Returns List[chunk_text]
```

**Chunking Strategy**:
```
Original Document (10,000 tokens total):
    ↓
Split into chunks of 500 tokens with 100-token overlap
    
    Chunk 1 (tokens 0-500):
        "Chapter 1: Introduction to Data Structures
         A data structure is..."
    
    Chunk 2 (tokens 400-900):  ← 100-token overlap with Chunk 1
        "...is an organized collection of data.
         Common types include arrays, linked lists..."
    
    Chunk 3 (tokens 800-1300):  ← 100-token overlap with Chunk 2
        "...lists, stacks, queues, and trees.
         Each has different advantages..."
    
    [Continue until end of document]
    ↓
Result: ~25 chunks with smooth transitions
```

---

### 9. `services/qdrant_client.py`
**Purpose**: Interface with Qdrant vector database

**Key Functions**:

```python
QdrantManager:
    def __init__(self)
        └─ Connect to Qdrant at http://qdrant:6333

    def create_collection(name, vector_size=384)
        └─ Create new collection for embeddings

    def insert_vectors(collection_name, vectors, payloads)
        ├─ vectors: List of embedding arrays
        ├─ payloads: List of metadata dicts
        └─ Store in collection

    def query(query_text, n_results=5, subject_id=None, doc_type="syllabus")
        ├─ Encode query_text to embedding
        ├─ Search for similar embeddings
        ├─ Filter by subject_id if provided
        ├─ Filter by doc_type (syllabus/book) if provided
        └─ Return top_n results with scores

    def delete_collection(name)
        └─ Remove collection from Qdrant

qdrant_manager
    └─ Global instance (singleton) created at module load
```

**Storage Structure**:
```
Qdrant (http://qdrant:6333)
    └─ Collection: quest_generator_rag
        ├─ Vector Size: 384 dimensions
        ├─ Points:
        │   ├─ Point ID: 1
        │   │   ├─ Vector: [0.12, -0.45, ..., 0.78]  (384 floats)
        │   │   └─ Payload (metadata):
        │   │       ├─ text: "Binary tree definition..."
        │   │       ├─ source_filename: "CS101_Syllabus.pdf"
        │   │       ├─ doc_type: "syllabus"
        │   │       ├─ subject_id: 1
        │   │       └─ chunk_index: 0
        │   │
        │   ├─ Point ID: 2
        │   │   ├─ Vector: [...]
        │   │   └─ Payload: {...}
        │   │
        │   └─ [...more points...]
        │
        └─ Persistent Storage: qdrant_storage/collections/quest_generator_rag/
```

---

### Image Processing Services

---

### 10. `services/image_extractor.py`
**Purpose**: Extract images from PDFs and apply quality corrections

**Key Functions**:

```python
detect_and_fix_rotation(image)
    ├─ Detect if image is rotated 90°, 180°, 270°
    ├─ Check aspect ratio:
    │   └─ If width/height < 0.35 AND height > 400px → rotate 90°
    ├─ Corrects text orientation issues from PDF extraction
    └─ Returns corrected PIL Image

fix_extreme_brightness_image(image)
    ├─ Detect unusually bright/dark images
    ├─ If brightness > 0.9 or < 0.1 → invert colors
    ├─ Applies ImageEnhance for readability
    ├─ Prevents black-on-black or white-on-white display
    └─ Returns enhanced PIL Image

extract_images_from_pdf(pdf_path)
    ├─ Open PDF with PyMuPDF (fitz)
    ├─ For each page:
    │   ├─ Extract all images
    │   ├─ Save as PNG
    │   ├─ Apply rotation fix
    │   ├─ Apply brightness fix
    │   └─ Store to backend/data/uploads/question_images/
    └─ Returns List[image_paths]

generate_image_keywords(image)
    ├─ Use PyTesseract OCR on image
    ├─ Extract text from image (keywords)
    └─ Returns keyword string

generate_image_description(image)
    ├─ Analyze image features using PIL
    ├─ Generate text description (color, shape, type)
    └─ Returns description string
```

**Code Flow - Image Extraction**:
```
Teacher uploads: "Algorithms_Textbook.pdf"
    ↓
Save to: backend/data/uploads/books/Algorithms_Textbook.pdf
    ↓
Call: extract_images_from_pdf("Algorithms_Textbook.pdf")
    ↓
Open PDF with PyMuPDF
    ↓
For each page (e.g., Page 1, Page 2, ...):
    ├─ Extract image blob (raw pixel data)
    ├─ Create PIL Image from blob
    ├─ Call detect_and_fix_rotation()
    │   └─ Aspect ratio check → rotate if needed
    ├─ Call fix_extreme_brightness_image()
    │   └─ Brightness check → invert if extreme
    ├─ Save PNG to backend/data/uploads/question_images/img_001.png
    ├─ Generate keywords via OCR (Pytesseract)
    │   └─ Text extracted: "Binary Tree", "Node", "Traversal"
    ├─ Generate description
    │   └─ "Diagram of a binary tree structure with nodes"
    └─ Store metadata in MySQL question_images table
    ↓
[Repeat for all images in PDF]
    ↓
Return: {success: true, images_extracted: 15}
```

---

### 11. `services/image_integration.py`
**Purpose**: Match and assign images to generated questions

**Key Functions**:

```python
detect_image_required_in_question(question_text)
    ├─ Check if question suggests image (e.g., "diagram", "shown in figure")
    ├─ Pattern matching on keywords
    └─ Returns Boolean

get_image_for_question(question_context, required_keywords=None)
    ├─ Call ImageAgentSystem (from image_agents.py)
    ├─ Search database for matching image
    ├─ Calculate match score based on keywords
    ├─ If score >= 0.6 → return image
    └─ If no match → try web search (fallback)

save_image_blob_to_temp(image_blob)
    ├─ Convert blob to PIL Image
    ├─ Save to temporary file with valid PNG header
    ├─ Validate with fsync and file size check
    └─ Returns temp file path

cleanup_temp_image_file(temp_path)
    └─ Delete temporary image file

rotate_image_for_pdf_insertion(image_path, angle)
    ├─ Rotate image by specified angle
    ├─ Save rotated version
    └─ Returns new image path
```

**Code Flow - Image Assignment**:
```
Question Generated: "What is a binary tree? (with diagram)"
    ↓
Check if image is needed:
    ├─ Question text contains "diagram", "figure", "shown below"
    ├─ Or is marked with image_required=True
    └─ Decision: YES, need image
    ↓
Call: get_image_for_question("binary tree diagram")
    ↓
Search database:
    ├─ Query: SELECT images WHERE keywords LIKE "binary%"
    ├─ Get: [img_001, img_002, img_003] (candidates)
    ├─ Score each by keyword match:
    │   ├─ img_001: score = 0.85 (highly relevant)
    │   ├─ img_002: score = 0.62 (somewhat relevant)
    │   └─ img_003: score = 0.45 (not relevant)
    └─ Select best: img_001 (score 0.85 >= 0.6)
    ↓
Retrieve image blob from database
    ↓
When building paper:
    ├─ Load image blob
    ├─ Check image deduplication (used_image_ids)
    ├─ If image ID not used yet:
    │   ├─ Apply brightness correction
    │   ├─ Apply rotation correction
    │   ├─ Embed in paper at 6cm width
    │   └─ Mark as used
    └─ Else: Skip image
    ↓
Paper generated with image embedded
```

---

### 12. `services/image_agents.py`
**Purpose**: Image retrieval without LangGraph dependency (lightweight alternative)

**Key Functions**:

```python
ImageAgentSystem:
    def get_image_for_question(question_context, required_keywords=None, allow_database=True)
        ├─ Normalize keywords from question
        ├─ Search database for images (if allowed)
        ├─ Calculate match score for each candidate
        ├─ If db_confidence >= 0.6 → return best db image
        ├─ Else: Try web search (ImageWebSearch.search_images)
        └─ Return image or None

    @staticmethod
    def _calculate_match_score(image, question_context, required_keywords)
        ├─ Extract keywords from image metadata
        ├─ Count keyword matches (max 5 keywords)
        ├─ Add context term matches
        ├─ Boost if image from PDF extraction
        └─ Return composite score (0.0 to 1.0)

_normalize_keywords(question_context, required_keywords=None)
    ├─ Clean keywords (remove whitespace, lowercase)
    ├─ Extract from question if not provided
    ├─ Remove stop words (the, a, an, etc.)
    ├─ Deduplicate
    └─ Return top 20 keywords

retrieve_image_for_question(question_context, keywords=None, allow_database=True)
    └─ Convenience function wrapper for ImageAgentSystem
```

**Scoring Algorithm**:
```
Score = (keyword_match_ratio × 0.7) + (context_term_ratio × 0.3) + bonus

keyword_match_ratio = matched_keywords / min(5, total_keywords)
context_term_ratio = matched_context_terms / min(10, total_context_terms)

Example:
Question: "Draw a flowchart for binary search algorithm"
Keywords: ["flowchart", "binary", "search", "algorithm"]

Image 1: description = "Binary search flowchart with nodes",
         keywords = ["binary", "search", "flowchart"]
         score = (3/4 × 0.7) + (2/4 × 0.3) = 0.525 + 0.15 = 0.675 ✓

Image 2: description = "Linear search example",
         keywords = ["search", "linear"]
         score = (1/4 × 0.7) + (1/4 × 0.3) = 0.175 + 0.075 = 0.25 ✗
```

---

### 13. `services/image_service.py`
**Purpose**: Store and retrieve images from database

**Key Functions**:

```python
ImageService:
    @staticmethod
    def save_image(image_blob, keywords, description, source_type, file_name)
        ├─ Insert image into MySQL images table
        ├─ Store: blob (LONGBLOB), keywords, description, metadata
        └─ Return image ID

    @staticmethod
    def get_image(image_id)
        └─ Retrieve image by ID from database

    @staticmethod
    def search_images(query, limit=5)
        ├─ Search by keyword/description matching
        ├─ Use LIKE operator on keywords column
        ├─ Return top_limit matching images
        └─ Returns List[image_dict]

    @staticmethod
    def delete_image(image_id)
        └─ Remove image from database
```

**Database Schema**:
```mysql
CREATE TABLE images (
    id INT PRIMARY KEY AUTO_INCREMENT,
    image_blob LONGBLOB NOT NULL,
    keywords TEXT,
    description TEXT,
    source_type VARCHAR(50),  -- "pdf_extraction" | "web_search"
    file_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### 14. `services/image_web_search.py`
**Purpose**: Search web for images as fallback when database images not available

**Key Functions**:

```python
ImageWebSearch:
    @staticmethod
    def search_images(query, limit=3)
        ├─ Use Bing Image Search (via bing-image-downloader)
        ├─ Search for query term
        ├─ Download top_limit images
        ├─ Return List[image_dict] with blob, metadata
        └─ Images are cached locally

    @staticmethod
    def verify_image_matches_context(image_blob, keywords)
        ├─ Analyze image content (color histogram, dimensions)
        ├─ Compare with keywords
        ├─ Calculate confidence score
        └─ Returns confidence_score (0.0-1.0)
```

**Code Flow - Web Search Fallback**:
```
Image not found in database
    ├─ Required for question on "machine learning"
    ↓
Call: ImageWebSearch.search_images("machine learning diagram", limit=3)
    ↓
Use Bing Image Search API
    ├─ Query: "machine learning diagram"
    ├─ Download: Top 3 images
    └─ Save to temp directory
    ↓
For each image:
    ├─ Load as PIL Image
    ├─ Verify relevance using verify_image_matches_context()
    ├─ Calculate confidence score
    └─ Add to candidates
    ↓
Select best image (highest confidence score)
    ↓
Return image blob
```

---

### Blueprint Management Services

---

### 15. `services/blueprint_repository.py`
**Purpose**: Persistent storage layer for blueprints

**Key Functions**:

```python
BlueprintRepository:
    @staticmethod
    def save_blueprint(blueprint_data)
        ├─ Generate unique blueprint ID
        ├─ Serialize data to JSON
        ├─ Save to: backend/data/uploads/blueprints/<id>.json
        ├─ Insert record into MySQL blueprints table
        └─ Returns blueprint_id

    @staticmethod
    def get_by_id(blueprint_id)
        ├─ Query MySQL for blueprint record
        └─ Load JSON file if needed

    @staticmethod
    def update_blueprint(blueprint_id, updates)
        ├─ Merge updates with existing blueprint
        ├─ Update JSON file
        ├─ Update MySQL record
        └─ Returns updated blueprint

    @staticmethod
    def delete_blueprint(blueprint_id)
        ├─ Remove file from backend/data/uploads/blueprints/
        ├─ Delete from MySQL
        └─ Return success status

    @staticmethod
    def list_blueprints(subject_id=None)
        ├─ Query MySQL for all blueprints
        ├─ Filter by subject if provided
        └─ Returns List[blueprint]
```

**Storage**:
```
MySQL blueprints table          Backend/data/uploads/blueprints/
├─ id (PK)                      ├─ 1.json
├─ name                         ├─ 2.json
├─ subject_id                   ├─ 3.json
├─ description                  └─ ...
├─ total_marks
├─ parts_config (JSON)
├─ file_path             (points to JSON file on disk)
└─ created_at
```

---

### 16. `services/blueprint_loader.py`
**Purpose**: Load blueprints from files

**Key Functions**:

```python
BlueprintLoader:
    @staticmethod
    def load_from_file(file_path)
        ├─ Read JSON file
        ├─ Parse and validate structure
        └─ Returns blueprint dict

    @staticmethod
    def load_from_db(blueprint_id)
        ├─ Query MySQL for record
        └─ Returns blueprint dict

    @staticmethod
    def load_default()
        ├─ Return DEFAULT_BLUEPRINT_STRUCTURE
        └─ Failsafe if no blueprints exist
```

---

### 17. `services/blueprint_guard.py`
**Purpose**: Validation and safety layer for blueprints

**Key Functions**:

```python
BlueprintGuard:
    @staticmethod
    def verify_existence(blueprint_id)
        ├─ Check if blueprint exists in MySQL
        ├─ Check if file exists on disk
        ├─ Attempt recovery if missing
        └─ Raise HTTPException if not recoverable

    @staticmethod
    def validate_structure(blueprint_data)
        ├─ Verify all required fields present
        ├─ Validate part configurations
        ├─ Check total marks calculation
        └─ Raise ValueError if invalid

    @staticmethod
    def validate_generation_params(request)
        ├─ Verify count, difficulty, marks
        ├─ Range checks
        └─ Return validated params or raise error
```

---

### 18. `services/default_blueprint.py`
**Purpose**: Provide default blueprint template

**Content**:
```python
DEFAULT_BLUEPRINT_STRUCTURE = {
    "name": "Default University Blueprint",
    "total_marks": 100,
    "parts": [
        {
            "name": "Part A",
            "count": 10,
            "marks_per_question": 2,
            "difficulty": "Easy",
            "instruction": "Answer all questions."
        },
        {
            "name": "Part B",
            "count": 5,
            "marks_per_question": 5,
            "difficulty": "Medium",
            "instruction": "Answer all questions."
        },
        {
            "name": "Part C",
            "count": 5,
            "marks_per_question": 11,
            "difficulty": "Hard",
            "instruction": "Answer any 5 questions."
        }
    ]
}
```

**Usage**:
- Returned when no custom blueprints exist
- Fallback for paper generation
- Basis for user-created blueprints

---

### 19. `services/rag_config.py`
**Purpose**: Configuration and logging for RAG system

**Content**:
```python
import logging
from pathlib import Path

# Directory paths
SYLLABUS_DIR = "/path/to/backend/data/uploads/syllabus"
BOOK_DIR = "/path/to/backend/data/uploads/books"
QUESTION_IMAGES_DIR = "/path/to/backend/data/uploads/question_images"

# Qdrant configuration
QDRANT_HOST = "qdrant"  # Docker service name or "localhost"
QDRANT_PORT = 6333
QDRANT_COLLECTION_NAME = "quest_generator_rag"

# Embeddings configuration
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
EMBEDDING_DIMENSION = 384

# Logging configuration
logger = logging.getLogger("rag_system")
logger.setLevel(logging.INFO)
# File handler: backend/logs/rag.log
# Console handler: stdout
```

---

## Utility Module Files

---

### 20. `utils/syllabus_parser.py`
**Purpose**: Parse syllabus documents and extract structure

**Key Functions**:

```python
parse_syllabus(file_path)
    ├─ Read PDF/DOCX file
    ├─ Extract structured data:
    │   ├─ Course ID, name, credits
    │   ├─ Learning objectives
    │   ├─ Units/chapters with topics
    │   ├─ Assessment methods
    │   └─ References
    ├─ Return parsed structure
    └─ Returns Dict[structured_data]

extract_learning_objectives(text)
    ├─ Parse learning objectives section
    ├─ Map to Bloom's taxonomy levels
    └─ Returns List[objective]

extract_units(text)
    ├─ Extract unit/chapter structure
    ├─ Map topics to units
    └─ Returns Dict[unit_id -> topics]

save_syllabus_to_db(parsed_syllabus, subject_id)
    ├─ Store extracted data in MySQL
    ├─ Create question_banks per unit
    └─ Return success status
```

---

## Configuration Files

---

### 21. `Dockerfile`
**Purpose**: Container image configuration for backend

**Content**:
```dockerfile
FROM python:3.10

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8010

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8010"]
```

**What it does**:
- Uses Python 3.10 base image
- Installs dependencies from requirements.txt
- Copies application code
- Exposes port 8010
- Runs FastAPI app with Uvicorn

---

### 22. `requirements.txt`
**Purpose**: Python package dependencies

**Key Libraries**:
```
fastapi==0.109.0              # Web framework
uvicorn==0.27.0               # ASGI server
mysql-connector-python==8.3.0 # MySQL driver
python-docx==1.1.0            # DOCX generation
reportlab==4.0.7              # PDF generation
PyMuPDF==1.24.14              # PDF image extraction
pdfplumber==0.10.3            # PDF text extraction
Pillow==11.0.0                # Image processing
qdrant-client==1.7.1          # Vector DB client
sentence-transformers==3.0.1  # Embeddings model
requests==2.31.0              # HTTP client (for LLM APIs)
python-dotenv==1.0.0          # .env file loading
email-validator==2.0.0        # Email validation
langchain-core==0.1.52        # LLM utilities
bing-image-downloader==1.1.2  # Web image search
```

---

### `.env` (Example)
**Purpose**: Environment variables for sensitive configuration

```env
# Database Configuration
DB_HOST=mysql
DB_PORT=3306
DB_USER=root
DB_PASSWORD=password123
DB_NAME=quest_generator

# AI Configuration
AI_MODE=hybrid                              # offline | online | hybrid
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=mistral:latest

# Cloud LLM APIs (Fallback)
XAI_API_KEY=xai_key_here
XAI_MODEL=grok-2-latest

OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

GEMINI_API_KEY=gemini_key_here
GEMINI_MODEL=gemini-1.5-flash

# Qdrant Vector DB
QDRANT_HOST=qdrant
QDRANT_PORT=6333

# Server
SERVER_HOST=0.0.0.0
SERVER_PORT=8010
```

---

## Database Schema

---

### 23. Core Tables

```sql
-- Subjects
CREATE TABLE subjects (
    id INT PRIMARY KEY AUTO_INCREMENT,
    subject_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    syllabus_file VARCHAR(255),
    book_file VARCHAR(255),
    use_book_for_generation BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Question Banks
CREATE TABLE question_banks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    subject_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    total_questions INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
);

-- Questions
CREATE TABLE questions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    question_bank_id INT NOT NULL,
    subject_id INT NOT NULL,
    content LONGTEXT NOT NULL,
    part VARCHAR(50),                          -- "Part A", "Part B", "Part C"
    unit VARCHAR(50),                          -- Unit number
    topic VARCHAR(255),                        -- Topic name
    difficulty VARCHAR(50),                    -- "easy", "medium", "hard"
    marks DECIMAL(5,2),                        -- Marks
    blooms_level VARCHAR(50),                  -- Bloom's taxonomy level
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_bank_id) REFERENCES question_banks(id),
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
);

-- Question Options (for MCQ)
CREATE TABLE question_options (
    id INT PRIMARY KEY AUTO_INCREMENT,
    question_id INT NOT NULL,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- Blueprints (Paper templates)
CREATE TABLE blueprints (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    subject_id INT,
    description TEXT,
    total_marks DECIMAL(6,2),
    total_questions INT,
    parts_config JSON,                        -- JSON array of parts
    file_path VARCHAR(255),                   -- Path to JSON file on disk
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
);

-- Papers (Generated question papers)
CREATE TABLE papers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    blueprint_id INT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    format VARCHAR(10),                       -- "PDF" or "DOCX"
    total_marks DECIMAL(6,2),
    questions JSON,                           -- Array of question IDs
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (blueprint_id) REFERENCES blueprints(id)
);

-- Question Images
CREATE TABLE question_images (
    id INT PRIMARY KEY AUTO_INCREMENT,
    question_id INT NOT NULL,
    image_id INT,                             -- References images table
    image_path VARCHAR(255),                  -- File path on disk
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- Images (Extracted from PDFs)
CREATE TABLE images (
    id INT PRIMARY KEY AUTO_INCREMENT,
    image_blob LONGBLOB NOT NULL,             -- PNG/JPG binary data
    keywords TEXT,                            -- Searchable keywords
    description TEXT,                         -- Image description
    source_type VARCHAR(50),                  -- "pdf_extraction" or "web_search"
    file_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Submissions (Student answer sheets)
CREATE TABLE submissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    paper_id INT NOT NULL,
    student_id INT,                           -- Student identifier
    student_name VARCHAR(255),
    submission_file VARCHAR(255),             -- Path to uploaded file
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paper_id) REFERENCES papers(id)
);

-- Evaluations (Grading results)
CREATE TABLE evaluations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    submission_id INT NOT NULL,
    total_score DECIMAL(6,2),
    max_score DECIMAL(6,2),
    percentage DECIMAL(5,2),
    grade VARCHAR(2),                        -- "A+", "A", "B", etc.
    feedback TEXT,                           -- Overall feedback
    graded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (submission_id) REFERENCES submissions(id)
);

-- Evaluation Details (Question-wise scores)
CREATE TABLE evaluation_feedback (
    id INT PRIMARY KEY AUTO_INCREMENT,
    evaluation_id INT NOT NULL,
    question_id INT NOT NULL,
    score DECIMAL(6,2),
    feedback TEXT,
    FOREIGN KEY (evaluation_id) REFERENCES evaluations(id),
    FOREIGN KEY (question_id) REFERENCES questions(id)
);
```

---

## API Architecture

### Main.py - Endpoints Summary

**main.py** contains FastAPI route handlers organized by feature:

```python
# Subject Management
POST   /api/subjects/create              Create new subject
GET    /api/subjects                     List all subjects
GET    /api/subjects/{subject_id}        Get subject details

# Question Banks
POST   /api/question-banks/create        Create question bank
GET    /api/question-banks               List banks
POST   /api/questions/create             Add question to bank

# Blueprints
POST   /api/blueprints/create            Create paper blueprint
GET    /api/blueprints/{blueprint_id}    Retrieve blueprint
PUT    /api/blueprints/{blueprint_id}    Update blueprint
DELETE /api/blueprints/{blueprint_id}    Delete blueprint

# Question Generation
POST   /api/questions/generate           Generate questions via AI
GET    /api/questions/{question_id}      Get question details
GET    /api/questions/{question_id}/image Get question image (PNG blob)

# Paper Generation
POST   /api/papers/generate              Generate question paper
GET    /api/papers/{paper_id}            Download paper (PDF/DOCX)
GET    /api/papers                       List generated papers

# Document Upload & RAG
POST   /api/upload/syllabus              Upload curriculum document
POST   /api/upload/books                 Upload reference material
POST   /api/sync-qdrant                  Sync files to vector DB

# Answer Submission & Grading
POST   /api/submissions/upload           Upload student answers
POST   /api/submissions/{submission_id}/grade  Grade submission (automated)
GET    /api/evaluations/{submission_id}  Get grading results
GET    /api/evaluations/{submission_id}/report Download report

# Health
GET    /health                           API health check
GET    /docs                             Swagger API documentation
```

---

## Data Flow Diagrams

### Complete Request-Response Flow

```
User Request (Frontend)
    ↓
API Endpoint (main.py)
    ├─ Parse request body (Pydantic validation)
    ├─ Extract parameters
    └─ Call service function
    ↓
Service Layer (services/*.py)
    ├─ Business logic execution
    ├─ Database queries (core/database.py)
    ├─ External service calls (Qdrant, Ollama, LLM APIs)
    ├─ File I/O (uploads, PDF generation)
    └─ Error handling & logging
    ↓
Data Layer
    ├─ MySQL (relational data)
    ├─ Qdrant (vector embeddings)
    ├─ File System (documents, images, PDFs)
    └─ Return data
    ↓
Service Response
    ├─ Format result
    ├─ Create response body (JSON / File)
    └─ Return to API
    ↓
API Response
    ├─ HTTP status code
    ├─ Response body (JSON or File)
    └─ Send to frontend
    ↓
Frontend
    ├─ Receive response
    ├─ Update UI
    └─ Display to user
```

---

## Best Practices & Patterns

### 1. Error Handling Pattern
```python
try:
    result = perform_operation()
    return {"success": True, "data": result}
except SpecificException as e:
    logger.error(f"Operation failed: {e}")
    return {"success": False, "error": str(e)}
except Exception as e:
    logger.error(f"Unexpected error: {e}", exc_info=True)
    raise HTTPException(status_code=500, detail="Internal server error")
```

### 2. Logging Pattern
```python
from services.rag_config import logger

logger.info(f"Processing document: {file_path}")
logger.warning(f"Image not found for question {question_id}")
logger.error(f"Database connection failed: {error}")
```

### 3. Database Query Pattern
```python
connection = get_db_connection()
cursor = get_cursor(connection)
placeholder = get_placeholder()

query = f"INSERT INTO table (col1, col2) VALUES ({placeholder}, {placeholder})"
cursor.execute(query, (value1, value2))
connection.commit()
cursor.close()
connection.close()
```

### 4. File Handling Pattern
```python
from pathlib import Path

UPLOAD_DIR = Path(__file__).resolve().parent / "data" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

file_path = UPLOAD_DIR / "syllabus" / safe_filename
file_path.write_bytes(file_content)
```

---

## Performance Optimization Tips

1. **RAG Queries**: Cache frequently accessed documents
2. **LLM Calls**: Implement request queuing to avoid overwhelming Ollama
3. **Image Processing**: Use compression for PDFs with many images
4. **Database**: Add indexes on frequently queried columns (difficulty, subject_id)
5. **Embeddings**: Batch encode multiple texts for faster processing

---

## Troubleshooting Guide

| Issue | Service | Solution |
|-------|---------|----------|
| "Connection refused" to MySQL | database.py | Check DB_HOST, DB_PORT in .env |
| Ollama timeout | question_generator.py | Increase timeout or use cloud LLM |
| Black images in paper | image_extractor.py | Brightness correction applied auto |
| Rotated images | image_extractor.py | detect_and_fix_rotation() handles |
| No context in questions | rag_retrieval.py | Ensure documents ingested in Qdrant |
| Paper generation slow | paper_generator.py | Check image count, optimize DPI |

---

**Version**: 1.0  
**Last Updated**: May 2026  
**Maintained By**: Development Team  
**Next Review**: August 2026
