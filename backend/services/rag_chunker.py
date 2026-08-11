"""RAG Chunker Module.

Splits raw document text into retrieval-friendly chunks using semantic
sentence grouping with a size cap.
"""

import re
from functools import lru_cache
from typing import List, Dict, Any

import numpy as np
from sentence_transformers import SentenceTransformer

from services.rag_config import (
    CHUNK_SIZE,
    EMBEDDING_MODEL_NAME,
    SEMANTIC_CHUNK_MIN_CHAR_LENGTH,
    SEMANTIC_CHUNK_SIMILARITY_THRESHOLD,
    logger,
)


def _normalize_text(text: str) -> str:
    if not text:
        return ""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _split_into_sentence_units(text: str) -> List[str]:
    """Split text into sentence-sized units while preserving headings and bullets."""
    if not text:
        return []

    units: List[str] = []
    paragraphs = [paragraph.strip() for paragraph in re.split(r"\n\s*\n", text) if paragraph.strip()]
    for paragraph in paragraphs:
        paragraph_lines = [line.strip() for line in paragraph.split("\n") if line.strip()]
        for line in paragraph_lines:
            bullet_matches = re.findall(r"(?:^|\n)(?:[-*•]\s+[^\n]+)", line)
            if bullet_matches:
                units.extend([bullet.strip() for bullet in bullet_matches if bullet.strip()])
                continue

            if len(line) <= 1:
                continue

            sentence_parts = re.split(r"(?<=[.!?])\s+", line)
            if len(sentence_parts) == 1:
                units.append(line)
            else:
                units.extend([part.strip() for part in sentence_parts if part.strip()])

    return units


def _split_long_sentence(sentence: str, chunk_size: int) -> List[str]:
    if len(sentence) <= chunk_size:
        return [sentence]

    clauses = [part.strip() for part in re.split(r"(?<=[,;:])\s+", sentence) if part.strip()]
    if len(clauses) > 1:
        pieces: List[str] = []
        current = ""
        for clause in clauses:
            proposal = f"{current} {clause}".strip() if current else clause
            if len(proposal) <= chunk_size:
                current = proposal
            else:
                if current:
                    pieces.append(current)
                if len(clause) > chunk_size:
                    pieces.extend([clause[i:i + chunk_size].strip() for i in range(0, len(clause), chunk_size)])
                    current = ""
                else:
                    current = clause
        if current:
            pieces.append(current)
        return pieces

    return [sentence[i:i + chunk_size].strip() for i in range(0, len(sentence), chunk_size)]


@lru_cache(maxsize=1)
def _get_embedding_model() -> SentenceTransformer:
    return SentenceTransformer(EMBEDDING_MODEL_NAME)


def _cosine_similarity(vector_a: np.ndarray, vector_b: np.ndarray) -> float:
    denominator = float(np.linalg.norm(vector_a) * np.linalg.norm(vector_b))
    if not denominator:
        return 0.0
    return float(np.dot(vector_a, vector_b) / denominator)


def _build_semantic_chunks(sentences: List[str], chunk_size: int, similarity_threshold: float, min_chunk_length: int) -> List[str]:
    if not sentences:
        return []

    try:
        model = _get_embedding_model()
        embeddings = model.encode(sentences, normalize_embeddings=True)
    except Exception as exc:
        logger.warning("Semantic chunking model unavailable, falling back to sentence windowing: %s", exc)
        embeddings = None

    chunks: List[str] = []
    current_sentences: List[str] = []

    for index, sentence in enumerate(sentences):
        sentence = sentence.strip()
        if not sentence:
            continue

        sentence_parts = _split_long_sentence(sentence, chunk_size)
        for part_index, part in enumerate(sentence_parts):
            if not part:
                continue

            if len(part) > chunk_size:
                if current_sentences:
                    chunks.append(" ".join(current_sentences).strip())
                    current_sentences = []
                chunks.extend([part[i:i + chunk_size].strip() for i in range(0, len(part), chunk_size) if part[i:i + chunk_size].strip()])
                continue

            if not current_sentences:
                current_sentences = [part]
                continue

            proposed_text = " ".join(current_sentences + [part]).strip()
            if len(proposed_text) > chunk_size:
                chunks.append(" ".join(current_sentences).strip())
                current_sentences = [part]
                continue

            if embeddings is not None and part_index == 0:
                previous_embedding = embeddings[index - 1] if index > 0 else None
                current_embedding = embeddings[index]
                similarity = _cosine_similarity(previous_embedding, current_embedding) if previous_embedding is not None else 1.0
                current_text = " ".join(current_sentences).strip()
                if similarity < similarity_threshold and len(current_text) >= min_chunk_length:
                    chunks.append(current_text)
                    current_sentences = [part]
                    continue

            current_sentences.append(part)

    if current_sentences:
        chunks.append(" ".join(current_sentences).strip())

    return [chunk for chunk in chunks if chunk.strip()]


def process_documents_to_chunks(documents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Process documents into semantic chunk records for Qdrant insertion."""
    chunk_size = max(200, int(CHUNK_SIZE))
    similarity_threshold = float(SEMANTIC_CHUNK_SIMILARITY_THRESHOLD)
    min_chunk_length = max(100, int(SEMANTIC_CHUNK_MIN_CHAR_LENGTH))

    all_chunks: List[Dict[str, Any]] = []
    for doc_index, doc in enumerate(documents):
        raw_text = _normalize_text(doc.get("text", ""))
        if not raw_text:
            continue

        metadata = dict(doc.get("metadata", {}))
        sentence_units = _split_into_sentence_units(raw_text)
        document_chunks = _build_semantic_chunks(sentence_units, chunk_size, similarity_threshold, min_chunk_length)

        for chunk_index, chunk_text in enumerate(document_chunks):
            chunk_metadata = dict(metadata)
            chunk_metadata.update(
                {
                    "chunk_index": chunk_index,
                    "chunk_count": len(document_chunks),
                }
            )
            all_chunks.append(
                {
                    "text": chunk_text,
                    "metadata": chunk_metadata,
                    "chunk_id": f"{metadata.get('filename', 'doc')}-{doc_index}-{chunk_index}",
                }
            )

    logger.info(
        "Chunking completed: %s documents -> %s chunks (size=%s, similarity_threshold=%s)",
        len(documents),
        len(all_chunks),
        chunk_size,
        similarity_threshold,
    )
    return all_chunks
