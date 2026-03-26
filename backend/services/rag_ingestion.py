import os
import pdfplumber
from docx import Document
from pathlib import Path
from typing import List, Dict, Any
from services.rag_config import SYLLABUS_DIR, BOOK_DIR, logger

def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from a PDF file using pdfplumber."""
    text = ""
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception as e:
        logger.error(f"Error extracting text from PDF {file_path}: {e}")
    return text

def extract_text_from_docx(file_path: str) -> str:
    """Extract text from a DOCX file using python-docx."""
    text = ""
    try:
        doc = Document(file_path)
        for para in doc.paragraphs:
            text += para.text + "\n"
    except Exception as e:
        logger.error(f"Error extracting text from DOCX {file_path}: {e}")
    return text

def get_ingested_documents(subject_id: str = None) -> List[Dict[str, Any]]:
    """
    Reads files from syllabus and book directories.
    If subject_id is provided, only reads files for that subject.
    """
    documents = []
    
    # Process Syllabus
    if SYLLABUS_DIR.exists():
        for file in SYLLABUS_DIR.iterdir():
            # The safe_subject_id logic in main.py uses filenames like {safe_subject_id}{extension}
            if subject_id and not file.name.startswith(subject_id):
                continue
                
            if file.suffix.lower() in ['.pdf', '.docx']:
                logger.info(f"Ingesting syllabus: {file.name}")
                text = ""
                if file.suffix.lower() == '.pdf':
                    text = extract_text_from_pdf(str(file))
                else:
                    text = extract_text_from_docx(str(file))
                
                if text.strip():
                    documents.append({
                        "text": text,
                        "metadata": {
                            "doc_type": "syllabus",
                            "subject_id": subject_id or file.stem,
                            "filename": file.name,
                            "source": str(file)
                        }
                    })

    # Process Textbooks
    if BOOK_DIR.exists():
        for file in BOOK_DIR.iterdir():
            if subject_id and not file.name.startswith(subject_id):
                continue
                
            if file.suffix.lower() in ['.pdf', '.docx']:
                logger.info(f"Ingesting textbook: {file.name}")
                text = ""
                if file.suffix.lower() == '.pdf':
                    text = extract_text_from_pdf(str(file))
                else:
                    text = extract_text_from_docx(str(file))
                
                if text.strip():
                    documents.append({
                        "text": text,
                        "metadata": {
                            "doc_type": "textbook",
                            "subject_id": subject_id or file.stem,
                            "filename": file.name,
                            "source": str(file)
                        }
                    })
                    
    return documents
