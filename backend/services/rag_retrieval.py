from typing import List, Dict, Any, Optional
from services.qdrant_client import qdrant_manager
from services.rag_config import logger

def retrieve_context(query: str, subject_id: Optional[str] = None, top_k: int = 5) -> Dict[str, Any]:
    """
    Retrieves context from Qdrant with priority:
    1. Syllabus
    2. Textbook
    """
    if not qdrant_manager or not qdrant_manager.client:
        logger.warning("Qdrant manager not initialized.")
        return {
            "syllabus_chunks": [],
            "textbook_chunks": [],
            "message": "Retrieval system unavailable."
        }

    syllabus_chunks = []
    textbook_chunks = []
    
    try:
        logger.info(f"Querying syllabus for: {query}")
        syll_resp = qdrant_manager.query(
            query_text=query,
            n_results=top_k,
            subject_id=subject_id,
            doc_type="syllabus"
        )
        
        if syll_resp['documents'] and syll_resp['documents'][0]:
            syllabus_chunks = syll_resp['documents'][0]

        logger.info(f"Querying textbook for: {query}")
        text_resp = qdrant_manager.query(
            query_text=query,
            n_results=top_k,
            subject_id=subject_id,
            doc_type="textbook"
        )
        
        if text_resp['documents'] and text_resp['documents'][0]:
            textbook_chunks = text_resp['documents'][0]

    except Exception as e:
        logger.error(f"Error during retrieval: {e}")

    if not syllabus_chunks and not textbook_chunks:
        return {
            "message": "No relevant content found in uploaded syllabus/textbook.",
            "syllabus_chunks": [],
            "textbook_chunks": []
        }

    return {
        "syllabus_chunks": syllabus_chunks,
        "textbook_chunks": textbook_chunks
    }

def format_context_for_prompt(retrieved_data: Dict[str, Any]) -> str:
    """Formats the retrieved chunks into a string for injection into the prompt."""
    if not retrieved_data.get("syllabus_chunks") and not retrieved_data.get("textbook_chunks"):
        return retrieved_data.get("message", "No relevant content found.")
        
    context_parts = []
    
    if retrieved_data.get("syllabus_chunks"):
        context_parts.append("GROUNDING CONTEXT FROM SYLLABUS:")
        for i, chunk in enumerate(retrieved_data["syllabus_chunks"]):
            context_parts.append(f"[Syllabus Chunk {i+1}]: {chunk}")
        
    if retrieved_data.get("textbook_chunks"):
        context_parts.append("GROUNDING CONTEXT FROM TEXTBOOK:")
        for i, chunk in enumerate(retrieved_data["textbook_chunks"]):
            context_parts.append(f"[Textbook Chunk {i+1}]: {chunk}")
        
    return "\n\n".join(context_parts)
