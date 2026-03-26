"""RAG Chunker Module.

Splits raw document text into retrieval-friendly chunks using configured
character window + overlap.
"""

import re
from typing import List, Dict, Any

from services.rag_config import CHUNK_SIZE, CHUNK_OVERLAP, logger


def _normalize_text(text: str) -> str:
    if not text:
        return ""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _split_paragraph_if_needed(paragraph: str, chunk_size: int) -> List[str]:
    """Split an oversized paragraph into sentence-like pieces."""
    if len(paragraph) <= chunk_size:
        return [paragraph]

    sentences = re.split(r"(?<=[.!?])\s+", paragraph)
    if len(sentences) <= 1:
        return [paragraph[i:i + chunk_size] for i in range(0, len(paragraph), chunk_size)]

    parts = []
    current = ""
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        proposal = f"{current} {sentence}".strip() if current else sentence
        if len(proposal) <= chunk_size:
            current = proposal
        else:
            if current:
                parts.append(current)
            if len(sentence) > chunk_size:
                parts.extend([sentence[i:i + chunk_size] for i in range(0, len(sentence), chunk_size)])
                current = ""
            else:
                current = sentence

    if current:
        parts.append(current)
    return parts


def _window_with_overlap(segments: List[str], chunk_size: int, overlap: int) -> List[str]:
    if not segments:
        return []

    chunks: List[str] = []
    current = ""

    for segment in segments:
        segment = segment.strip()
        if not segment:
            continue

        proposal = f"{current}\n\n{segment}".strip() if current else segment
        if len(proposal) <= chunk_size:
            current = proposal
            continue

        if current:
            chunks.append(current)
            tail = current[-overlap:].strip() if overlap > 0 else ""
            current = f"{tail}\n\n{segment}".strip() if tail else segment
        else:
            chunks.append(segment[:chunk_size])
            tail = segment[chunk_size - overlap:chunk_size].strip() if overlap > 0 and chunk_size > overlap else ""
            rest = segment[chunk_size:]
            current = f"{tail} {rest}".strip() if tail else rest

        while len(current) > chunk_size:
            chunks.append(current[:chunk_size].strip())
            tail = current[chunk_size - overlap:chunk_size].strip() if overlap > 0 and chunk_size > overlap else ""
            current = f"{tail} {current[chunk_size:]}".strip() if tail else current[chunk_size:].strip()

    if current:
        chunks.append(current)

    return [chunk for chunk in chunks if chunk.strip()]


def process_documents_to_chunks(documents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Process documents into chunk records for Qdrant insertion."""
    chunk_size = max(200, int(CHUNK_SIZE))
    overlap = max(0, min(int(CHUNK_OVERLAP), chunk_size // 2))

    all_chunks: List[Dict[str, Any]] = []
    for doc_index, doc in enumerate(documents):
        raw_text = _normalize_text(doc.get("text", ""))
        if not raw_text:
            continue

        metadata = dict(doc.get("metadata", {}))
        paragraphs = [p.strip() for p in re.split(r"\n\s*\n", raw_text) if p.strip()]

        segments: List[str] = []
        for paragraph in paragraphs:
            segments.extend(_split_paragraph_if_needed(paragraph, chunk_size))

        document_chunks = _window_with_overlap(segments, chunk_size, overlap)

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
        "Chunking completed: %s documents -> %s chunks (size=%s, overlap=%s)",
        len(documents),
        len(all_chunks),
        chunk_size,
        overlap,
    )
    return all_chunks
