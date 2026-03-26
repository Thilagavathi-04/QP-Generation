# Quest Generator


## 1) What this project does

Quest Generator is an AI-assisted exam workflow system that helps you:
- Manage subjects, units, topics, and question banks
- Generate questions using hybrid AI mode (offline Ollama + online xAI fallback)
- Build question papers from blueprints
- Generate answer scripts and evaluate submissions
- Ground generation with RAG context from uploaded syllabus/books

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
  - `backend/data/uploads/blueprints/`
  - `backend/data/uploads/books/`
  - `backend/data/uploads/papers/`
  - `backend/data/uploads/student_submissions/`
  - `backend/data/uploads/syllabus/`
- MySQL persistent data (Docker bind mount): `mysql_data/`
- Qdrant local storage (if mounted): `qdrant_storage/`

---

## 3) Prerequisites

- Python 3.10+
- Node.js 18+
- Docker
- Ollama installed

Pull required model:

```bash
ollama pull mistral:latest
```

Start Ollama:

```bash
ollama serve
```

---

## 4) Infrastructure setup (Docker)

### MySQL

```bash
docker run -d \
  --name quest-mysql \
  -e MYSQL_ROOT_PASSWORD=root123 \
  -e MYSQL_DATABASE=quest_generator \
  -e MYSQL_USER=quest_user \
  -e MYSQL_PASSWORD=quest_pass \
  -p 3306:3306 \
  -v $(pwd)/mysql_data:/var/lib/mysql \
  mysql:8
```

### Qdrant

```bash
docker run -d \
  --name qdrant-server \
  -p 6333:6333 \
  -v $(pwd)/qdrant_storage:/qdrant/storage \
  qdrant/qdrant
```

---

## 5) Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Configure `backend/.env`:

```env
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME=quest_generator
DB_USER=quest_user
DB_PASSWORD=quest_pass

AI_MODE=hybrid
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral:latest
XAI_BASE_URL=https://api.x.ai/v1
XAI_MODEL=grok-2-latest
XAI_API_KEY=your_xai_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
OPENAI_API_KEY=your_openai_api_key_here
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
GEMINI_MODEL=gemini-1.5-flash
GEMINI_API_KEY=your_gemini_api_key_here

PORT=8010
DEBUG=True

QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_API_KEY=your-secret-key
QDRANT_HTTPS=false
```

Run backend:

```bash
cd backend
source venv/bin/activate
python main.py
```

Backend URLs:
- API root: `http://localhost:8010/`
- Docs: `http://localhost:8010/docs`

---

## 6) Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:
- `http://localhost:5173`

---

## 7) End-to-end run (recommended order)

1. Start Docker services (`quest-mysql`, `qdrant-server`)
2. (Recommended for hybrid) Start Ollama (`ollama serve`) and set valid `XAI_API_KEY`
3. Start backend (`python main.py` from `backend`)
4. Start frontend (`npm run dev` from `frontend`)

Per request provider override is supported on question generation APIs using `ai_provider`:
- `auto` (uses `AI_MODE`)
- `ollama`
- `xai`
- `openai`
- `gemini`

---

## 8) Notes on generated data

- Relational records are in MySQL (`quest_generator` DB)
- RAG vectors are in Qdrant collection `quest_generator_rag`
- Uploaded files are in `backend/data/uploads/`

---

## 9) Common issues

### Port 8010 already in use

```bash
fuser -k 8010/tcp
```

### Backend says "Database connection failed"

Check MySQL container status:

```bash
docker ps
docker start quest-mysql
```

### RAG not returning context

Check Qdrant container and point count:

```bash
docker start qdrant-server
```

### Ollama not reachable

```bash
ollama serve
curl http://localhost:11434/api/tags
```

---

## 10) Project layout

```text
Quest-generator/
├── backend/
│   ├── core/
│   ├── data/
│   │   └── uploads/
│   ├── services/
│   ├── tests/
│   ├── main.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
├── mysql_data/
├── qdrant_storage/
└── README.md
```

---

## 11) Cleanup decision made

- Duplicate backend modules removed:
  - `backend/question_generator.py`
  - `backend/rag_chunker.py`
- Canonical modules are under `backend/services/`
