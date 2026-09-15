"""
Image-Based Question Generation
===============================
Generates exam questions FROM images using vision-capable AI providers and
embeds the source image alongside each question.

Image sources supported:
- web          : images fetched live from the web (DuckDuckGo / Google CSE / Unsplash)
- user         : teacher/user uploaded images stored in the database
- book         : images extracted from uploaded textbooks/PDFs
"""

from __future__ import annotations

import base64
import io
import json
import os
import re
import random
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from dotenv import load_dotenv

from services.rag_config import logger

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

GEMINI_BASE_URL = os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta").rstrip("/")
GEMINI_MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-1.5-flash").strip()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()

OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
OPENAI_MODEL_NAME = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()

XAI_BASE_URL = os.getenv("XAI_BASE_URL", "https://api.x.ai/v1").rstrip("/")
XAI_MODEL_NAME = os.getenv("XAI_MODEL", "grok-2-latest").strip()
XAI_API_KEY = os.getenv("XAI_API_KEY", "").strip()

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").strip()


# ---------------------------------------------------------------------------
# Small helpers (duplicated locally to keep this module import-light)
# ---------------------------------------------------------------------------

def _is_placeholder_key(value: str) -> bool:
    lower = (value or "").strip().lower()
    return (not lower) or lower.startswith("your_") or lower.endswith("_here")


def _clean_topic_name(topic: str) -> str:
    """Strip things like ' (Unit 3)' from a topic string."""
    text = (topic or "").strip()
    text = re.sub(r"\s*\(unit\s*\d+\)\s*$", "", text, flags=re.IGNORECASE).strip()
    text = re.sub(r"\s*-\s*unit\s*\d+\s*$", "", text, flags=re.IGNORECASE).strip()
    return text or topic or "General"


def _extract_unit_from_topic(topic: str, default: str = "1") -> str:
    match = re.search(r"unit\s*(\d+)", topic or "", flags=re.IGNORECASE)
    return match.group(1) if match else default


def _detect_mime(image_blob: bytes) -> str:
    if not image_blob:
        return "image/png"
    if image_blob[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if image_blob[:2] in (b"\xff\xd8",):
        return "image/jpeg"
    if image_blob[:4] == b"RIFF" and image_blob[8:12] == b"WEBP":
        return "image/webp"
    if image_blob[:4] == b"GIF8":
        return "image/gif"
    if image_blob[:2] == b"BM":
        return "image/bmp"
    return "image/png"


def _bytes_to_data_url(image_blob: bytes) -> str:
    return f"data:{_detect_mime(image_blob)};base64,{base64.b64encode(image_blob).decode('ascii')}"


def _normalize_sources(image_sources: Optional[List[str]]) -> set:
    """Normalize user-friendly source names to internal source type strings."""
    if not image_sources:
        return {"web_search", "user_uploaded", "pdf_extraction", "book", "textbook", "database", "user"}

    normalized: set = set()
    for s in image_sources:
        s_clean = (s or "").strip().lower()
        if not s_clean:
            continue
        if s_clean in {"web", "web_search", "websearch"}:
            normalized.add("web_search")
        elif s_clean in {"user", "user_uploaded", "user_upload", "upload", "database", "db"}:
            normalized.add("user_uploaded")
            normalized.add("user")
            normalized.add("database")
        elif s_clean in {"book", "books", "pdf", "pdf_extraction", "textbook", "pdf_extracted"}:
            normalized.add("pdf_extraction")
            normalized.add("book")
            normalized.add("textbook")
        elif s_clean == "all":
            normalized.update({"web_search", "user_uploaded", "user", "database", "pdf_extraction", "book", "textbook"})
    return normalized


# ---------------------------------------------------------------------------
# Vision-capable AI providers
# ---------------------------------------------------------------------------

def _build_vision_prompt(
    *,
    marks: float,
    difficulty: str,
    topic: str,
    part_name: str,
    blooms_level: Optional[str] = None,
    context: Optional[str] = None,
) -> str:
    """Build a prompt that instructs the model to ask a question ABOUT the image."""
    try:
        from services.question_generator import (
            get_marks_instruction,
            get_blooms_level,
            get_blooms_instruction,
        )
        marks_instruction = get_marks_instruction(marks)
        level = blooms_level or get_blooms_level(marks)
        blooms_instruction = get_blooms_instruction(level)
    except Exception:
        marks_instruction = "Frame a short descriptive question."
        level = None
        blooms_instruction = ""

    return f"""
    You are a professional academic question paper generator.
    Analyze the diagram/figure in the provided image carefully and generate exactly ONE exam question that
    asks the student to interpret, label, explain or answer based on WHAT IS SHOWN IN THE IMAGE.

    The question MUST reference the image (e.g. "Based on the diagram shown below, ..." or "Label the parts of the figure given below and explain each.").

    STRICT CONSTRAINTS:
    1. Topic: {topic}
    2. Difficulty: {difficulty}
    3. Marks: {marks} -> {marks_instruction}
    4. Bloom's level: {level or 'Understand'} -> {blooms_instruction}
    {'5. Use this grounding context when helpful: ' + context[:800] if context else ''}

    OUTPUT REQUIREMENTS:
    - Return ONLY a valid JSON object with these fields:
      {{"content": "the question referencing the image", "topic": "{topic}", "marks": {marks}, "difficulty": "{difficulty}"}}
    """


def _extract_question_json(raw_text: str) -> Optional[Dict[str, Any]]:
    text = (raw_text or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text).strip()
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass
    first = text.find("{")
    last = text.rfind("}")
    if first != -1 and last != -1 and last > first:
        try:
            parsed = json.loads(text[first:last + 1])
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass
    return None


def _generate_with_gemini_vision(image_blob: bytes, prompt: str, timeout: int = 120, temperature: float = 0.5) -> Optional[Dict[str, Any]]:
    if _is_placeholder_key(GEMINI_API_KEY):
        raise RuntimeError("GEMINI_API_KEY is missing or placeholder")
    import requests

    mime = _detect_mime(image_blob)
    payload = {
        "contents": [
            {
                "parts": [
                    {"inline_data": {"mime_type": mime, "data": base64.b64encode(image_blob).decode("ascii")}},
                    {"text": prompt},
                ]
            }
        ],
        "generationConfig": {"temperature": temperature},
    }
    response = requests.post(
        f"{GEMINI_BASE_URL}/models/{GEMINI_MODEL_NAME}:generateContent?key={GEMINI_API_KEY}",
        json=payload,
        timeout=timeout,
    )
    if response.status_code != 200:
        raise RuntimeError(f"Gemini API Error: {response.status_code} - {response.text[:200]}")
    body = response.json()
    candidates = body.get("candidates", [])
    if not candidates:
        return None
    parts = (((candidates[0] or {}).get("content") or {}).get("parts") or [])
    content = "\n".join([str(p.get("text", "")) for p in parts if isinstance(p, dict)]).strip()
    return _extract_question_json(content)


def _generate_with_openai_vision(image_blob: bytes, prompt: str, timeout: int = 120, temperature: float = 0.5) -> Optional[Dict[str, Any]]:
    if _is_placeholder_key(OPENAI_API_KEY):
        raise RuntimeError("OPENAI_API_KEY is missing or placeholder")
    import requests

    data_url = _bytes_to_data_url(image_blob)
    payload = {
        "model": OPENAI_MODEL_NAME,
        "messages": [
            {"role": "system", "content": "Return only valid JSON."},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            },
        ],
        "temperature": temperature,
    }
    headers = {"Authorization": f"Bearer {OPENAI_API_KEY}"}
    response = requests.post(
        f"{OPENAI_BASE_URL}/chat/completions",
        headers=headers,
        json=payload,
        timeout=timeout,
    )
    if response.status_code != 200:
        raise RuntimeError(f"OpenAI API Error: {response.status_code} - {response.text[:200]}")
    body = response.json()
    choices = body.get("choices", [])
    if not choices:
        return None
    content = (((choices[0] or {}).get("message") or {}).get("content") or "").strip()
    return _extract_question_json(content)


def _generate_with_xai_vision(image_blob: bytes, prompt: str, timeout: int = 120, temperature: float = 0.5) -> Optional[Dict[str, Any]]:
    if _is_placeholder_key(XAI_API_KEY):
        raise RuntimeError("XAI_API_KEY is missing or placeholder")
    import requests

    data_url = _bytes_to_data_url(image_blob)
    payload = {
        "model": XAI_MODEL_NAME,
        "messages": [
            {"role": "system", "content": "Return only valid JSON."},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            },
        ],
        "temperature": temperature,
    }
    headers = {"Authorization": f"Bearer {XAI_API_KEY}"}
    response = requests.post(
        f"{XAI_BASE_URL}/chat/completions",
        headers=headers,
        json=payload,
        timeout=timeout,
    )
    if response.status_code != 200:
        raise RuntimeError(f"xAI API Error: {response.status_code} - {response.text[:200]}")
    body = response.json()
    choices = body.get("choices", [])
    if not choices:
        return None
    content = (((choices[0] or {}).get("message") or {}).get("content") or "").strip()
    return _extract_question_json(content)


def _get_ollama_vision_model() -> Optional[str]:
    try:
        import requests

        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3)
        if response.status_code != 200:
            return None
        names = [m.get("name", "") for m in response.json().get("models", [])]
        vision_keywords = ("vision", "llava", "minicpm", "moondream", "bakllava", "llama3.2")
        for name in names:
            lower = name.lower()
            if any(kw in lower for kw in vision_keywords):
                return name
    except Exception as exc:
        logger.debug(f"Could not list ollama models: {exc}")
    return None


def _generate_with_ollama_vision(image_blob: bytes, prompt: str, timeout: int = 300, temperature: float = 0.5) -> Optional[Dict[str, Any]]:
    model = _get_ollama_vision_model()
    if not model:
        raise RuntimeError("No vision-capable Ollama model found")
    import requests

    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "images": [base64.b64encode(image_blob).decode("ascii")],
        "options": {"temperature": temperature, "num_predict": 1024},
    }
    response = requests.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload, timeout=timeout)
    if response.status_code != 200:
        raise RuntimeError(f"Ollama API Error: {response.status_code}")
    body = response.json()
    return _extract_question_json(body.get("response", ""))


def _vision_provider_order(ai_provider: Optional[str]) -> List[str]:
    selected = (ai_provider or "auto").strip().lower()
    if selected in {"gemini", "openai", "xai", "ollama"}:
        return [selected]
    if selected == "online":
        return ["gemini", "openai", "xai"]
    if selected == "offline":
        return ["ollama"]
    return ["gemini", "openai", "xai", "ollama"]


def _text_fallback_question(
    *,
    marks: float,
    difficulty: str,
    topic: str,
    part_name: str,
    blooms_level: Optional[str] = None,
    image_meta: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """
    Fallback when no vision-capable model is available: generate a question that
    asks students to interpret the figure on the given topic, using the image
    keywords/description as context. The image is still embedded in the paper.
    """
    try:
        from services.question_generator import generate_json_with_ai

        meta = image_meta or {}
        raw_desc = str(meta.get("description") or meta.get("caption") or meta.get("keywords") or "")[:600]
        # Clean metadata so we never leak raw URLs / extraction artifacts into a question
        caption = re.sub(r"(https?://\S+|www\.\S+)", "", raw_desc, flags=re.IGNORECASE)
        caption = re.sub(r"\s+", " ", caption).strip()
        if not caption or len(caption) < 20:
            keywords = re.sub(r"(https?://\S+|www\.\S+)", "", str(meta.get("keywords") or ""), flags=re.IGNORECASE)
            caption = re.sub(r"\s+", " ", keywords).strip()
        caption = caption[:300]
        prompt = f"""
        You are a professional academic question paper generator.
        An image (diagram/figure) related to the topic "{_clean_topic_name(topic)}" will be shown to the student.
        The image is described as: {caption or "a diagram relevant to the topic"}.

        Generate EXACTLY ONE exam question that asks the student to interpret, label, explain or answer
        based on the diagram/figure shown in the image. The question MUST reference the image,
        e.g. "Based on the diagram shown below, ..." or "Label the parts of the figure given below and explain each."

        STRICT CONSTRAINTS:
        1. Topic: {_clean_topic_name(topic)}
        2. Difficulty: {difficulty}
        3. Marks: {marks}

        OUTPUT REQUIREMENTS:
        - Return ONLY a valid JSON object: {{"content": "the question referencing the image", "topic": "{topic}", "marks": {marks}, "difficulty": "{difficulty}"}}
        """
        parsed = generate_json_with_ai(prompt=prompt, timeout=300, temperature=0.5, ai_provider=None)
        if parsed and str(parsed.get("content", "")).strip() and len(str(parsed.get("content", ""))) > 10:
            return {
                "content": str(parsed["content"]).strip(),
                "marks": float(parsed.get("marks", marks) or marks),
                "difficulty": str(parsed.get("difficulty", difficulty) or difficulty).lower(),
                "topic": _clean_topic_name(str(parsed.get("topic", topic) or topic)),
                "unit": _extract_unit_from_topic(topic),
                "part": part_name,
                "blooms_level": blooms_level,
                "source": "image_generated",
            }
    except Exception as exc:
        logger.warning(f"Text fallback question generation failed: {exc}")
    return None


def generate_question_from_image(
    image_blob: bytes,
    *,
    marks: float,
    difficulty: str,
    topic: str,
    part_name: str,
    blooms_level: Optional[str] = None,
    context: Optional[str] = None,
    ai_provider: Optional[str] = None,
    image_meta: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """Generate a single exam question based on the content of the supplied image."""
    if not image_blob:
        return None

    prompt = _build_vision_prompt(
        marks=marks,
        difficulty=difficulty,
        topic=_clean_topic_name(topic),
        part_name=part_name,
        blooms_level=blooms_level,
        context=context,
    )

    order = _vision_provider_order(ai_provider)
    errors = []
    for provider in order:
        try:
            if provider == "gemini":
                parsed = _generate_with_gemini_vision(image_blob, prompt)
            elif provider == "openai":
                parsed = _generate_with_openai_vision(image_blob, prompt)
            elif provider == "xai":
                parsed = _generate_with_xai_vision(image_blob, prompt)
            elif provider == "ollama":
                parsed = _generate_with_ollama_vision(image_blob, prompt)
            else:
                continue

            if parsed and str(parsed.get("content", "")).strip():
                content = str(parsed["content"]).strip()
                if len(content) > 10:
                    return {
                        "content": content,
                        "marks": float(parsed.get("marks", marks) or marks),
                        "difficulty": str(parsed.get("difficulty", difficulty) or difficulty).lower(),
                        "topic": _clean_topic_name(str(parsed.get("topic", topic) or topic)),
                        "unit": _extract_unit_from_topic(topic),
                        "part": part_name,
                        "blooms_level": blooms_level,
                        "source": "image_generated",
                    }
        except Exception as exc:
            errors.append(f"{provider} failed: {exc}")
            continue

    # Fallback: no vision model available - use image metadata as context
    logger.warning(f"Vision providers unavailable ({'; '.join(errors) or 'none configured'}), using text fallback with image metadata")
    return _text_fallback_question(
        marks=marks,
        difficulty=difficulty,
        topic=topic,
        part_name=part_name,
        blooms_level=blooms_level,
        image_meta=image_meta,
    )


# ---------------------------------------------------------------------------
# Candidate image collection
# ---------------------------------------------------------------------------

def _is_logo_or_icon(img: Dict[str, Any]) -> bool:
    if "logo" in str(img.get("keywords", "")).lower():
        return True
    width = img.get("width") or 0
    height = img.get("height") or 0
    if width and height and (width < 150 or height < 150):
        return True
    return False


def _blob_signature(image_blob: bytes) -> str:
    return base64.b64encode(image_blob[:2048]).decode("ascii")


def collect_image_candidates(
    topics: List[str],
    image_sources: Optional[List[str]] = None,
    limit: int = 12,
) -> List[Dict[str, Any]]:
    """
    Gather candidate images from the database (user uploads / book extracts)
    and from live web search for the given topics.
    """
    sources = _normalize_sources(image_sources)
    topic_terms = [_clean_topic_name(t) for t in (topics or []) if _clean_topic_name(t)]
    if not topic_terms:
        topic_terms = ["general"]

    candidates: List[Dict[str, Any]] = []
    seen_sigs: set = set()

    allow_db = bool(sources & {"user_uploaded", "user", "database", "pdf_extraction", "book", "textbook"})
    allow_web = "web_search" in sources

    def add_candidate(image: Dict[str, Any], score: float) -> None:
        blob = image.get("image_blob")
        if not blob:
            return
        sig = _blob_signature(blob)
        if sig in seen_sigs:
            return
        if _is_logo_or_icon(image):
            return
        seen_sigs.add(sig)
        image["confidence"] = float(score)
        candidates.append(image)

    # 1) Database candidates (user uploaded + book/pdf extracted)
    if allow_db:
        try:
            from services.image_service import ImageService
            from services.image_integration import calculate_image_match_score
        except Exception as exc:
            logger.warning(f"image service unavailable: {exc}")
            allow_db = False

        if allow_db:
            seen_ids: set = set()
            for term in topic_terms[:8]:
                try:
                    rows = ImageService.search_images(term, limit=8)
                except Exception as exc:
                    logger.debug(f"DB image search '{term}' failed: {exc}")
                    continue
                for row in rows:
                    img_id = row.get("id")
                    if img_id and img_id in seen_ids:
                        continue
                    src_type = (row.get("source_type") or "").strip().lower()
                    if src_type not in {"user_uploaded", "user", "pdf_extraction", "book", "textbook", "database", ""}:
                        continue
                    row["confidence"] = calculate_image_match_score(term, row, term.split())
                    seen_ids.add(img_id)
                    add_candidate(row, row["confidence"])
                if len(candidates) >= limit:
                    break

            # If not enough, broaden with recent images
            if len(candidates) < limit:
                try:
                    all_images = ImageService.get_all_images(limit=200)
                    for row in all_images:
                        src_type = (row.get("source_type") or "").strip().lower()
                        if src_type not in {"user_uploaded", "user", "pdf_extraction", "book", "textbook", "database"}:
                            continue
                        if row.get("id") in seen_ids:
                            continue
                        add_candidate(row, 0.5)
                        if len(candidates) >= limit:
                            break
                except Exception as exc:
                    logger.debug(f"Broad DB image scan failed: {exc}")

    # 2) Live web search candidates
    if allow_web and len(candidates) < limit:
        try:
            from services.image_web_search import ImageWebSearch
        except Exception as exc:
            logger.warning(f"image web search unavailable: {exc}")
            allow_web = False

        if allow_web:
            needed = limit - len(candidates)
            for term in topic_terms[:6]:
                if len(candidates) >= limit:
                    break
                try:
                    web_images = ImageWebSearch.search_images(
                        term,
                        limit=max(1, min(3, needed)),
                        min_resolution=300,
                    )
                except Exception as exc:
                    logger.warning(f"Web image search '{term}' failed: {exc}")
                    continue
                for wimg in web_images:
                    if wimg.get("source_type") != "web_search":
                        wimg["source_type"] = "web_search"
                    wimg["keywords"] = wimg.get("keywords") or term
                    wimg["description"] = wimg.get("description") or f"Web search image for {_clean_topic_name(term)}"
                    wimg["file_name"] = wimg.get("file_name") or "web_search_image.png"
                    score = wimg.get("confidence_score")
                    if score is None:
                        try:
                            score = ImageWebSearch.verify_image_matches_context(
                                wimg.get("image_blob", b""),
                                term.split(),
                            )
                        except Exception:
                            score = 0.5
                    add_candidate(wimg, score)
                    if len(candidates) >= limit:
                        break

    candidates.sort(key=lambda c: c.get("confidence", 0.0), reverse=True)
    return candidates[:limit]


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def generate_image_questions(
    topics: List[str],
    count: int,
    marks: float,
    difficulty: str,
    part_name: str,
    image_sources: Optional[List[str]] = None,
    ai_provider: Optional[str] = None,
    context: Optional[str] = None,
    blooms_level: Optional[str] = None,
    cancel_check: Optional[Any] = None,
    progress_callback: Optional[Any] = None,
) -> List[Dict[str, Any]]:
    """
    Generate up to `count` questions, each derived from a different image that was
    either web-searched or sourced from user uploads / book extractions.

    Each returned question carries:
      - image_id   : id of the persisted image (web images are persisted on first use)
      - image_data : blob + metadata for embedding in the question paper
    """
    if count <= 0:
        return []

    candidates = collect_image_candidates(topics, image_sources, limit=max(12, count * 3))
    if not candidates:
        logger.warning("No candidate images found for image-based question generation")
        return []

    random.shuffle(candidates)

    results: List[Dict[str, Any]] = []
    for cand in candidates:
        if cancel_check and cancel_check():
            break
        if len(results) >= count:
            break

        q = generate_question_from_image(
            cand.get("image_blob"),
            marks=marks,
            difficulty=difficulty,
            topic=cand.get("keywords") or (topics[0] if topics else "General"),
            part_name=part_name,
            blooms_level=blooms_level or None,
            context=context,
            ai_provider=ai_provider,
            image_meta=cand,
        )
        if not q:
            continue

        image_id = cand.get("id")
        if not image_id and cand.get("image_blob"):
            try:
                from services.image_service import ImageService

                image_id = ImageService.save_image(
                    keywords=cand.get("keywords", ""),
                    description=cand.get("description", "Image based question"),
                    image_blob=cand["image_blob"],
                    source_type=cand.get("source_type", "web_search"),
                    source_reference=cand.get("source_reference"),
                    file_name=cand.get("file_name"),
                )
            except Exception as exc:
                logger.warning(f"Could not persist image: {exc}")
                image_id = None

        q["image_id"] = image_id
        q["image_data"] = {
            "image_blob": cand.get("image_blob"),
            "id": image_id,
            "source_type": cand.get("source_type", "database"),
            "description": cand.get("description", ""),
            "keywords": cand.get("keywords", ""),
            "file_name": cand.get("file_name", "image.png"),
            "confidence": cand.get("confidence", 0.0),
        }
        results.append(q)

        if progress_callback:
            try:
                progress_callback(min(len(results), count), count)
            except Exception as p_err:
                logger.debug(f"progress callback error: {p_err}")

    if results:
        try:
            from services.question_generator import deduplicate_questions

            results = deduplicate_questions(results)
        except Exception:
            pass

    return results[:count]


def encode_image_data_for_json(question: Dict[str, Any]) -> Dict[str, Any]:
    """Convert binary image data to a base64 data URL so the dict is JSON-serializable."""
    out = dict(question)
    image_data = (question or {}).get("image_data")
    if isinstance(image_data, dict) and image_data.get("image_blob"):
        out["image_data"] = dict(image_data)
        out["image_data"]["data_url"] = _bytes_to_data_url(image_data["image_blob"])
        out["image_data"]["image_blob"] = None
    return out