# Quest Generator

**An AI-powered exam generation and evaluation system with RAG-grounded question generation, hybrid LLM support, and automated answer evaluation.**

---

## Quick Navigation for Learners
- **New to the project?** Start with [Project Overview](#1-project-overview) → [System Architecture](#architecture-flow) → [Backend Services](#10-backend-services)
- **Want to run it?** Jump to [Quick Start](#3-quick-start-docker-compose)
- **Need to understand a specific service?** Check [Backend Services](#10-backend-services)
- **Preparing for an interview?** Read [Key Architectural Decisions](#key-architectural-decisions), [How Components Work Together](#how-components-work-together), and [Interview Talking Points](#interview-talking-points)

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Quick Start (Docker Compose)](#3-quick-start-docker-compose)
4. [Prerequisites](#4-prerequisites)
5. [Manual Infrastructure Setup](#5-manual-infrastructure-setup)
6. [Backend Setup](#6-backend-setup)
7. [Frontend Setup](#7-frontend-setup)
8. [Running the Application](#8-running-the-application)
9. [API Reference](#9-api-reference)
10. [Backend Services](#10-backend-services)
11. [Data & Storage](#11-data--storage)
12. [Environment Configuration](#12-environment-configuration)
13. [Recent Improvements](#13-recent-improvements)
14. [Troubleshooting](#14-troubleshooting)
15. [Project Structure](#15-project-structure)
16. [Deployment](#16-deployment)
17. [Testing](#17-testing)
18. [Development Notes](#18-development-notes)
19. [Interview Talking Points](#interview-talking-points)

---

## 1) Project Overview

### What Problem Does This Solve?

Creating high-quality exam papers is **labor-intensive** and **time-consuming**. Teachers must:
1. Manually write questions across different difficulty levels
2. Ensure variety and avoid duplicates
3. Extract relevant content from multiple sources
4. Grade student submissions consistently
5. Generate answer keys and model solutions

**Quest Generator** automates this end-to-end:
- **AI generates questions** from topics (with local/cloud LLM options)
- **RAG grounds generation** in actual syllabus/textbooks (semantic search)
- **Auto-deduplication** prevents duplicate images/questions in papers
- **Auto-grading** evaluates student answers with feedback
- **PDF processing** extracts images from documents with quality fixes

### Why This Architecture? (Key Design Philosophy)
- **Hybrid Approach**: Offline Ollama for privacy + cloud APIs for power → flexibility
- **Modular Services**: Each service (question gen, paper gen, RAG, grading, images) is independent → testable and scalable
- **Single Upload Location**: All files go to `backend/data/uploads/` → simplified file management
- **Docker-First**: Complete stack available via `docker-compose` → reproducibility
- **API-First**: All operations through REST endpoints → frontend agnostic

### Quest Generator is an AI-assisted exam workflow system that helps you:
- **Manage educational content** - Organize subjects, units, topics, and question banks
- **Generate intelligent questions** - Using hybrid AI mode (offline Ollama + online xAI/OpenAI/Gemini fallback)
- **Ground generation with context** - RAG (Retrieval-Augmented Generation) from uploaded syllabus/books
- **Build question papers** - Create exam papers from question blueprints with auto-deduplication
- **Generate & grade answers** - Automatic answer script generation and submission evaluation
- **Process documents** - Extract images and text from PDFs, with intelligent rotation/brightness correction

### Key Capabilities
- **Hybrid LLM Mode**: Falls back from Ollama (local, offline) to xAI/OpenAI/Gemini (cloud)
- **RAG Integration**: Semantic search across uploaded educational materials
- **Image Processing**: PDF image extraction with brightness correction and rotation detection
- **Paper Generation**: Automatic paper building with question deduplication
- **API-First Design**: RESTful API with Swagger documentation at `/docs`

---

## 2) Current stack (active)

### Backend
- FastAPI + Uvicorn
- MySQL (relational data)
- Qdrant (vector DB for RAG)
- SentenceTransformers (`all-MiniLM-L6-v2`) for embeddings
- Hybrid LLM: Ollama (`mistral:latest`) + xAI API fallback

### Frontend
- React + Vite

### Storage paths
- Uploads (single canonical location): `backend/data/uploads/`
  - `backend/data/uploads/blueprints/` - Question paper blueprints
  - `backend/data/uploads/books/` - Reference books (for RAG)
  - `backend/data/uploads/papers/` - Generated question papers
  - `backend/data/uploads/student_submissions/` - Student answer submissions
  - `backend/data/uploads/syllabus/` - Syllabus documents (for RAG)
  - `backend/data/uploads/question_images/` - Images extracted from documents
- MySQL persistent data (Docker bind mount): `mysql_data/`
- Qdrant local storage: `qdrant_storage/`

---

## Architecture Flow

### How Data Flows Through the System

```
User Uploads Syllabus (PDF)
    ↓
DocumentProcessor extracts text + images
    ↓
[Branch 1: Embedding & Search]  [Branch 2: Question Generation]
    ↓                                  ↓
RAG Retrieval indexes chunks      Question Generator receives topic
in Qdrant (semantic search)        + retrieves RAG context
    ↓                                  ↓
       ← AI Provider (Ollama/APIs) →
           Generates questions
    ↓
Questions stored in MySQL with image_paths
    ↓
Paper Generator selects questions (deduplicates images)
    ↓
Student solves paper → Submission
    ↓
Grading Engine auto-evaluates vs answer keys
    ↓
Results stored in MySQL with feedback
```

### Component Interaction Diagram

| Component | Responsibility | Talks To | Input | Output |
|-----------|-----------------|----------|-------|--------|
| **DocumentProcessor** | Validate & process uploads | FS, MySQL | PDF/DOCX files | Text chunks, image files |
| **RAG Retrieval** | Semantic search | Qdrant, SentenceTransformers | Query text, documents | Ranked relevant chunks |
| **Question Generator** | AI question creation | AI providers (Ollama/xAI/OpenAI), RAG | Topic, num_questions, context | Questions with options/answers |
| **Image Integration** | Extract/fix images | PIL, PDF libs, FS | PDF files | Corrected PNG images |
| **Paper Generator** | Build papers from blueprints | MySQL, FS | Blueprint config, questions | PDF/DOCX files |
| **Grading Engine** | Auto-evaluate submissions | AI providers, MySQL | Student answers, answer keys | Scores, feedback, results |

---

## How Components Work Together (End-to-End Example)

### Scenario: Teacher Creates a Physics Exam Paper

**Step 1: Upload Syllabus (Document Upload)**
```
Teacher uploads "Physics_11th_Grade.pdf"
    ↓ DocumentProcessor.process_uploaded_file()
    ├─ Validates file (PDF, size < 100MB)
    ├─ Extracts text → chunks of 500 chars
    ├─ Extracts images → PNG files
    └─ Saves to backend/data/uploads/syllabus/

Step 2: Index in RAG (Semantic Search)**
RAG Retrieval Service:
    ├─ Chunks text into semantic pieces
    ├─ Embeds using SentenceTransformers ("all-MiniLM-L6-v2")
    ├─ Stores in Qdrant collection: quest_generator_rag
    └─ Now searchable by semantic similarity

Step 3: Generate Questions (AI Generation)**
Frontend calls: POST /api/questions/generate?topic=Newton's_Laws&num=5
    ↓ Question Generator receives request
    ├─ Searches RAG: "Newton's Laws" → retrieves 3 relevant chunks
    ├─ Checks AI_MODE → tries Ollama first (fast, local)
    ├─ If Ollama busy/down → falls back to xAI (cloud)
    ├─ Sends prompt: "Create 5 MCQ on {topic} using {context}"
    ├─ AI returns: questions, options, answers
    ├─ Image trigger: detects keywords like "diagram", "force"
    ├─ Calls image_service to find relevant images
    └─ Saves to MySQL with image_paths

Step 4: Build Paper (Paper Generation)**
Teacher creates blueprint:
    ├─ Select topics covered
    ├─ Define question distribution (2 easy, 2 medium, 1 hard)
    └─ Set max questions = 10

Paper Generator:
    ├─ Queries MySQL: get all questions matching topics
    ├─ Selects 10 questions, tracking used_image_ids
    ├─ De-duplication: if Q1 uses image_123, skip other Qs using image_123
    ├─ Assembles DOCX with text + images
    ├─ Saves to backend/data/uploads/papers/
    └─ Creates printable PDF

Step 5: Student Submissions (Grading)**
Student submits answers via frontend:
    ├─ Saves to backend/data/uploads/student_submissions/
    └─ Calls POST /api/papers/{id}/submit

Grading Engine:
    ├─ Retrieves answer key from MySQL
    ├─ For each question:
    │   ├─ Compare student answer vs key
    │   ├─ If MCQ: auto-score
    │   └─ If essay: send to AI (LLM judges similarity)
    ├─ Generates feedback: "Good understanding of X, but missed Y"
    ├─ Calculates total score
    └─ Saves evaluation_results to MySQL

Step 6: Teacher Reviews Results**
Teacher views via frontend dashboard:
    ├─ Sees all submissions
    ├─ Reviews auto-generated feedback
    ├─ Can override scores if needed
    └─ Exports analytics (class average, difficulty analysis, etc.)
```

---

## Key Architectural Decisions

### 1. **Hybrid LLM Model (Ollama + Cloud APIs)**

**Problem:** Want offline capabilities + power when online.

**Solution:**
- Try Ollama first (fast, local, free, private data)
- If offline/busy → fallback to xAI/OpenAI/Gemini
- User can override via `ai_provider` query param

**Trade-offs:**
- ✅ Works offline (Ollama)
- ✅ Better results when online (GPT-4, Grok-2)  
- ✅ Cost-effective (Ollama is free)
- ❌ Requires Ollama setup overhead
- ❌ Ollama (Mistral) less powerful than GPT-4

**Code Location:** [backend/services/question_generator.py](backend/services/question_generator.py#L200)

### 2. **RAG for Grounded Generation**

**Problem:** Auto-generated questions are generic without context.

**Solution:**
- Index uploaded syllabus/books into Qdrant (vector DB)
- When generating: retrieve relevant chunks via semantic search
- Include as context in AI prompt

**Why Vector DB (Qdrant) vs SQL?**
- Semantic search: find *similar* concepts, not exact matches
- SQL: "WHERE topic = 'Newton'" (keyword match)
- Vectors: "Find content semantically related to 'Newton's force laws'" (semantic)
- Qdrant is fast, specialized, supports CRUD on embeddings

**Code Location:** [backend/services/rag_retrieval.py](backend/services/rag_retrieval.py)

### 3. **Single Upload Location Strategy**

**Problem:** Files scattered across filesystem → confusing, hard to manage.

**Solution:** All uploads → `backend/data/uploads/` with organized subdirs:
```
backend/data/uploads/
├── syllabus/        (teacher uploads)
├── books/           (reference materials)
├── papers/          (generated exam papers)
├── question_images/ (extracted from PDFs)
└── student_submissions/  (student answer scripts)
```

**Benefits:**
- ✅ Easy backup (single folder)
- ✅ Predictable paths
- ✅ Docker volume binding easier
- ✅ Clear responsibility separation

**Code Location:** [backend/services/document_processor.py](backend/services/document_processor.py)

### 4. **Modular Services Architecture**

Each service handles one responsibility (Single Responsibility Principle):

```
question_generator.py   → Only AI question creation
paper_generator.py      → Only paper assembly
rag_retrieval.py        → Only semantic search
grading_engine.py       → Only answer evaluation
image_integration.py    → Only image processing
document_processor.py   → Only file upload handling
database.py             → Only DB connections
```

**Benefits:**
- ✅ Easy to test each independently
- ✅ Easy to replace (e.g., swap Qdrant for Pinecone)
- ✅ Scalable (run each as microservice)
- ✅ Maintainable (clear boundaries)

### 5. **Duplicate Image Prevention in Papers**

**Problem:** Image-heavy questions can create papers with same image appearing twice.

**Solution:** Paper generator tracks `used_image_ids` set:
```python
used_image_ids = set()
for question in selected_questions:
    if question.image_id not in used_image_ids:
        add_to_paper()
        used_image_ids.add(question.image_id)
    else:
        skip_this_question()
```

**Code Location:** [backend/services/paper_generator.py#L75](backend/services/paper_generator.py#L75)

---

## 2) Current stack (active)

### Backend
- FastAPI + Uvicorn
- MySQL (relational data)
- Qdrant (vector DB for RAG)
- SentenceTransformers (`all-MiniLM-L6-v2`) for embeddings
- Hybrid LLM: Ollama (`mistral:latest`) + xAI API fallback

### Frontend
- React + Vite

### Storage paths
- Uploads (single canonical location): `backend/data/uploads/`
  - `backend/data/uploads/blueprints/` - Question paper blueprints
  - `backend/data/uploads/books/` - Reference books (for RAG)
  - `backend/data/uploads/papers/` - Generated question papers
  - `backend/data/uploads/student_submissions/` - Student answer submissions
  - `backend/data/uploads/syllabus/` - Syllabus documents (for RAG)
  - `backend/data/uploads/question_images/` - Images extracted from documents
- MySQL persistent data (Docker bind mount): `mysql_data/`
- Qdrant local storage: `qdrant_storage/`

---

## 3) Quick Start (Docker Compose)

**Recommended for local development and testing.** This requires Docker and Docker Compose installed.

```bash
# 1. Clone and navigate to project
cd /Thilaga/Projects/Quest-generator

# 2. Set up environment variables
cp .env.example .env
# Edit .env and add your API keys (XAI_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY)

# 3. Build and start all services
docker-compose up --build

# 4. Wait for services to initialize (~30 seconds)
# You'll see "Backend ready on port 8010" when ready

# 5. Access the application:
# - Frontend: http://localhost:5173
# - API Docs: http://localhost:8010/docs
# - API Root: http://localhost:8010/

# To stop:
docker-compose down

# To stop and clean volumes (WARNING: deletes DB and vectors):
docker-compose down -v
```

### What Docker Compose Provides
- **Backend** (FastAPI) on port 8010
- **Frontend** (React + Vite) on port 5173
- **MySQL** database on port 3306 (auto-initialized)
- **Qdrant** vector DB on port 6333
- **nginx** reverse proxy on port 80 (handles CORS, rate limiting)
- **network**: `quest-network` for service-to-service communication

### Production Deployment
For production, use `docker-compose.prod.yml` with resource limits, security hardening, and SSL/TLS:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

---

## 4) Prerequisites

### System Requirements
- **Python**: 3.10+ (3.12 recommended for backend)
- **Node.js**: 18+ (for frontend)
- **Docker & Docker Compose**: Latest versions
- **Ollama**: Installed locally (for hybrid LLM mode)
- **Disk Space**: 10+ GB (for databases, vector storage, dependencies)
- **RAM**: 8+ GB recommended (4+ GB minimum)

### Install Ollama & Pull Model

```bash
# Install Ollama from https://ollama.ai
# Then pull the mistral model:
ollama pull mistral:latest

# Start Ollama service (runs in background):
ollama serve
```

**Verify Ollama is running:**
```bash
curl http://localhost:11434/api/tags
```

---

## 5) Manual Infrastructure Setup

**Use this if not using Docker Compose.**

### MySQL Container

```bash
docker run -d \
  --name quest-mysql \
  --network quest-network \
  -e MYSQL_ROOT_PASSWORD=root123 \
  -e MYSQL_DATABASE=quest_generator \
  -e MYSQL_USER=quest_user \
  -e MYSQL_PASSWORD=quest_pass \
  -p 3306:3306 \
  -v $(pwd)/mysql_data:/var/lib/mysql \
  mysql:8
```

Verify MySQL is running:
```bash
docker exec quest-mysql mysql -u quest_user -pquest_pass quest_generator -e "SHOW TABLES;" 2>/dev/null | head -5
```

### Qdrant Container

```bash
docker run -d \
  --name qdrant-server \
  --network quest-network \
  -p 6333:6333 \
  -v $(pwd)/qdrant_storage:/qdrant/storage \
  qdrant/qdrant
```

Verify Qdrant is running:
```bash
curl http://localhost:6333/health
```

---

## 6) Backend Setup

### 6a) Python Virtual Environment

```bash
cd backend
python3.12 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 6b) Environment Configuration

Create `backend/.env` (copy from `.env.example` if available):

```env
# Database
DB_TYPE=mysql
DB_HOST=localhost          # Use 'mysql' if running in Docker
DB_PORT=3306
DB_NAME=quest_generator
DB_USER=quest_user
DB_PASSWORD=quest_pass

# AI Mode: 'hybrid' (tries Ollama first), 'online' (uses APIs only), 'offline' (Ollama only)
AI_MODE=hybrid

# Ollama (Offline LLM)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral:latest

# xAI (Grok-2)
XAI_BASE_URL=https://api.x.ai/v1
XAI_MODEL=grok-2-latest
XAI_API_KEY=your_xai_api_key_here

# OpenAI (GPT-4, GPT-4o-mini)
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
OPENAI_API_KEY=your_openai_api_key_here

# Google Gemini
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
GEMINI_MODEL=gemini-1.5-flash
GEMINI_API_KEY=your_gemini_api_key_here

# Server
PORT=8010
DEBUG=True

# Qdrant (Vector Database for RAG)
QDRANT_HOST=localhost     # Use 'qdrant' if running in Docker
QDRANT_PORT=6333
QDRANT_API_KEY=your-secret-key
QDRANT_HTTPS=false
```

### 6c) Start Backend Server

```bash
cd backend
source venv/bin/activate
python main.py
```

**Expected output:**
```
INFO:     Uvicorn running on http://127.0.0.1:8010
```

### Backend Access Points
- **API Root**: [http://localhost:8010/](http://localhost:8010/)
- **Swagger Docs**: [http://localhost:8010/docs](http://localhost:8010/docs)
- **ReDoc**: [http://localhost:8010/redoc](http://localhost:8010/redoc)

---

## 7) Frontend Setup

### 7a) Install Dependencies

```bash
cd frontend
npm install
```

### 7b) Configure Frontend

The frontend automatically connects to `http://localhost:8010` (or `http://backend:8010` in Docker).

Update [frontend/vite.config.js](frontend/vite.config.js) if using a different backend URL.

### 7c) Start Development Server

```bash
cd frontend
npm run dev
```

**Expected output:**
```
VITE v... ready in ... ms
➜  Local:   http://localhost:5173/
```

### Build for Production

```bash
npm run build
npm run preview
```

### Frontend Access
- **Development**: [http://localhost:5173](http://localhost:5173)
- **Production Build**: Output in `frontend/dist/`

---

## 8) Running the Application

### Complete Startup Sequence (Manual)

```bash
# Terminal 1: Start Ollama (skip if using only cloud APIs)
ollama serve

# Terminal 2: Start MySQL
docker start quest-mysql

# Terminal 3: Start Qdrant
docker start qdrant-server

# Terminal 4: Start Backend
cd backend
source venv/bin/activate
python main.py

# Terminal 5: Start Frontend
cd frontend
npm run dev
```

### Docker Compose Startup (Recommended)

```bash
docker-compose up --build
```

**Health Checks:**
```bash
# Check backend is running
curl http://localhost:8010/

# Check frontend is accessible
curl http://localhost:5173/

# Check database
docker exec quest-mysql mysql -u quest_user -pquest_pass quest_generator -e "SELECT 1;"

# Check Qdrant
curl http://localhost:6333/health
```

---

## 9) API Reference

### Authentication
Currently authentication is not enforced. Add middleware in [backend/main.py](backend/main.py) for production.

### Core Endpoints

#### Questions
- `GET /api/questions/` - List all questions
- `POST /api/questions/` - Create new question
- `GET /api/questions/{id}` - Get question by ID
- `GET /api/questions/{id}/image` - Get question image (PNG blob)
- `PUT /api/questions/{id}` - Update question
- `DELETE /api/questions/{id}` - Delete question

#### Question Papers
- `GET /api/papers/` - List all papers
- `POST /api/papers/generate` - Generate paper from blueprint
- `GET /api/papers/{id}` - Get paper by ID
- `GET /api/papers/{id}/download` - Download paper as PDF/DOCX
- `POST /api/papers/{id}/submit` - Submit answers for evaluation

#### RAG & Documents
- `POST /api/documents/upload` - Upload syllabus/books
- `POST /api/rag/search` - Query RAG context
- `GET /api/rag/collections` - List RAG collections

#### Question Generation
- `POST /api/questions/generate` - Generate question with AI
  - **Query Parameters:**
    - `topic` (string): Topic to generate question for
    - `ai_provider` (string): `auto`, `ollama`, `xai`, `openai`, `gemini`
    - `num_questions` (int): Number of questions to generate

#### Image Processing
- `POST /api/images/extract-from-pdf` - Extract images from PDF
- `POST /api/images/fix-brightness` - Apply brightness correction
- `POST /api/images/detect-rotation` - Detect and fix rotation

### Error Responses
All endpoints return:
```json
{
  "detail": "Error message"  // On error (4xx/5xx)
}
```

For detailed endpoint info, see [http://localhost:8010/docs](http://localhost:8010/docs) when backend is running.

---

## 10) Backend Services

The backend is organized into modular services in [backend/services/](backend/services/):

### Core Services

#### `image_integration.py` - Image Processing Pipeline
Handles PDF image extraction, brightness correction, and rotation detection.
- **Functions:**
  - `extract_images_from_pdf()` - Extract images from PDF documents
  - `fix_extreme_brightness_image()` - Correct inverted/extreme brightness images
  - `detect_and_fix_rotation()` - Auto-detect and fix rotated images (vertical text → horizontal)
  - `validate_temp_file()` - Validate extracted images before saving
- **API Endpoint:** `/api/images/extract-from-pdf`

**Recent Fix (Apr 25, 2026):** Enhanced rotation detection using aspect ratio analysis. Images with width/height < 0.35 and height > 400px are rotated 90° to correct portrait-mode extraction of landscape content.

#### `paper_generator.py` - Question Paper Management
Generates question papers from blueprints with auto-deduplication.
- **Functions:**
  - `generate_paper_from_blueprint()` - Build paper from template
  - `select_questions_for_paper()` - Smart question selection with deduplication
  - `ensure_no_duplicates()` - Tracks `used_image_ids` to prevent duplicate images
- **API Endpoint:** `/api/papers/generate`

**Feature:** Automatically prevents duplicate images across a single paper generation.

#### `question_generator.py` - AI Question Generation
Handles question creation using hybrid LLM support.
- **Functions:**
  - `generate_questions()` - Generate questions from topic
  - `generate_with_rag_context()` - Grounded generation using retrieved documents
  - `fallback_to_online_provider()` - Fallback chain: Ollama → xAI → OpenAI → Gemini
- **AI Providers:**
  - Ollama (offline, fast, local) - Default if running
  - xAI (Grok-2, powerful reasoning)
  - OpenAI (GPT-4o-mini)
  - Google Gemini (1.5-flash)
- **API Endpoint:** `/api/questions/generate`

#### `rag_retrieval.py` - Retrieval-Augmented Generation
Semantic search across uploaded documents using vector embeddings.
- **Functions:**
  - `search_rag_context()` - Query documents semantically
  - `embed_and_store()` - Store document chunks in Qdrant
  - `chunk_document()` - Split text into semantic chunks
- **Embedding Model:** `all-MiniLM-L6-v2` (SentenceTransformers)
- **Vector DB:** Qdrant (collection: `quest_generator_rag`)
- **API Endpoint:** `/api/rag/search`

#### `grading_engine.py` - Automatic Answer Evaluation
Evaluates student submissions against answer keys using LLM.
- **Functions:**
  - `grade_submission()` - Score student answers
  - `compare_answers()` - LLM-based answer comparison
  - `generate_feedback()` - Auto-generate detailed feedback
- **API Endpoint:** `/api/papers/{id}/submit`

#### `document_processor.py` - File Upload & Processing
Handles document uploads and preprocessing.
- **Supported Formats:** PDF, DOCX, TXT, images (PNG, JPG)
- **Functions:**
  - `process_uploaded_file()` - Validate and process uploads
  - `extract_text_from_document()` - Convert docs to text
  - `save_to_upload_directory()` - Store in canonical location
- **API Endpoint:** `/api/documents/upload`

### Supporting Modules

#### `database.py` - MySQL Connection Management
- Handles connection pooling
- Auto-reconnect logic
- Dictionary cursor for JSON-like queries

#### `models.py` - SQLAlchemy Data Models
Database schema definitions:
- `Question` - Individual questions with topic/unit metadata
- `Paper` - Question papers with blueprint link
- `StudentSubmission` - Student answer responses
- `EvaluationResult` - Grading results and feedback

---

## 11) Data & Storage

### Where Data Is Stored

| Data Type | Location | Details |
|-----------|----------|---------|
| Relational DB | MySQL `quest_generator` | Questions, papers, submissions, metadata |
| Vector Embeddings | Qdrant collection `quest_generator_rag` | Document chunks, embeddings for semantic search |
| Uploaded Files | `backend/data/uploads/` | User-uploaded documents and generated files |
| Question Images | `backend/data/uploads/question_images/` | Extracted/processed images for questions |
| Generated Papers | `backend/data/uploads/papers/` | PDF/DOCX question paper files |
| Student Submissions | `backend/data/uploads/student_submissions/` | Student answer documents |
| Temporary Files | `backend/data/uploads/temp/` | Temp PDFs, intermediate processing files |
| Database Files | `mysql_data/` | MySQL persistent storage (Docker volume) |
| Vector Storage | `qdrant_storage/` | Qdrant persistent storage (Docker volume) |

### Database Schema

**Tables in MySQL `quest_generator` DB:**
```
+----------------------+
| questions            | ID, text, topic, unit, level, options, answer, image_path, created_at
| papers               | ID, name, blueprint_id, questions, status, created_at
| submissions          | ID, paper_id, student_id, answers, submitted_at, graded
| evaluation_results   | ID, submission_id, score, feedback, graded_at
| users                | ID, email, name, role (admin/teacher/student), created_at
| documents_metadata   | ID, filename, upload_path, embedding_count, created_at
+----------------------+
```

### Backup & Cleanup

**Important:** The following directories contain critical data:
- `mysql_data/` - **NEVER DELETE** without backup
- `qdrant_storage/` - **NEVER DELETE** without backup

**Safe to Clean (reinstall/rebuild):**
- `backend/venv/` - 5.3 GB, reinstall with `pip install -r requirements.txt`
- `frontend/node_modules/` - 360 MB, reinstall with `npm install`
- `backend/__pycache__/` - Recreated automatically
- `frontend/dist/` - Rebuild with `npm run build`

See [CLEANUP_GUIDE.md](CLEANUP_GUIDE.md) for detailed cleanup procedures.

---

## 12) Environment Configuration

### Complete .env Template

Copy [`.env.example`](.env.example) to `backend/.env` and configure:

```env
# ========================
# Database Configuration
# ========================
DB_TYPE=mysql
DB_HOST=localhost              # 'localhost' for manual, 'mysql' for Docker
DB_PORT=3306
DB_NAME=quest_generator
DB_USER=quest_user
DB_PASSWORD=quest_pass

# ========================
# AI/LLM Configuration
# ========================
AI_MODE=hybrid                 # 'hybrid', 'online', 'offline'
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral:latest

# xAI (Grok-2 - powerful reasoning)
XAI_BASE_URL=https://api.x.ai/v1
XAI_MODEL=grok-2-latest
XAI_API_KEY=sk-...your_key_here

# OpenAI (GPT-4, GPT-4o-mini)
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
OPENAI_API_KEY=sk-...your_key_here

# Google Gemini
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
GEMINI_MODEL=gemini-1.5-flash
GEMINI_API_KEY=...your_key_here

# ========================
# Server Configuration
# ========================
PORT=8010
DEBUG=True                     # Set to False in production

# ========================
# Qdrant Configuration
# ========================
QDRANT_HOST=localhost          # 'localhost' for manual, 'qdrant' for Docker
QDRANT_PORT=6333
QDRANT_API_KEY=your-secret-key
QDRANT_HTTPS=false

# ========================
# RAG Configuration (Optional)
# ========================
EMBEDDING_MODEL=all-MiniLM-L6-v2
CHUNK_SIZE=500
CHUNK_OVERLAP=100

# ========================
# File Upload Configuration
# ========================
MAX_UPLOAD_SIZE_MB=100
ALLOWED_EXTENSIONS=pdf,docx,txt,png,jpg,jpeg
```

### AI Mode Selection

- **`hybrid`** (Recommended): Try Ollama first → fallback to xAI/OpenAI/Gemini if offline
- **`online`**: Use only cloud APIs (xAI/OpenAI/Gemini)
- **`offline`**: Use only Ollama (fails if offline)

### Per-Request Provider Override

When calling `/api/questions/generate`, pass `ai_provider` query parameter:

```bash
# Use xAI specifically
curl -X POST "http://localhost:8010/api/questions/generate?ai_provider=xai"

# Use Ollama specifically
curl -X POST "http://localhost:8010/api/questions/generate?ai_provider=ollama"

# Use OpenAI
curl -X POST "http://localhost:8010/api/questions/generate?ai_provider=openai"

# Auto (uses AI_MODE)
curl -X POST "http://localhost:8010/api/questions/generate?ai_provider=auto"
```

---

## 13) Recent Improvements

### Apr 25, 2026 - PDF Image Rotation Fix

**Problem:** Images extracted from PDFs appear rotated 90 degrees (landscape images extracted as portrait).

**Why it happened:** PDF libraries extract pixel data without respecting rotation metadata. A landscape page (2000x400px) extracted becomes portrait (400x2000px).

**Solution:** Enhanced `detect_and_fix_rotation()` function in [backend/services/image_integration.py](backend/services/image_integration.py)
- **Algorithm:** Check aspect ratio: if width/height < 0.35 AND height > 400px → rotated
- **Rationale:** Landscape text has low aspect ratio; portrait view has high aspect ratio
- **Implementation:** Rotate 90° using PIL:
  ```python
  if aspect_ratio < 0.35 and height > 400:
      image = image.rotate(90, expand=True)
  ```
- **Tested extensively** with 2000x400 → 400x2000 dimension cases

**Learning:** Always check metadata first, then use heuristics (aspect ratio, dimensions) as fallback. PIL's `rotate()` with `expand=True` handles new dimensions.

**File:** [backend/services/image_integration.py](backend/services/image_integration.py) (lines 120-150)

---

### Apr 15-25, 2026 - Black Image Blocks Comprehensive Fix

**Problem:** Generated question papers displayed pure black or white image blocks instead of actual content.

**Root Cause Analysis:**
- Images extracted from JSON parser as PIL Image objects
- Brightness values extreme: 1.0 (pure white) or 248+ (nearly black)
- Human eye can't see white on white or black on black

**Solutions Implemented:**

1. **Extraction Fix** - Use correct PIL API
   ```python
   # Bad: pix.tobytes("png")  ← Invalid format
   # Good:
   img = Image.frombytes('RGB', (width, height), pixel_data)
   img.save('output.png')
   ```

2. **Validation** - Ensure files written properly
   - Added fsync: force OS to write to disk (not just buffer)
   - PNG header check: verify first 8 bytes are valid PNG signature
   - Prevents corruption from partial writes

3. **Brightness Correction** - New function in image_integration.py
   ```python
   def fix_extreme_brightness_image(image):
       pixels = image.load()
       # Detect pure black/white
       if all_pixels_near(pixels, (0,0,0)) or all_pixels_near(pixels, (255,255,255)):
           return ImageOps.invert(image)  # Invert colors
       # Enhance contrast
       enhancer = ImageEnhance.Contrast(image)
       return enhancer.enhance(1.5)  # 50% more contrast
   ```
   - Applied automatically before inserting images into DOCX/PDF

4. **Integration** - Auto-apply in paper generation
   - Every image fetched → call fix_extreme_brightness_image()
   - No manual step needed

**Testing:**
- Created synthetic all-black, all-white, low-contrast images
- Verified inversion works
- Tested in actual papers
- Wrote test suite: [backend/test_brightness_fix.py](backend/test_brightness_fix.py)

**Result:** All image display issues resolved. Papers now show readable images.

**Learning points for interviews:**
- How to debug: write test files, check pixel values
- Know PIL Image API well
- File I/O validation matters (fsync, headers)
- Image processing: brightness, contrast, inversion
- Where to apply fixes (once at extraction, or before each use?)

**Files Modified:**
- [backend/services/image_integration.py](backend/services/image_integration.py) - Core fixes
- [backend/tests/test_brightness_fix.py](backend/tests/test_brightness_fix.py) - Test suite

---

### Apr 15, 2026 - Image Detection Algorithm Enhancement

**Problem:** AI wasn't detecting when to use images in math/science questions consistently.

**Example:**
- Question: "What is Newton's second law?" → Should show force diagram
- AI output: No image selected
- User sees boring text, no visual learning aid

**Root Cause:** No signal sent to AI that image is needed. "generate question about Newton's second law" doesn't mention diagrams.

**Solution:** Added keyword triggers in question generation chain:
```python
KEYWORD_REQUIRES_IMAGE = {
    'math': ['sort', 'heap', 'comparison', 'complexity', 'array', 'tree', 'graph'],
    'science': ['diagram', 'circuit', 'structure', 'molecule', 'cell', 'anatomy'],
}

if any(keyword in prompt for keyword in KEYWORD_REQUIRES_IMAGE['math']):
    prompt += " Include an image/diagram showing the concept."
```

**Result:** Questions about algorithms get diagrams. Circuit questions get circuit diagrams.

**Learning:**
- Heuristic-based approach when LLM alone isn't enough
- Context augmentation: add hints to AI prompts
- Domain-specific keywords matter

**File:** [backend/services/question_generator.py](backend/services/question_generator.py) (lines 45-60)

---

### API Fallback Improvements

**Problem:** When Ollama down, user sees generic "Error" message.

**Solution:** Enhanced error handling chain with logging:
```python
try:
    return ollama.generate(prompt)
except:
    log.warning("Ollama failed, trying xAI...")
    try:
        return xai.generate(prompt)
    except:
        log.warning("xAI failed, trying OpenAI...")
        try:
            return openai.generate(prompt)
        except:
            log.error("All providers failed")
            raise
```

**Logging added:**
- Trace-level: which provider attempting, response latency
- Debug-level: fallback triggers, API response headers
- Error-level: final failure + helpful message

**User experience:** "Using OpenAI due to Ollama offline" instead of cryptic error.

**File:** [backend/services/question_generator.py](backend/services/question_generator.py) (lines 200-250)

---

### Duplicate Image Prevention (Deep Dive)

**Problem:** Generated papers with multiple image-heavy questions show same image twice.

**Example:**
- Q1: "Newton's Laws" (has force_diagram.png)
- Q5: "Momentum" (also has force_diagram.png)
- Paper shows same diagram twice → confusing

**Solution:** Paper generator tracks used image IDs:

```python
def generate_paper_from_blueprint(blueprint):
    used_image_ids = set()  # ← Key: mutable set tracks usage
    selected_questions = []
    
    for question in all_questions:
        if question.image_id and question.image_id in used_image_ids:
            continue  # Skip: image already in this paper
        
        selected_questions.append(question)
        if question.image_id:
            used_image_ids.add(question.image_id)
    
    return selected_questions
```

**Why this matters:**
- Images often large (100+ KB each)
- Duplication increases paper size unnecessarily
- Confuses students (see same image for different concepts)
- Better to skip a question than duplicate visuals

**Trade-off:** Might generate fewer questions (if many share images) but cleaner output.

**File:** [backend/services/paper_generator.py](backend/services/paper_generator.py) (lines 75-95)

---

## 14) Troubleshooting

### Backend Issues

#### Port 8010 Already in Use

```bash
# Find and kill process on port 8010
fuser -k 8010/tcp

# Or find the PID and kill it
lsof -i :8010
kill -9 <PID>
```

#### Database Connection Failed

```bash
# Check if MySQL container is running
docker ps | grep mysql

# Start MySQL if stopped
docker start quest-mysql

# Verify MySQL is accepting connections
docker exec quest-mysql mysql -u quest_user -pquest_pass -e "SELECT 1;"
```

#### Ollama Connection Failed

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama service
ollama serve

# Verify model is downloaded
ollama list | grep mistral

# Pull model if missing
ollama pull mistral:latest
```

#### Backend Returns "500 Internal Server Error"

Check backend logs:
```bash
# If running in terminal, check output
# If running in Docker:
docker-compose logs backend

# Check specific error in logs:
docker-compose logs backend | grep -i error
```

### Frontend Issues

#### CORS Errors / API Not Reachable

The nginx reverse proxy in Docker Compose handles CORS. If running manually:

1. **Check backend is running:** `curl http://localhost:8010/`
2. **Check frontend config:** Verify [frontend/vite.config.js](frontend/vite.config.js) has correct backend URL
3. **Add CORS headers:** Configure in `backend/main.py`:
   ```python
   from fastapi.middleware.cors import CORSMiddleware
   app.add_middleware(
       CORSMiddleware,
       allow_origins=["http://localhost:5173"],
       allow_credentials=True,
       allow_methods=["*"],
       allow_headers=["*"],
   )
   ```

#### Frontend Shows Blank Page

```bash
# Check browser console (F12) for errors
# Check if backend is responding
curl http://localhost:8010/

# Rebuild frontend
cd frontend && npm run build

# Check if port 5173 is in use
lsof -i :5173
```

### Database Issues

#### MySQL Shows Error on Container Start

```bash
# Check MySQL logs
docker logs quest-mysql

# Sometimes slow startup; wait 30 seconds then try:
docker exec quest-mysql mysql -u quest_user -pquest_pass -e "SELECT 1;"

# If still failing, reset
docker-compose down -v
docker-compose up mysql
```

#### Qdrant Not Serving Vectors

```bash
# Check Qdrant health
curl http://localhost:6333/health

# Check collection exists
curl http://localhost:6333/collections

# If no collections, RAG needs re-enabled:
docker restart qdrant-server
```

### Image Processing Issues

#### Images Not Displaying in Papers

Check [backend/services/image_integration.py](backend/services/image_integration.py):

```bash
# Verify images were extracted
ls -la backend/data/uploads/question_images/ | head -20

# Check image file integrity
file backend/data/uploads/question_images/*.png
```

Run brightness test:
```bash
cd backend
python test_brightness_fix.py
```

#### Extracted Images Are Rotated

Run rotation test:
```bash
cd backend
python test_rotations_fix.py
```

The automatic fix should detect aspect ratio and correct. If not working:
1. Check image dimensions
2. Verify `detect_and_fix_rotation()` in [backend/services/image_integration.py](backend/services/image_integration.py)
3. Run: `python test_brightness_simple.py` for diagnostics

### RAG/Semantic Search Issues

#### RAG Returns No Results

```bash
# Check if documents were uploaded and embedded
curl http://localhost:6333/collections

# Check specific collection
curl http://localhost:6333/collections/quest_generator_rag

# If empty, re-upload documents through UI or API:
curl -X POST "http://localhost:8010/api/documents/upload" \
  -F "file=@backend/data/uploads/syllabus/sample.pdf"
```

#### Wrong AI Provider Being Used

Check `.env` files:
```bash
# Verify AI_MODE setting
grep AI_MODE backend/.env

# For Docker, check in container
docker exec quest-backend printenv | grep AI_MODE
```

### Docker Compose Issues

#### Container Won't Start

```bash
# Check specific container logs
docker-compose logs <service-name>

# Examples:
docker-compose logs backend
docker-compose logs mysql
docker-compose logs qdrant

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up
```

#### Port Conflicts

Find and kill process on conflicting port:
```bash
# Find what's using port 8010
lsof -i :8010

# Kill it
kill -9 <PID>

# Or change mport in docker-compose.yml:
# Change 8010:8010 to 8011:8010 to use port 8011 externally
```

#### Out of Disk Space

```bash
# Check Docker disk usage
docker system df

# Clean up old images/containers
docker system prune -a

# Clean up volumes (WARNING: deletes data)
docker volume prune
```

---

## 15) Project Structure

### Directory Tree

```
Quest-generator/
├── README.md                                  # This file
├── docker-compose.yml                         # Development Docker Compose
├── docker-compose.prod.yml                    # Production Docker Compose
├── nginx.conf                                 # Reverse proxy configuration
├── run.sh                                     # Automated run script
├── setup.sh                                   # Setup script
│
├── backend/                                   # FastAPI backend
│   ├── main.py                               # Entry point
│   ├── requirements.txt                      # Python dependencies
│   ├── Dockerfile                            # Docker image definition
│   │
│   ├── core/
│   │   ├── database.py                       # MySQL connection pool
│   │   ├── models.py                         # SQLAlchemy ORM models
│   │   └── config.py                         # Configuration loader
│   │
│   ├── services/                             # Core business logic
│   │   ├── question_generator.py             # AI question generation
│   │   ├── paper_generator.py                # Paper building & deduplication
│   │   ├── rag_retrieval.py                  # Semantic search (RAG)
│   │   ├── grading_engine.py                 # Answer evaluation
│   │   ├── image_integration.py              # Image processing
│   │   └── document_processor.py             # File upload handling
│   │
│   ├── tests/                                # Unit & integration tests
│   │   ├── test_image_pipeline.py
│   │   ├── test_brightness_fix.py
│   │   ├── test_rotations_fix.py
│   │   └── test_generate_paper.py
│   │
│   └── utils/                                # Utility functions
│   │
│   ├── data/
│   │   └── uploads/                          # User uploads & generated files
│   │       ├── blueprints/
│   │       ├── books/
│   │       ├── papers/
│   │       ├── syllabus/
│   │       ├── student_submissions/
│   │       └── question_images/
│   │
│   └── logs/                                 # Generation logs
│
├── frontend/                                  # React + Vite frontend
│   ├── package.json
│   ├── index.html
│   ├── vite.config.js
│   ├── eslint.config.js
│   ├── DESIGN_GUIDE.md
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── pages/
│   │   ├── components/
│   │   └── services/
│   ├── public/
│   └── dist/
│
├── mysql_data/                               # MySQL persistence
└── qdrant_storage/                           # Qdrant persistence
```

### Key Architectural Decisions

1. **Single Upload Location**: All uploads go to `backend/data/uploads/`
2. **MySQL Only**: SQLite completely removed
3. **Modular Services**: Each service independently testable
4. **Docker First**: `docker-compose.yml` provides complete stack
5. **API-First Design**: All operations via REST API
6. **Hybrid LLM**: Offline Ollama + online APIs

---

## 16) Deployment

### Production Deployment

Use `docker-compose.prod.yml`:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

Create `backend/.env.prod`:
- `DEBUG=False`
- `AI_MODE=online` (cloud APIs only)
- Strong `QDRANT_API_KEY`
- SSL certificates
- Production database credentials

### Monitoring

```bash
docker-compose logs -f backend
docker-compose ps
```

---

## 17) Testing

### Run Tests

```bash
cd backend
pytest tests/ -v
pytest tests/test_image_pipeline.py -v
pytest tests/test_brightness_fix.py -v
```

---

## 18) Development Notes

### How to Think About Extending This System

When adding features, follow the **modular services pattern**:

**Example: Add feature "Grade plagiarism detection"**

1. **Create new service:** `backend/services/plagiarism_detector.py`
   ```python
   class PlagiarismDetector:
       def check_plagiarism(self, submission_text, threshold=0.8):
           """Check if submission is plagiarized from other submissions."""
   ```

2. **Add API endpoint:** in `backend/main.py`
   ```python
   @app.post("/api/submissions/{id}/check-plagiarism")
   def check_plagiarism(id: int):
       result = plagiarism_detector.check_plagiarism(...)
       return result
   ```

3. **Write tests first:** `backend/tests/test_plagiarism.py`
   ```python
   def test_identical_submission_detected():
       # Should flag 100% match
   def test_similar_submission_detected():
       # Should flag 85% match above threshold
   ```

4. **Update README:** Document endpoint, parameters, return values

5. **Deploy:**
   ```bash
   docker-compose up --build  # Rebuilds backend image with new service
   ```

**Key principle:** Each service is **independent**, **testable**, **replaceable**.

---

### Code Standards & Best Practices

**Python Guidelines:**
```python
# ✅ Good: Type hints, docstring, error handling
def generate_questions(topic: str, num: int, context: Optional[str] = None) -> List[Question]:
    """Generate AI questions for a topic with optional RAG context.
    
    Args:
        topic: Topic to generate questions for
        num: Number of questions to generate
        context: Optional RAG context to ground generation
        
    Returns:
        List of generated Questions with answers
        
    Raises:
        ValueError: If num <= 0 or topic empty
        AIProviderError: If all AI providers fail
    """
    if num <= 0:
        raise ValueError("num must be positive")
    
    try:
        return _generate_with_ollama(topic, num, context)
    except OfflineError:
        logger.warning("Ollama offline, trying xAI...")
        return _generate_with_xai(topic, num, context)

# ❌ Bad: No hints, no docstring, silent failures
def gen_q(t, n, c=None):
    try:
        return ollama(t, n, c)
    except:
        return xai(t, n, c)
```

**API Design:**
```python
# ✅ Good: Clear verb + noun, consistent naming
GET    /api/questions/
POST   /api/questions/
GET    /api/questions/{id}
PUT    /api/questions/{id}
DELETE /api/questions/{id}

# ❌ Bad: Inconsistent, vague verbs
GET    /api/question-list
POST   /api/create-question
GET    /api/get-question/{id}
POST   /api/edit/{id}
```

**Database Interactions:**
```python
# ✅ Good: Use ORM, type hints, connection pooling
from sqlalchemy.orm import Session
from core.database import get_db

@app.get("/api/questions/{id}")
def get_question(id: int, db: Session = Depends(get_db)):
    question = db.query(Question).filter(Question.id == id).first()
    if not question:
        raise HTTPException(status_code=404)
    return question

# ❌ Bad: Raw SQL, potential injection, no pooling
@app.get("/api/questions/{id}")
def get_question(id):
    result = db.execute(f"SELECT * FROM questions WHERE id={id}")
```

---

### Common Development Tasks

**Setup work environment:**
```bash
# Install backend dependencies + create venv
cd backend
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Install frontend dependencies
cd ../frontend
npm install

# Start development servers
# Terminal 1:
cd backend && python main.py

# Terminal 2:
cd frontend && npm run dev
```

**Reset and start clean:**
```bash
# Kill all services, remove volumes (deletes DB!)
docker-compose down -v

# Rebuild images (if requirements.txt changed)
docker-compose build --no-cache

# Start everything fresh
docker-compose up
```

**Running tests:**
```bash
cd backend

# Run all tests
pytest tests/ -v

# Run specific test file
pytest tests/test_brightness_fix.py -v

# Run with coverage
pytest tests/ --cov=services --cov-report=html
```

**Database debugging:**
```bash
# Access MySQL directly
docker exec -it quest-mysql mysql -u quest_user -pquest_pass quest_generator

# Inside MySQL:
SHOW TABLES;
SELECT COUNT(*) FROM questions;
SELECT * FROM questions LIMIT 5;

# Check Qdrant collections
curl http://localhost:6333/collections
```

**Logging and debugging:**
```python
import logging

logger = logging.getLogger(__name__)

# Add at key points
logger.debug("Starting paper generation...")
logger.info(f"Generated {len(questions)} questions")
logger.warning("Ollama offline, fallback to cloud")
logger.error(f"Failed to process PDF: {error}")
```

**Pull latest Ollama model:**
```bash
ollama pull mistral:latest
ollama pull neural-chat:latest  # Alternative model to test with
ollama list  # See installed models
```

---

### Git Workflow (If Using Version Control)

```bash
# Create feature branch
git checkout -b feature/plagiarism-detection

# Make changes, commit frequently
git add .
git commit -m "Add plagiarism detection service"

# Push and create PR
git push origin feature/plagiarism-detection

# After review/approval, merge
git checkout main
git merge feature/plagiarism-detection
```

**Commit message style:**
```
✅ Good:
  - "Add plagiarism detector service with similarity scoring"
  - "Fix image rotation for landscape PDFs (aspect ratio detection)"
  - "Refactor RAG chunking to hierarchical levels"

❌ Bad:
  - "fix stuff"
  - "updates"
  - "asdfjkl"
```

---

### Testing Philosophy

**Test pyramid (write more unit tests, fewer integration tests):**
```
        ◇ (E2E Tests)
       ◇◇◇ (Integration Tests)
     ◇◇◇◇◇◇◇ (Unit Tests) ← Most tests here
```

**Example test structure:**
```python
# tests/test_paper_generator.py

class TestPaperGenerator:
    
    def test_deduplication_prevents_duplicate_images(self):
        """Unit test: ensure same image not added twice."""
        questions = [
            Question(id=1, image_id=100),
            Question(id=2, image_id=100),  # Same image
            Question(id=3, image_id=101),
        ]
        
        paper = generate_paper(questions)
        image_ids = [q.image_id for q in paper.questions]
        
        assert image_ids.count(100) == 1  # Only one copy of image 100
    
    def test_blueprint_applied_correctly(self):
        """Integration test: blueprint → questions → paper."""
        blueprint = {
            'easy': 2,
            'medium': 2,
            'hard': 1
        }
        
        paper = PaperGenerator.from_blueprint(blueprint)
        
        assert len(paper.questions) == 5
        assert len([q for q in paper.questions if q.level=='easy']) == 2
```

---

### Performance Considerations

**Caching:**
```python
from functools import lru_cache

@lru_cache(maxsize=128)
def get_all_topics():
    """Cache topic list (doesn't change often)."""
    return db.query(Question.topic).distinct()

# Cache RAG results for frequent searches
RAG_CACHE = {}  # In production: use Redis

def search_rag(query):
    if query in RAG_CACHE:
        return RAG_CACHE[query]  # Fast path
    
    results = qdrant.search(query)
    RAG_CACHE[query] = results
    return results
```

**Async operations (long-running):**
```python
# Without async: API blocks while generating 100 questions
@app.post("/api/questions/generate")
def generate(topic: str, num: int):
    questions = ai.generate(topic, num)  # Blocks 30 seconds!
    return questions

# Better: return immediately, process in background
from tasks import celery

@app.post("/api/questions/generate-async")
def generate_async(topic: str, num: int):
    task_id = celery.generate_questions.delay(topic, num)
    return {"task_id": task_id}  # Return immediately

@app.get("/api/tasks/{task_id}")
def get_task_status(task_id):
    return celery.AsyncResult(task_id).status  # Check progress
```

**Database indexing:**
```python
# MySQL: Add indexes on frequently queried columns
ALTER TABLE questions ADD INDEX idx_topic (topic);
ALTER TABLE papers ADD INDEX idx_status (status);

# Qdrant: Uses inverted indexes by default for vector search
```

---

## 19) Interview Talking Points

### Questions You Should Be Able to Answer

#### 1. **What is RAG and why does this project use it?**

**Answer to memorize:**
RAG = Retrieval-Augmented Generation. Instead of AI generating questions from thin air (which are generic), we:
1. Index actual syllabus/textbooks into a vector database (Qdrant)
2. When generating: retrieve relevant chunks via semantic search
3. Include as context in the prompt: "Generate questions about Newton's Laws using THIS SPECIFIC textbook content"

**Why?**
- Without RAG: AI generates generic questions (not tied to curriculum)
- With RAG: AI generates questions grounded in actual learning materials
- Better educational value, alignment with syllabus

**Code reference:** [backend/services/rag_retrieval.py](backend/services/rag_retrieval.py)

**Interview follow-up:** "How would you handle RAG at scale with 1M+ documents?"
- Partition Qdrant collections by subject/grade
- Use hierarchical chunking (chapters → sections → subsections)
- Implement caching of frequent searches
- Use hybrid search (keyword + semantic)

---

#### 2. **Why hybrid LLM (Ollama + Cloud APIs) instead of just one?**

**Answer:**
- **Offline capability:** Ollama runs locally, works without internet (privacy, speed)
- **Better results when online:** xAI Grok-2 or GPT-4 for complex reasoning
- **Cost optimization:** Ollama is free, cloud APIs charged per token
- **Resilience:** If Ollama down → fallback to cloud APIs seamlessly

**Architecture:**
```python
try:
    response = ollama.generate(prompt)  # Fast, free, local
except OfflineError:
    response = xai.generate(prompt)      # Fallback to cloud
```

**Trade-off:** Added complexity, but better UX and cost control.

**Code reference:** [backend/services/question_generator.py#L200](backend/services/question_generator.py#L200)

---

#### 3. **How does the duplicate image prevention work?**

**Answer:**
Paper Generator tracks a set of used image IDs while building the paper:

```python
used_image_ids = set()
for question in questions_to_add:
    if question.image_id not in used_image_ids:
        add_to_paper(question)
        used_image_ids.add(question.image_id)
    # else: skip this question, image already in paper
```

**Why it matters:** Image-heavy papers (e.g., math with diagrams) could show same image twice without this. Reduces visual clutter, improves reading.

**Code reference:** [backend/services/paper_generator.py#L75](backend/services/paper_generator.py#L75)

---

#### 4. **How is data organized? Why single upload location?**

**Answer (the architecture principle):**
All uploads → `backend/data/uploads/` with subdirectories:

```
uploads/
├── syllabus/         ← Teacher uploads syllabus PDFs
├── books/            ← Reference books for RAG indexing
├── papers/           ← Generated exam papers (DOCX/PDF)
├── question_images/  ← Images extracted from PDFs
└── student_submissions/  ← Student answer scripts
```

**Benefits:**
- **Single backup point:** Backup one folder = everything backed up
- **Docker volume binding easier:** One mount point
- **Clear ownership:** Obvious where each file type goes
- **Scalable:** Easy to add new subdirectories

**Anti-pattern (avoided):** Scattering across `/tmp`, `/var/uploads`, `~/.cache`, etc. → nightmare to manage

---

#### 5. **What databases does the project use and why each?**

**Answer:**
- **MySQL (Relational DB):**
  - Stores: Questions, Papers, Student Submissions, User metadata
  - Why: Structured data with relationships (papers contain questions contain images)
  - ACID guarantees: Crucial for exam/grading data integrity
  
- **Qdrant (Vector DB):**
  - Stores: Embeddings of syllabus chunks (for RAG semantic search)
  - Why: Vector search finds *semantically similar* content (not keyword match)
  - Example: Query "Newton's force" → retrieves "F=ma", "momentum", "energy" (related concepts)

**Why not...**
- SQLite: Not scalable, single-file, no concurrent writes
- Elasticsearch: Overkill for our search complexity, Qdrant simpler
- PostgreSQL with pgvector: Good alternative! We chose Qdrant for simplicity

**Code reference:** 
- MySQL: [backend/core/database.py](backend/core/database.py)
- Qdrant: [backend/services/rag_retrieval.py](backend/services/rag_retrieval.py)

---

#### 6. **Walk me through the complete flow: from syllabus upload to student grading.**

**Answer (with time stamps, shows flow understanding):**

1. **T=0s: Teacher Uploads Syllabus**
   - File: Physics_11th_Grade.pdf
   - Endpoint: `POST /api/documents/upload`
   - DocumentProcessor.process_uploaded_file() validates & saves to `backend/data/uploads/syllabus/`

2. **T=5s: RAG Indexing**
   - RAG Retrieval extracts chunks (500 char each)
   - Embeds using SentenceTransformers (`all-MiniLM-L6-v2`)
   - Stores vectors in Qdrant collection: `quest_generator_rag`
   - Database now searchable by semantic similarity

3. **T=10s: Teacher Requests Questions**
   - Endpoint: `POST /api/questions/generate?topic=Newton's_Laws&num=5`
   - Question Generator receives request:
     a. Searches RAG: "Find chunks about Newton's Laws" → retrieves 3 relevant chunks
     b. Tries Ollama (local): `ollama generate(prompt + context)`
     c. If Ollama offline: fallback to xAI
     d. AI returns 5 MCQ with options & answers
     e. Detects image trigger keywords ("diagram", "force diagram")
     f. Associates image if exists
     g. Saves questions to MySQL with image_paths

4. **T=20s: Paper Generation**
   - Teacher creates blueprint (topics, difficulty distribution)
   - Paper Generator queries MySQL: "get all questions about Newton's Laws"
   - Selects 10 questions, deduplicating images (track used_image_ids)
   - Assembles DOCX (text + images)
   - Saves to `backend/data/uploads/papers/`

5. **T=25s: Paper Shared with Students**
   - Student downloads and solves paper

6. **T=1000s (day later): Student Submits**
   - Student uploads answer sheet
   - Endpoint: `POST /api/papers/{id}/submit`
   - Saves to `backend/data/uploads/student_submissions/`

7. **T=1001s: Grading Begins**
   - Grading Engine retrieves answer key from MySQL
   - For each question:
     - If MCQ: auto-score (compare student option vs answer)
     - If essay: send to AI: "Is this answer correct?" (LLM judges)
   - Generates feedback: "Good understanding of force, but calculation error in Newton's 2nd law"
   - Calculates score (weighted by difficulty)
   - Saves evaluation_results to MySQL

8. **T=1005s: Results Available**
   - Teacher sees dashboard: student scores, class analytics
   - Can override auto-grades if needed
   - Exports report (PDF, CSV)

**Key architectural benefits shown:**
- Modular: each step independent service
- RAG provides context: not generic questions
- Hybrid LLM: works offline (Ollama) or online
- Deduplication: clean papers
- Auto-grading: saves teacher time

**Code references:**
- Full flow: [backend/main.py](backend/main.py)
- Each service above

---

#### 7. **How would you scale this for 1 million students?**

**Answer (scales show you think architecturally):**

**Current bottlenecks:**
- Single MySQL instance (vertical scaling limit)
- Qdrant collections unpartitioned (all embeddings in one place)
- Paper generation queries all questions (O(n) query)
- Single backend server (Uvicorn)

**Proposed scaling:**
1. **Database:**
   - MySQL → Shard by subject/grade (MySQL Cluster)
   - Or migrate to PostgreSQL with read replicas

2. **Vector Search (RAG):**
   - Partition Qdrant collections:
     - `quest_generator_rag_math_11`
     - `quest_generator_rag_science_12`
     - Each collection smaller, faster search

3. **Backend:**
   - Horizontal scaling: multiple backend instances behind load balancer (nginx)
   - Caching: Redis for RAG search results (frequent "Newton's Laws" queries)
   - Async jobs: long-running tasks (paper generation) → Celery/RQ

4. **AI Generation:**
   - Batch API calls to LLMs (cheaper, faster)
   - Local model finetuning (Ollama fine-tuned on common topics)

5. **File Storage:**
   - Move from `backend/data/uploads/` → Object storage (S3, GCS)
   - Allows scaling across multiple servers

---

#### 8. **What challenges did you face? How did you solve them?**

**Answer (shows problem-solving, learning):**

**Challenge 1: Black image blocks in papers**
- Problem: Generated papers showed pure black or white blocks instead of images
- Root cause: Image brightness extreme (1.0 = pure white, 256+ = pure black)
- Solution: `fix_extreme_brightness_image()` function:
  - Detects inverted images (pure black/white)
  - Auto-inverts + enhances contrast
  - Applied before inserting image into DOCX

**Challenge 2: Rotated images from PDF extraction**
- Problem: Landscape content extracted as portrait (rotated 90°)
- Root cause: PDF extraction didn't respect rotation
- Solution: `detect_and_fix_rotation()`:
  - Check aspect ratio: if width/height < 0.35 and height > 400px → rotated
  - Auto-rotate 90° to correct
  - Preserves aspect ratio using PIL

**Challenge 3: RAG retrieving irrelevant chunks**
- Problem: Searching "Newton's Laws" returned chapters on thermodynamics
- Root cause: Embeddings too coarse (whole pages as chunks)
- Solution:
  - Smaller chunks: 500 chars instead of 2000
  - Hierarchical: chapters → sections → subsections
  - Re-rank results by relevance score

**Learning points to mention:**
- How to debug (logging, test scripts)
- When to refactor vs when to patch
- Trade-offs (accuracy vs speed)

---

#### 9. **If I asked you to add feature X, how would you approach it?**

**Generic answer framework:**
1. **Understand requirements** (ask clarifying questions)
2. **Identify affected services** (which modules touch this?)
3. **Design API endpoint** (REST verb + path, input/output)
4. **Implement service logic** (add function to appropriate service)
5. **Update database schema** (if new fields needed)
6. **Write tests** (unit test + integration test)
7. **Update README** (document for next developer)

**Example: "Add difficulty level to questions"**
1. UPDATE MySQL schema: `ALTER TABLE questions ADD COLUMN difficulty ENUM('easy', 'medium', 'hard')`
2. UPDATE ORM model: [backend/core/models.py](backend/core/models.py) add `difficulty` field
3. UPDATE question generator: prompt AI to output difficulty level
4. UPDATE paper blueprint: allow filtering by difficulty
5. UPDATE paper generator: distribute easy/medium/hard evenly
6. Write test: verify papers have correct distribution

---

#### 10. **What would you do differently if building this from scratch?**

**Answer (shows maturity, understanding of trade-offs):**

**Would change:**
1. **PostgreSQL instead of MySQL:** Better JSON support, auto-scaling easier, pgvector for embeddings
2. **FastAPI is good, but maybe add caching layer (Redis):** RAG searches heavily cached ("Newton's Laws" queried 100x/day)
3. **Separate question generation into async task queue (Celery):** Generating 100 questions takes time, don't block API
4. **Better error handling:** Current system aborts, should gracefully degrade
5. **Monitoring/logging:** Add Prometheus metrics, structured logging (not just print statements)

**Would keep:**
✅ Hybrid LLM (smart choice)
✅ RAG architecture (grounded generation)
✅ Modular services (testable, maintainable)
✅ Docker-first (reproducible)

---

### What You Should Know Cold (Memorize These)

| Concept | Quick Explain |
|---------|---------------|
| **RAG** | Index syllabus → retrieve relevant chunks on demand → include in AI prompt for grounded questions |
| **Hybrid LLM** | Try Ollama (local, free) → fallback to xAI/OpenAI (online, powerful) |
| **Vector DB (Qdrant)** | Semantic search via embeddings; find similar ideas, not keyword match |
| **Deduplication** | Track `used_image_ids` set; skip questions with images already in paper |
| **Single upload location** | All files → `backend/data/uploads/` with subdirs; simplifies backup & management |
| **Modular services** | Each service (question gen, paper gen, RAG, grading, images) independent → testable |
| **Docker Compose** | One `docker-compose up --build` = entire stack (backend, MySQL, Qdrant, frontend, nginx) |

---

### Interview Preparation Checklist

- [ ] Can explain RAG in < 2 minutes?
- [ ] Can walk through complete flow (upload → grading)?
- [ ] Know why each database (MySQL vs Qdrant)?
- [ ] Understand hybrid LLM fallback logic?
- [ ] Can explain deduplication algorithm?
- [ ] Know scaling bottlenecks and solutions?
- [ ] Have 2-3 challenges + solutions ready?
- [ ] Can design a new feature using existing architecture?

---

## License

MIT License

## Contact

For questions or issues, please open an issue in the repository.

---

**Last Updated**: May 19, 2026  
**Status**: Active Development  
**Python Version**: 3.10+  
**Node.js Version**: 18+
