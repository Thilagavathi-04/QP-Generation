"""
Image retrieval helpers for question generation.

This module keeps the public helper API used by image integration, but avoids
the LangGraph dependency that was failing on the current Python runtime.
"""

from typing import Any, Dict, List, Optional

from services.image_service import ImageService
from services.image_web_search import ImageWebSearch
from services.rag_config import logger


def _normalize_keywords(question_context: str, required_keywords: Optional[List[str]] = None) -> List[str]:
    keywords = [kw.strip() for kw in (required_keywords or []) if kw and kw.strip()]

    if keywords:
        return keywords[:20]

    text = (question_context or "").lower()
    stop_words = {
        "the", "a", "an", "and", "or", "is", "are", "was", "were",
        "in", "on", "at", "to", "of", "for", "with", "by", "from",
        "what", "which", "how", "why", "draw", "show", "explain",
        "describe", "define", "list", "state", "write",
    }

    for word in text.split():
        cleaned = word.strip('.,;:?!()[]{}"\'')
        if cleaned.isalpha() and len(cleaned) > 3 and cleaned not in stop_words:
            keywords.append(cleaned)

    seen = set()
    deduped = []
    for keyword in keywords:
        normalized = keyword.lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(keyword)

    return deduped[:20]


class ImageAgentSystem:
    """Simple image retrieval pipeline without LangGraph."""

    def __init__(self):
        self._initialized = True

    @staticmethod
    def _calculate_match_score(image: Dict[str, Any], question_context: str, required_keywords: List[str]) -> float:
        score = 0.0

        try:
            image_keywords = str(image.get("keywords", "")).lower()
            image_desc = str(image.get("description", "")).lower()

            matched_keywords = 0
            for keyword in required_keywords[:5]:
                lower_keyword = keyword.lower()
                if lower_keyword in image_keywords or lower_keyword in image_desc:
                    matched_keywords += 1

            if required_keywords:
                score += (matched_keywords / min(len(required_keywords), 5)) * 0.7

            context_terms = [term for term in question_context.lower().split() if len(term) > 3]
            context_hits = sum(1 for term in context_terms[:10] if term in image_keywords or term in image_desc)
            if context_terms:
                score += (context_hits / min(len(context_terms), 10)) * 0.3

            if image.get("source_type") == "pdf_extraction":
                score = min(1.0, score + 0.1)

        except Exception as exc:
            logger.error(f"Error calculating image match score: {exc}")
            score = 0.5

        return max(0.0, min(1.0, score))

    def get_image_for_question(
        self,
        question_context: str,
        required_keywords: Optional[List[str]] = None,
        allow_database: bool = True,
    ) -> Optional[Dict[str, Any]]:
        try:
            keywords = _normalize_keywords(question_context, required_keywords)
            query = " ".join(keywords) if keywords else (question_context or "")[:100]

            if allow_database and query:
                db_images = ImageService.search_images(query, limit=5)
                if db_images:
                    best_db_image = max(
                        db_images,
                        key=lambda image: self._calculate_match_score(image, question_context, keywords),
                    )
                    db_confidence = self._calculate_match_score(best_db_image, question_context, keywords)
                    if db_confidence >= 0.6:
                        return {
                            "image_blob": best_db_image.get("image_blob"),
                            "keywords": best_db_image.get("keywords", ""),
                            "description": best_db_image.get("description", ""),
                            "source_type": best_db_image.get("source_type", "database"),
                            "confidence": db_confidence,
                            "file_name": best_db_image.get("file_name", "image.png"),
                            "id": best_db_image.get("id"),
                        }

            web_images = ImageWebSearch.search_images(query or question_context, limit=3)
            if web_images:
                for image in web_images:
                    image["confidence_score"] = ImageWebSearch.verify_image_matches_context(
                        image.get("image_blob", b""),
                        keywords,
                    )

                best_web_image = max(web_images, key=lambda image: image.get("confidence_score", 0.0))
                web_confidence = float(best_web_image.get("confidence_score", 0.0))
                if best_web_image.get("image_blob"):
                    return {
                        "image_blob": best_web_image.get("image_blob"),
                        "keywords": best_web_image.get("keywords", ""),
                        "description": best_web_image.get("description", ""),
                        "source_type": best_web_image.get("source_type", "web_search"),
                        "confidence": web_confidence,
                        "file_name": best_web_image.get("file_name", "image.png"),
                        "source_reference": best_web_image.get("source_reference"),
                    }

            logger.info(f"No suitable image found for question context: {question_context[:80]}")
            return None

        except Exception as exc:
            logger.error(f"Error in image agent: {exc}")
            return None


def get_image_agent_system() -> ImageAgentSystem:
    """Get or create the image agent system."""
    if not hasattr(get_image_agent_system, "_instance"):
        get_image_agent_system._instance = ImageAgentSystem()
    return get_image_agent_system._instance


def retrieve_image_for_question(
    question_context: str,
    keywords: Optional[List[str]] = None,
    allow_database: bool = True,
) -> Optional[Dict[str, Any]]:
    """Convenience function to retrieve an image for a question."""
    agent_system = get_image_agent_system()
    return agent_system.get_image_for_question(question_context, keywords, allow_database=allow_database)
