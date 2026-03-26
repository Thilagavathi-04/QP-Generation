import os
from pathlib import Path
import logging
from dotenv import load_dotenv

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent # Root of backend
load_dotenv(BASE_DIR / ".env")
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
SYLLABUS_DIR = UPLOAD_DIR / "syllabus"
BOOK_DIR = UPLOAD_DIR / "books"

# Create directories if they don't exist
for d in [DATA_DIR, UPLOAD_DIR, SYLLABUS_DIR, BOOK_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Qdrant settings (server mode)
QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
QDRANT_HTTPS = os.getenv("QDRANT_HTTPS", "false").strip().lower() in {"1", "true", "yes", "on"}
QDRANT_COLLECTION_NAME = "quest_generator_rag"

# Embedding settings
# Using a standard sentence-transformer model
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"

# Chunking settings
CHUNK_SIZE = 700  # Within 500-800 range
CHUNK_OVERLAP = 100 # Within 50-100 range

# Logging configuration (non-invasive)
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("RAG_PIPELINE")

# Reduce noisy third-party startup logs
logging.getLogger("sentence_transformers").setLevel(logging.WARNING)
logging.getLogger("transformers").setLevel(logging.WARNING)
logging.getLogger("huggingface_hub").setLevel(logging.ERROR)
logging.getLogger("httpx").setLevel(logging.WARNING)
