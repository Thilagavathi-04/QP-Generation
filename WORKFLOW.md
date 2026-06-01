# Quest Generator - Application Workflow

**Last Updated:** May 2026  
**Version:** 1.0

---

## Table of Contents
1. [Quick Overview](#quick-overview)
2. [User Workflows](#user-workflows)
3. [System Data Flow](#system-data-flow)
4. [Core Processes](#core-processes)
5. [Integration Points](#integration-points)
6. [Error Handling & Fallbacks](#error-handling--fallbacks)
7. [File & Data Management](#file--data-management)

---

## Quick Overview

Quest Generator is an **AI-powered exam generation and evaluation system** that automates the entire workflow from content management through question creation, paper generation, and answer evaluation.

### High-Level Flow
```
User Input (Content, Blueprints)
    ↓
RAG Ingestion & Vector Storage
    ↓
Question Generation (Hybrid LLM)
    ↓
Question Paper Assembly
    ↓
Distribution & Submission
    ↓
Automated Grading & Feedback
```

---

## User Workflows

### 1. Admin/Teacher Setup Workflow

#### Step 1: Initial System Configuration
- **User Role**: System Administrator / Teacher
- **Actions**:
  - Access Admin Dashboard (`/admin`)
  - Configure subjects and course outcomes
  - Set up evaluation parameters
- **Backend**: Database initialization (`core/database.py`)
- **Storage**: Configuration stored in MySQL

#### Step 2: Content Management
- **Upload educational materials** to specific directories:
  - **Syllabus**: `backend/data/uploads/syllabus/` (PDF/DOCX)
  - **Reference Books**: `backend/data/uploads/books/` (PDF/DOCX)
  - **Question Images**: Extracted automatically to `backend/data/uploads/question_images/`
- **Processing**:
  1. Document uploaded via API endpoint
  2. `services/image_extractor.py` extracts images from PDFs
  3. `services/rag_ingestion.py` chunks document and creates embeddings
  4. Embeddings stored in **Qdrant vector database**
  5. Text indexed for semantic search
- **Output**: Indexed knowledge base ready for question generation

**API Endpoints**:
- `POST /api/upload/syllabus` - Upload curriculum documents
- `POST /api/upload/books` - Upload reference materials
- `GET /api/uploads/` - List uploaded materials

---

### 2. Question Generation Workflow

#### Step 1: Create Blueprint
- **User**: Teacher/Admin
- **Actions**:
  1. Navigate to "Blueprint Management"
  2. Define blueprint structure:
     - **Subject**: Computer Science / Mathematics / etc.
     - **Total Questions**: 30
     - **Difficulty Distribution**: Easy (30%), Medium (40%), Hard (30%)
     - **Question Types**: MCQ, Short Answer, Essay
     - **Topics**: Data Structures, Algorithms, Database, etc.
  3. Save blueprint to `backend/data/uploads/blueprints/`

**Data Model** (Schema in `core/models.py`):
```
Blueprint:
  - id (PK)
  - name
  - subject
  - total_questions
  - difficulty_distribution (JSON)
  - question_types (JSON)
  - topics (JSON)
  - created_at
```

**API Endpoint**:
- `POST /api/blueprints/create` - Create new blueprint
- `GET /api/blueprints/{id}` - Retrieve blueprint

#### Step 2: Generate Questions
- **User**: Teacher clicks "Generate Questions"
- **Process Flow**:

1. **Request Preparation** (`main.py` - question generation endpoint)
   - Input: Blueprint ID + optional context
   - Retrieve blueprint configuration
   - Query RAG system for relevant context

2. **RAG Retrieval** (`services/rag_retrieval.py`)
   - Query: Extract topic keywords from blueprint
   - Search vector database (Qdrant) for similar content
   - Return top-K relevant document chunks
   - **Algorithm**: Semantic similarity matching using `all-MiniLM-L6-v2` embeddings

3. **Question Generation** (`services/question_generator.py`)
   - **Hybrid LLM Mode**:
     1. **Try Ollama First** (Local, offline):
        - Connect to `http://ollama:11434` (Docker container)
        - Model: `mistral:latest`
        - Generate prompt with context + blueprint parameters
        - Timeout: 30 seconds
     
     2. **Fallback to Cloud APIs** (If Ollama fails):
        - **xAI API** (Primary fallback) - `services/image_web_search.py`
        - **OpenAI API** (Secondary fallback)
        - **Google Gemini** (Tertiary fallback)
        - Select based on `LLM_PROVIDER` env variable
   
   - **Prompt Structure**:
     ```
     Context: [RAG-retrieved educational material]
     
     Generate {count} {question_type} questions about {topics}
     Difficulty: {difficulty_level}
     Format: JSON array with fields [id, question, options, answer, explanation]
     ```

4. **Response Validation** (`services/question_generator.py`)
   - Parse JSON response
   - Validate fields: question, options, correct_answer, explanation
   - Deduplicate similar questions (cosine similarity > 0.9)
   - Store in MySQL `questions` table

5. **Image Attachment** (If applicable)
   - Search for relevant images from `backend/data/uploads/question_images/`
   - Use `services/image_integration.py` for image matching
   - Associate images with questions via foreign key

**Database Tables**:
- `questions`: Core question data
- `question_options`: MCQ options
- `question_images`: Associated images

**API Endpoints**:
- `POST /api/questions/generate` - Generate questions
- `GET /api/questions/{id}` - Retrieve question with image
- `GET /api/questions/{id}/image` - Get question image (PNG blob)

---

### 3. Question Paper Generation Workflow

#### Step 1: Create Paper from Blueprint
- **User**: Teacher navigates to "Question Paper Generation"
- **Input**: 
  - Blueprint ID
  - Number of papers to generate
  - Custom instructions (e.g., "Answer any 5 questions")

#### Step 2: Assemble Paper
- **Process** (`services/paper_generator.py`):

1. **Question Selection**:
   - Retrieve blueprint specifications (difficulty, count, types)
   - Query `questions` table filtered by specification
   - **Deduplication Logic** (Critical):
     - Track `used_image_ids` throughout paper generation
     - Each question's image used only once
     - Prevents duplicate images across papers
     - Path: `services/paper_generator.py` - image tracking mechanism

2. **Paper Assembly**:
   - Arrange questions in order (by difficulty or random)
   - Add header with: Subject, Date, Duration, Total Marks
   - Apply custom instructions
   - Assign unique paper ID

3. **Document Generation**:
   - **Output Formats**: PDF + DOCX
   - **Tools**: 
     - `python-docx` - Generate DOCX
     - `python-pptx` / `reportlab` - Generate PDF
   - **Image Handling**:
     - Retrieve images for each question
     - Apply brightness correction if needed (dark/light extremes)
     - Use `services/image_extractor.py:fix_extreme_brightness_image()`
     - Embed images in document at 72 DPI, 6cm width

4. **Save Paper**:
   - Store paper file to `backend/data/uploads/papers/{paper_id}.pdf`
   - Record metadata in MySQL:
     - Paper ID, Blueprint ID, Generation timestamp, Questions included
   - Return file path to frontend

**Database Table**:
- `papers`: Paper metadata (id, blueprint_id, filename, created_at, questions[])

**API Endpoints**:
- `POST /api/papers/generate` - Generate question paper
- `GET /api/papers/{id}` - Download paper
- `GET /api/papers/` - List generated papers

**Output Example**:
```
Question Paper - Computer Science (CS-101)
Duration: 3 hours | Total Marks: 100

SECTION A: Multiple Choice (10 Questions × 1 mark = 10 marks)
1. What is the time complexity of binary search?
   [A] O(n)  [B] O(log n)  [C] O(n²)  [D] O(1)

SECTION B: Short Answer (5 Questions × 5 marks = 25 marks)
6. Explain the concept of polymorphism in OOP...

SECTION C: Essay (2 Questions × 20 marks = 40 marks)
11. Design a database schema for a library management system...
```

---

### 4. Answer Submission & Grading Workflow

#### Step 1: Student Submits Answers
- **User Role**: Student
- **Actions**:
  1. Download/receive question paper (PDF)
  2. Answer questions on provided answer sheet or upload digital submission
  3. Upload file to `backend/data/uploads/student_submissions/`

#### Step 2: Automated Grading
- **Process** (`services/grading_engine.py`):

1. **Parse Submission**:
   - Extract student answers from PDF/image/text
   - Use OCR if needed (via `image_extractor.py`)
   - Store submission metadata in MySQL

2. **Grade Evaluation**:
   - **MCQ Grading** (Automatic):
     - Compare student option with answer key
     - Assign full marks if correct, 0 if wrong
   - **Short Answer Grading** (Hybrid AI):
     - Use LLM (Ollama/Cloud) to evaluate answer quality
     - Compare against model answer
     - Generate rubric-based score (0-100%)
     - Provide feedback comments
   - **Essay Grading** (Hybrid AI):
     - Evaluate comprehension, structure, completeness
     - Cross-reference with learning objectives
     - Generate detailed feedback

3. **Score Calculation**:
   - Sum marks from all sections
   - Calculate percentage: `(total_marks / max_marks) × 100`
   - Assign grade band (A+, A, B, etc.) based on institution scale

4. **Generate Report**:
   - Create evaluation sheet with:
     - Student name, ID, subject
     - Question-wise scores
     - Total score and percentage
     - Feedback comments
     - Performance analytics (strengths/weaknesses)
   - Save to MySQL `evaluations` table

**Database Tables**:
- `submissions`: Student answer files
- `evaluations`: Grading results
- `evaluation_feedback`: Detailed feedback per question

**API Endpoints**:
- `POST /api/submissions/upload` - Upload answer sheet
- `POST /api/submissions/{id}/grade` - Grade submission (automated)
- `GET /api/evaluations/{submission_id}` - Get grading results
- `GET /api/evaluations/{submission_id}/report` - Download evaluation report

**Output Example**:
```
EVALUATION REPORT
Student: John Doe (ID: 2024001)
Subject: Computer Science
Date: 20 May 2026

Question-wise Analysis:
Q1: ✓ Correct (1/1 mark)
Q2: ✓ Correct (1/1 mark)
...
Q25: ✗ Partially Correct (3/5 marks)

Total Score: 78/100 (78%)
Grade: B+

Feedback:
- Strong understanding of data structures
- Needs improvement in algorithm complexity analysis
- Good practical examples in essay section
```

---

## System Data Flow

### End-to-End Data Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER INPUT LAYER (Frontend)                   │
│  Admin Dashboard | Teacher Portal | Student Interface            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   ┌─────────┐        ┌─────────┐      ┌──────────┐
   │ Upload  │        │ Create  │      │ Submit   │
   │ Content │        │Blueprint│      │ Answers  │
   └────┬────┘        └────┬────┘      └────┬─────┘
        │                  │                 │
        └──────────────────┼─────────────────┘
                           │
        ┌──────────────────▼──────────────────┐
        │    FastAPI Backend (main.py)         │
        │  Route Handlers & Validation         │
        └──────────────────┬──────────────────┘
                           │
        ┌──────────────────┴──────────────────┐
        │                                     │
        ▼                                     ▼
   ┌──────────────┐                 ┌──────────────────┐
   │  RAG Pipeline│                 │ Question Gen     │
   │              │                 │ & Paper Gen      │
   ├──────────────┤                 ├──────────────────┤
   │1. Document  │                 │1. Query Qdrant   │
   │   Upload    │                 │   (RAG)          │
   │2. Extract   │                 │2. Call LLM       │
   │   Images    │                 │   (Ollama/Cloud) │
   │3. Split     │                 │3. Generate       │
   │   Chunks    │                 │   Questions      │
   │4. Embed     │                 │4. Deduplicate    │
   │   (ST)      │                 │5. Format Paper   │
   │5. Store in  │                 └──────────────────┘
   │   Qdrant    │
   └──────┬───────┘
          │
        ┌─┴─────────────────────────┬─────────────────┐
        │                           │                 │
        ▼                           ▼                 ▼
   ┌─────────┐              ┌──────────────┐    ┌──────────┐
   │ Qdrant  │              │  MySQL DB    │    │ File Sys │
   │ Vectors │              │              │    │          │
   │         │              ├──────────────┤    ├──────────┤
   │ - RAG   │              │- Blueprints  │    │- Papers  │
   │  Data   │              │- Questions   │    │- Uploads │
   │  Store  │              │- Papers      │    │- Images  │
   │         │              │- Submissions │    │- Logs    │
   └─────────┘              │- Evaluations │    └──────────┘
                            └──────────────┘
        │                           │
        └─────────────┬─────────────┘
                      │
        ┌─────────────▼──────────────┐
        │  Processing Services       │
        │  (Async / Scheduled)       │
        ├────────────────────────────┤
        │- Grading Engine            │
        │- Image Processing          │
        │- RAG Chunking              │
        │- Deduplication             │
        └─────────────┬──────────────┘
                      │
        ┌─────────────▼──────────────┐
        │   Response to Frontend     │
        │   (JSON/Files)             │
        └────────────────────────────┘
```

### Storage Architecture

```
backend/data/uploads/
├── syllabus/               # RAG source documents
│   ├── CS101_syllabus.pdf
│   └── DSA_course.docx
├── books/                  # Reference material
│   ├── CLRS_Algorithms.pdf
│   └── DB_Design.pdf
├── blueprints/            # Question paper templates
│   ├── blueprint_001.json
│   └── blueprint_002.json
├── papers/                # Generated exam papers
│   ├── paper_001.pdf
│   ├── paper_001.docx
│   └── paper_002.pdf
├── student_submissions/   # Student answers
│   ├── submission_001.pdf
│   └── submission_002.pdf
└── question_images/       # Extracted/processed images
    ├── img_001.png
    └── img_002.png

mysql_data/               # MySQL data persistence
├── quest_generator/      # Application database
│   ├── blueprints table
│   ├── questions table
│   ├── papers table
│   ├── submissions table
│   └── evaluations table

qdrant_storage/          # Vector database
└── collections/
    └── quest_generator_rag/   # RAG embeddings
        └── vector_data.bin
```

---

## Core Processes

### Process 1: RAG Ingestion Pipeline

**Trigger**: User uploads document  
**Components**: `image_extractor.py`, `rag_chunker.py`, `rag_ingestion.py`, Qdrant

**Sequence**:
1. Document received at `/api/upload/syllabus` or `/api/upload/books`
2. Save to `backend/data/uploads/{syllabus|books}/` with unique ID
3. Detect file type (PDF/DOCX)
4. **Extract Text**:
   - PDF: Use PyPDF2 / pdfplumber
   - DOCX: Use python-docx
5. **Extract Images** (`image_extractor.py`):
   - Save images individually
   - Apply rotation detection (`detect_and_fix_rotation()`):
     - If aspect ratio < 0.35 and height > 400px → rotate 90°
   - Apply brightness correction (`fix_extreme_brightness_image()`):
     - If brightness > 0.9 or < 0.1 → invert
   - Store to `backend/data/uploads/question_images/`
6. **Chunk Text** (`rag_chunker.py`):
   - Split text into overlapping chunks (500-1000 tokens)
   - Preserve context with 100-token overlap
7. **Generate Embeddings** (`rag_ingestion.py`):
   - Use `SentenceTransformer("all-MiniLM-L6-v2")`
   - One embedding per chunk
8. **Store in Qdrant**:
   - Collection: `quest_generator_rag`
   - Fields: chunk_id, text, embedding, source_doc_id
9. **Index Metadata**:
   - Record in MySQL for document tracking
10. **Return Success** to frontend

**Time Complexity**: O(n) where n = document size

---

### Process 2: Question Generation Pipeline

**Trigger**: User clicks "Generate Questions"  
**Components**: `question_generator.py`, `rag_retrieval.py`, Ollama/Cloud LLM

**Sequence**:

1. **Extract Blueprint Parameters**:
   - Count, difficulty distribution, question types, topics
   - Example: 30 questions, 30% easy, 40% medium, 30% hard

2. **Query RAG** (`rag_retrieval.py`):
   ```
   Query: Extract top keywords from blueprint topics
          → "data structures", "algorithms", "sorting"
   
   Search Qdrant Collection: quest_generator_rag
   Find: Chunks with highest semantic similarity
   Return: Top 5 chunks with highest score
   ```

3. **Prepare LLM Prompt**:
   ```
   System: "You are an education expert. Generate exam questions based on context."
   
   Context: [RAG-retrieved top 5 chunks]
   
   Task: Generate exactly 10 {question_type} questions about {topics}
         Difficulty level: {difficulty}
         Format: JSON array [{id, question, options[], answer, explanation}]
   ```

4. **Call Hybrid LLM** (`question_generator.py`):
   ```python
   try:
       response = ollama_client.generate(
           model="mistral:latest",
           prompt=prompt,
           timeout=30
       )
   except (ConnectionError, TimeoutError, Exception):
       response = call_cloud_api(
           provider=os.getenv("LLM_PROVIDER", "xai"),
           prompt=prompt
       )
   ```

5. **Parse & Validate**:
   - Extract JSON from response
   - Validate structure: question, options, answer, explanation
   - Check duplicate ratio (cosine similarity > 0.9) → skip if duplicate

6. **Deduplicate Images**:
   - Track `used_image_ids` set across all questions
   - Each image ID used maximum once
   - Prevents same image reappearing in different questions

7. **Store in Database**:
   ```
   INSERT INTO questions (blueprint_id, question_text, options, correct_answer, difficulty)
   INSERT INTO question_options (question_id, option_text, is_correct)
   INSERT INTO question_images (question_id, image_id)
   ```

8. **Return to Frontend**:
   - List of generated question objects with metadata
   - Preview images from `/api/questions/{id}/image` endpoint

---

### Process 3: Paper Generation Pipeline

**Trigger**: Teacher selects "Generate Paper"  
**Components**: `paper_generator.py`, Image/PDF services

**Sequence**:

1. **Retrieve Blueprint**:
   - Load blueprint configuration from MySQL

2. **Select Questions**:
   ```
   Total required: 30
   Easy (30%): 9 questions
   Medium (40%): 12 questions
   Hard (30%): 9 questions
   
   Query: SELECT * FROM questions 
          WHERE blueprint_id = X 
          AND difficulty IN ('easy','medium','hard')
          ORDER BY RANDOM()
          LIMIT 30
   ```

3. **Assign to Sections**:
   ```
   Section A (MCQ): 15 questions × 1 mark = 15 marks
   Section B (Short): 10 questions × 5 marks = 50 marks
   Section C (Essay): 5 questions × 7 marks = 35 marks
   Total: 100 marks
   ```

4. **Build Document**:
   - Create DOCX using `python-docx`
   - Add header: Subject, Date, Duration, Total Marks
   - Add instructions: "Answer any 5 questions in section C"
   - For each question:
     ```
     4. Which of the following is a sorting algorithm?
        [A] TCP
        [B] Quick Sort
        [C] HTTP
        [D] REST
        
        [IF IMAGE EXISTS]
        └─ Retrieve image ID from question_images
           Apply brightness fix
           Embed image at 6cm width
     ```

5. **Image Deduplication** (Critical Step):
   ```python
   used_image_ids = set()
   for question in questions:
       if question.image_id:
           if question.image_id not in used_image_ids:
               # Add image to document
               used_image_ids.add(question.image_id)
           else:
               # Skip image, use question text only
               pass
   ```

6. **Export Document**:
   - Save to DOCX: `backend/data/uploads/papers/paper_{id}.docx`
   - Convert to PDF: `backend/data/uploads/papers/paper_{id}.pdf`

7. **Record Metadata**:
   ```
   INSERT INTO papers (blueprint_id, filename, questions, created_at)
   VALUES (blueprint_id, 'paper_{id}.pdf', [q1,q2,q3...], NOW())
   ```

8. **Return File**:
   - Send PDF file to frontend for download
   - Provide confirmation with paper ID

---

### Process 4: Grading Pipeline

**Trigger**: Student submits answer sheet  
**Components**: `grading_engine.py`, LLM (for content-based grading)

**Sequence**:

1. **Receive Submission**:
   - Student uploads file (PDF/image)
   - Store to `backend/data/uploads/student_submissions/`
   - Record in MySQL `submissions` table

2. **Parse Answers**:
   - If PDF: Extract text using PyPDF2
   - If image: Use OCR (Tesseract or pytesseract)
   - Build answer dictionary: {question_id → student_answer}

3. **Grade Each Question**:

   **For MCQ**:
   ```
   question_1_answer = "B" (student)
   correct_answer = "B" (key)
   → score = 1 mark (correct)
   
   question_2_answer = "A" (student)
   correct_answer = "C" (key)
   → score = 0 marks (incorrect)
   ```

   **For Short Answer**:
   ```
   Compare student answer with model answer using LLM:
   
   Prompt: "Grade this answer. Expected: {model_answer}. 
            Student gave: {student_answer}. 
            Scale: 0-5 marks."
   
   Expected response: {score: 3, feedback: "Good explanation but missing..."}
   ```

   **For Essay**:
   ```
   Evaluate on rubric:
   - Structure (25%): Proper intro, body, conclusion
   - Content (50%): Accuracy, completeness, examples
   - Language (25%): Clarity, grammar, terminology
   
   LLM generates: {structure: 20/25, content: 35/50, language: 22/25}
   Total: 77/100 → 77 marks (if max is 100)
   ```

4. **Calculate Total**:
   ```
   Section A: 12/15 marks
   Section B: 38/50 marks
   Section C: 22/35 marks
   ─────────────────────
   Total: 72/100 marks = 72%
   Grade: B (assuming 70-79% = B)
   ```

5. **Generate Report**:
   ```
   Create evaluation sheet:
   - Student name, ID, date
   - Question-by-question scores
   - Section-wise summary
   - Total score and grade
   - Feedback comments
   - Strengths and areas for improvement
   ```

6. **Store Results**:
   ```
   INSERT INTO evaluations (submission_id, total_score, percentage, grade, feedback)
   INSERT INTO evaluation_feedback (question_id, score, feedback)
   ```

7. **Notify Student**:
   - Send results via UI / Email
   - Provide download link for detailed report

---

## Integration Points

### Frontend ↔ Backend API Contract

| Feature | Method | Endpoint | Input | Output |
|---------|--------|----------|-------|--------|
| Upload Syllabus | POST | `/api/upload/syllabus` | File, Subject ID | {success, document_id, chunks_count} |
| Create Blueprint | POST | `/api/blueprints/create` | Blueprint JSON | {success, blueprint_id} |
| Generate Questions | POST | `/api/questions/generate` | Blueprint ID | {success, questions[], generation_time} |
| Get Question Image | GET | `/api/questions/{id}/image` | Question ID | PNG blob | 
| Generate Paper | POST | `/api/papers/generate` | Blueprint ID, Format | File (PDF/DOCX) |
| Submit Answers | POST | `/api/submissions/upload` | File, Paper ID | {success, submission_id} |
| Grade Submission | POST | `/api/submissions/{id}/grade` | Submission ID | {success, scores, feedback} |
| Get Evaluation | GET | `/api/evaluations/{submission_id}` | Submission ID | Evaluation JSON |

### External Service Integration

1. **Ollama** (Local LLM):
   - URL: `http://ollama:11434`
   - Model: `mistral:latest`
   - Fallback on timeout (30s)

2. **Qdrant** (Vector DB):
   - URL: `http://qdrant:6333`
   - Collection: `quest_generator_rag`
   - Operation: Semantic search, embedding storage

3. **MySQL** (Relational DB):
   - Host: `mysql` (Docker) / `localhost` (local)
   - Port: 3306
   - Database: `quest_generator`
   - Driver: `mysql-connector-python`

4. **Cloud LLM APIs** (Fallback):
   - xAI, OpenAI, or Google Gemini
   - Selected via `LLM_PROVIDER` environment variable

---

## Error Handling & Fallbacks

### Error Scenario 1: Ollama Unavailable
```
Question Generation Request
    ↓
[Call Ollama @ localhost:11434]
    ↓
[Exception: Connection refused / Timeout]
    ↓
[Fallback: Call cloud LLM (xAI/OpenAI)]
    ↓
[Success or Fail notification to user]
```

### Error Scenario 2: Image Extraction Fails
```
Document Upload
    ↓
[Extract images from PDF]
    ↓
[Exception: Corrupted PDF / Invalid format]
    ↓
[Log error, continue with text only]
    ↓
[Question generation proceeds without images]
    ↓
[User notified: "Document processed, some images skipped"]
```

### Error Scenario 3: Grading Unavailable
```
Submission Grading Request
    ↓
[Short Answer: Try LLM grading]
    ↓
[Exception: LLM timeout / Error]
    ↓
[Fallback: Manual grading mode]
    ↓
[Mark as pending, notify teacher]
    ↓
[Teacher grades manually via UI]
```

---

## File & Data Management

### Canonical Paths

| Component | Usage | Path | Persistence |
|-----------|-------|------|-------------|
| Syllabus | RAG source | `backend/data/uploads/syllabus/` | Until manually deleted |
| Books | RAG source | `backend/data/uploads/books/` | Until manually deleted |
| Blueprints | Paper templates | `backend/data/uploads/blueprints/` | Until manually deleted |
| Papers | Generated exams | `backend/data/uploads/papers/` | Until manually deleted |
| Submissions | Student answers | `backend/data/uploads/student_submissions/` | Until manually deleted |
| Q. Images | Extracted/processed | `backend/data/uploads/question_images/` | Until manually deleted |
| MySQL Data | Relational DB | `mysql_data/` | Persistent (critical!) |
| Qdrant Data | Vector DB | `qdrant_storage/` | Persistent (critical!) |

### Database Schema Overview

```
┌─ blueprints
│   ├─ id (PK)
│   ├─ name
│   ├─ subject
│   ├─ total_questions
│   ├─ difficulty_distribution (JSON)
│   └─ question_types (JSON)
│
├─ questions
│   ├─ id (PK)
│   ├─ blueprint_id (FK)
│   ├─ question_text
│   ├─ difficulty
│   ├─ question_type
│   └─ explanation
│
├─ question_options
│   ├─ id (PK)
│   ├─ question_id (FK)
│   ├─ option_text
│   └─ is_correct
│
├─ question_images
│   ├─ id (PK)
│   ├─ question_id (FK)
│   ├─ image_path
│   └─ image_id
│
├─ papers
│   ├─ id (PK)
│   ├─ blueprint_id (FK)
│   ├─ filename
│   ├─ paper_format (PDF/DOCX)
│   ├─ total_marks
│   ├─ questions (JSON array of question IDs)
│   └─ created_at
│
├─ submissions
│   ├─ id (PK)
│   ├─ paper_id (FK)
│   ├─ student_id (FK)
│   ├─ submission_file
│   └─ submitted_at
│
└─ evaluations
    ├─ id (PK)
    ├─ submission_id (FK)
    ├─ total_score
    ├─ percentage
    ├─ grade
    ├─ feedback (TEXT)
    └─ graded_at
```

---

## Key Features & Capabilities

### Quality Assurance
- **Question Deduplication**: Semantic similarity check (cosine > 0.9)
- **Image Deduplication**: Tracked across entire paper generation
- **Image Quality**: Automatic rotation + brightness correction
- **RAG Grounding**: All questions based on indexed educational material

### AI/ML Integration
- **Hybrid LLM**: Local (Ollama) + Cloud fallback
- **Semantic Search**: Sentence Transformers (all-MiniLM-L6-v2)
- **Intelligent Grading**: LLM-powered rubric evaluation
- **Context Awareness**: RAG-enhanced question generation

### System Reliability
- **Graceful Fallbacks**: Service failures don't crash system
- **Error Logging**: Comprehensive logging in `backend/logs/`
- **Data Persistence**: MySQL + Qdrant persist across restarts
- **API Documentation**: Auto-generated Swagger at `/docs`

---

## Performance Metrics

| Operation | Typical Duration | Bottleneck |
|-----------|------------------|-----------|
| Document Upload + RAG Ingestion | 30-60s | PDF parsing + embeddings |
| Question Generation (10 questions) | 15-45s | LLM inference time |
| Paper Generation (30 questions) | 20-60s | Document rendering + image embedding |
| Submission Grading (Full paper) | 60-180s | Essay LLM evaluation |
| Semantic search (RAG query) | 0.5-2s | Vector DB query |

---

## Security & Privacy

- **Local Processing**: Option to use Ollama for offline operation
- **Data Isolation**: Separate upload directories per component
- **Access Control**: Blueprint and evaluation access controlled via user roles
- **File Permissions**: Uploads scoped to `backend/data/uploads/`
- **No External Logging**: All logs local to `backend/logs/`

---

## Future Extensibility

- **Batch Operations**: Grade multiple papers in parallel
- **Analytics Dashboard**: Student performance trends
- **Custom Rubrics**: Configurable grading templates
- **Multi-language**: I18n support for questions
- **Mobile App**: Native iOS/Android for submissions
- **Plugin System**: Custom LLM providers

---

## Appendix: Running the Workflow End-to-End

### Quick Command Reference

```bash
# Start entire stack
docker-compose up -d

# Upload documents
curl -X POST http://localhost:8010/api/upload/syllabus \
  -F "file=@curriculum.pdf"

# Create blueprint
curl -X POST http://localhost:8010/api/blueprints/create \
  -H "Content-Type: application/json" \
  -d '{"name":"CS-101","total_questions":30}'

# Generate questions
curl -X POST http://localhost:8010/api/questions/generate \
  -H "Content-Type: application/json" \
  -d '{"blueprint_id":1}'

# Generate paper
curl -X POST http://localhost:8010/api/papers/generate \
  -H "Content-Type: application/json" \
  -d '{"blueprint_id":1}' \
  --output paper.pdf

# Submit answers
curl -X POST http://localhost:8010/api/submissions/upload \
  -F "file=@answers.pdf" \
  -F "paper_id=1"

# Grade submission
curl -X POST http://localhost:8010/api/submissions/1/grade

# Get results
curl http://localhost:8010/api/evaluations/1
```

---

**Document Version**: 1.0  
**Last Updated**: May 2026  
**Maintained By**: Development Team  
**Next Review**: August 2026
