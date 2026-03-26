import sys
import os
from pathlib import Path

# Add current directory to path so we can import our new modules
sys.path.append(os.getcwd())

from services.qdrant_client import sync_subject_files_to_qdrant
from services.rag_retrieval import retrieve_context, format_context_for_prompt
from services.rag_config import logger

# Force UTF-8 for console output on Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def run_test():
    print("\n=== STARTING RAG PIPELINE TEST ===\n")
    
    # Subject ID from existing files (e.g., '1234')
    subject_id = "1234"
    
    print(f"1. Indexing files for subject: {subject_id}...")
    try:
        sync_subject_files_to_qdrant(subject_id)
        print("   Indexing complete!")
    except Exception as e:
        print(f"   Indexing failed: {e}")
        return

    print(f"\n2. Testing retrieval for subject: {subject_id}...")
    # Testing with a generic query since I don't know the exact content of 1234.pdf
    query = "Explain the core concepts and topics mentioned in this document."
    
    retrieved_data = retrieve_context(query, subject_id=subject_id, top_k=3)
    
    if "message" in retrieved_data and not retrieved_data["syllabus_chunks"]:
        print(f"   Retrieval message: {retrieved_data['message']}")
    else:
        print("\n=== RETRIEVED SYLLABUS CHUNKS ===")
        for i, chunk in enumerate(retrieved_data.get("syllabus_chunks", [])):
            print(f"\n[Chunk {i+1}]: {chunk[:200]}...")
            
        print("\n=== RETRIEVED TEXTBOOK CHUNKS ===")
        for i, chunk in enumerate(retrieved_data.get("textbook_chunks", [])):
            print(f"\n[Chunk {i+1}]: {chunk[:200]}...")

    print("\n3. Formatted Context for Generator:")
    formatted_context = format_context_for_prompt(retrieved_data)
    print(formatted_context[:500] + "...")

    print("\n=== RAG PIPELINE TEST COMPLETE ===\n")

if __name__ == "__main__":
    run_test()
