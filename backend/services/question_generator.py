"""
Question Generator Module
Handles AI-based question generation using Ollama
"""
import requests
import json
import re
import os
from pathlib import Path
from dotenv import load_dotenv
from functools import lru_cache
from typing import List, Optional, Dict, Any
import numpy as np
from sentence_transformers import SentenceTransformer
from services.rag_config import EMBEDDING_MODEL_NAME, QUESTION_DEDUPLICATION_THRESHOLD

# Load backend/.env for AI provider settings
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

AI_MODE = os.getenv("AI_MODE", "offline").strip().lower()  # offline | online | hybrid
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").strip()
OLLAMA_MODEL_NAME = os.getenv("OLLAMA_MODEL", "llama3.2:1b").strip()
XAI_BASE_URL = os.getenv("XAI_BASE_URL", "https://api.x.ai/v1").rstrip("/")
XAI_MODEL_NAME = os.getenv("XAI_MODEL", "grok-2-latest").strip()
XAI_API_KEY = os.getenv("XAI_API_KEY", "").strip()
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
OPENAI_MODEL_NAME = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
GEMINI_BASE_URL = os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta").rstrip("/")
GEMINI_MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-1.5-flash").strip()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()

LOW_MARK_PREFIX_PATTERN = re.compile(
    r"^\s*(?:"
    r"mcq\s*[:\-]?|"
    r"multiple\s+choice\s+question\s*[:\-]?|"
    r"fill\s+in\s+the\s+blank\s*[:\-]?"
    r")\s*",
    flags=re.IGNORECASE
)


def _is_placeholder_key(value: str) -> bool:
    lower = (value or "").strip().lower()
    return (not lower) or lower.startswith("your_") or lower.endswith("_here")


@lru_cache(maxsize=1)
def _get_dedup_model() -> SentenceTransformer:
    return SentenceTransformer(EMBEDDING_MODEL_NAME)


def deduplicate_questions(
    questions: List[Dict[str, Any]],
    threshold: Optional[float] = None
) -> List[Dict[str, Any]]:
    """
    Deduplicates a list of questions using semantic similarity matching.
    If two questions have cosine similarity above the threshold, the duplicate is removed.
    """
    if not questions or len(questions) <= 1:
        return questions

    target_threshold = threshold if threshold is not None else QUESTION_DEDUPLICATION_THRESHOLD
    contents = [str(q.get("content", "")).strip() for q in questions]

    try:
        model = _get_dedup_model()
        embeddings = model.encode(contents, normalize_embeddings=True)
    except Exception as exc:
        print(f"WARNING: Semantic deduplication model unavailable ({exc}), using exact string matching.")
        seen_texts = set()
        unique = []
        for q in questions:
            text = str(q.get("content", "")).strip().lower()
            if text not in seen_texts:
                seen_texts.add(text)
                unique.append(q)
        return unique

    kept_indices: List[int] = []

    for i, emb in enumerate(embeddings):
        if not contents[i]:
            continue
        
        is_duplicate = False
        for kept_idx in kept_indices:
            sim = float(np.dot(emb, embeddings[kept_idx]))
            if sim >= target_threshold:
                is_duplicate = True
                break
        
        if not is_duplicate:
            kept_indices.append(i)

    return [questions[idx] for idx in kept_indices]


def _find_json_candidate(text: str) -> Optional[str]:
    stack: List[str] = []
    in_string = False
    escaped = False
    start_index: Optional[int] = None

    for index, char in enumerate(text):
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
            continue

        if char in "[{":
            if not stack:
                start_index = index
            stack.append(char)
            continue

        if char in "]}":
            if not stack:
                continue
            opener = stack.pop()
            if (opener == "{" and char == "}") or (opener == "[" and char == "]"):
                if not stack:
                    return text[start_index:index + 1]

    return None


def _normalize_extracted_payload(parsed: Any) -> Dict[str, Any]:
    if isinstance(parsed, dict):
        if "questions" in parsed and isinstance(parsed["questions"], list):
            return parsed
        if "content" in parsed:
            return {"questions": [parsed]}
        for value in parsed.values():
            if isinstance(value, list) and all(isinstance(item, dict) for item in value):
                return {"questions": value}
        return parsed

    if isinstance(parsed, list):
        if all(isinstance(item, dict) for item in parsed):
            return {"questions": parsed}
        if parsed and all(isinstance(item, dict) for item in parsed):
            return {"questions": parsed}

    raise ValueError("Model response did not contain a valid JSON object or question list")


def _extract_json_payload(raw_text: str) -> Dict[str, Any]:
    text = (raw_text or "").strip()

    if not text:
        raise ValueError("Model response did not contain a valid JSON object or question list")

    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text).strip()

    candidates: List[str] = []
    if text:
        try:
            parsed = json.loads(text)
            return _normalize_extracted_payload(parsed)
        except Exception:
            pass

        candidate = _find_json_candidate(text)
        if candidate:
            candidates.append(candidate)

        # Fall back to brace-based extraction when the model emits prose before/after JSON.
        for match in re.finditer(r"(?:\{|\[)", text):
            start = match.start()
            end = text.rfind(("]" if text[start] == "[" else "}"), start)
            if end > start:
                candidate = text[start:end + 1]
                if candidate not in candidates:
                    candidates.append(candidate)

    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
            return _normalize_extracted_payload(parsed)
        except Exception:
            continue

    for obj_str in re.findall(r'\{[^{}]*?"content"\s*:[^{}]*?\}', text, flags=re.DOTALL):
        try:
            q_obj = json.loads(obj_str)
            if isinstance(q_obj, dict) and "content" in q_obj:
                return {"questions": [q_obj]}
        except Exception:
            pass

    list_matches = re.findall(r'\[[\s\S]*?\]', text)
    for candidate in list_matches:
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, list):
                return _normalize_extracted_payload(parsed)
        except Exception:
            pass

    raise ValueError("Model response did not contain a valid JSON object or question list")


def _get_active_ollama_url() -> str:
    url = OLLAMA_BASE_URL
    try:
        r = requests.get(f"{url}/api/tags", timeout=2)
        if r.status_code == 200:
            return url
    except Exception:
        pass

    if url != "http://localhost:11434":
        try:
            r = requests.get("http://localhost:11434/api/tags", timeout=2)
            if r.status_code == 200:
                return "http://localhost:11434"
        except Exception:
            pass

    return url


def _generate_with_ollama(prompt: str, timeout: int = 120, temperature: float = 0.2) -> Dict[str, Any]:
    url = _get_active_ollama_url()
    payload = {
        "model": OLLAMA_MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "keep_alive": "1h",
        "options": {
            "num_predict": 2048,
            "temperature": temperature,
            "top_p": 0.8,
            "stop": ["\n\nExplanation:", "\n\nReasoning:"]
        }
    }

    response = requests.post(f"{url}/api/generate", json=payload, timeout=timeout)
    if response.status_code != 200:
        raise RuntimeError(f"Ollama API Error: {response.status_code}")

    body = response.json()
    raw_text = (body.get("response") or body.get("thinking") or "").strip()
    return _extract_json_payload(raw_text)


def _generate_with_xai(prompt: str, timeout: int, temperature: float = 0.5) -> Dict[str, Any]:
    if _is_placeholder_key(XAI_API_KEY):
        raise RuntimeError("XAI_API_KEY is missing or placeholder")

    payload = {
        "model": XAI_MODEL_NAME,
        "messages": [
            {"role": "system", "content": "Return only valid JSON."},
            {"role": "user", "content": prompt}
        ],
        "temperature": temperature
    }

    headers = {
        "Authorization": f"Bearer {XAI_API_KEY}",
        "Content-Type": "application/json"
    }

    response = requests.post(
        f"{XAI_BASE_URL}/chat/completions",
        headers=headers,
        json=payload,
        timeout=timeout
    )
    if response.status_code != 200:
        raise RuntimeError(f"xAI API Error: {response.status_code} - {response.text[:200]}")

    body = response.json()
    choices = body.get("choices", [])
    if not choices:
        raise RuntimeError("xAI response did not contain choices")

    content = (((choices[0] or {}).get("message") or {}).get("content") or "").strip()
    return _extract_json_payload(content)


def _generate_with_openai(prompt: str, timeout: int, temperature: float = 0.5) -> Dict[str, Any]:
    if _is_placeholder_key(OPENAI_API_KEY):
        raise RuntimeError("OPENAI_API_KEY is missing or placeholder")

    payload = {
        "model": OPENAI_MODEL_NAME,
        "messages": [
            {"role": "system", "content": "Return only valid JSON."},
            {"role": "user", "content": prompt}
        ],
        "temperature": temperature,
    }

    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json"
    }

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
        raise RuntimeError("OpenAI response did not contain choices")

    content = (((choices[0] or {}).get("message") or {}).get("content") or "").strip()
    return _extract_json_payload(content)


def _generate_with_gemini(prompt: str, timeout: int, temperature: float = 0.5) -> Dict[str, Any]:
    if _is_placeholder_key(GEMINI_API_KEY):
        raise RuntimeError("GEMINI_API_KEY is missing or placeholder")

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": "Return only valid JSON."},
                    {"text": prompt}
                ]
            }
        ],
        "generationConfig": {
            "temperature": temperature,
        }
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
        raise RuntimeError("Gemini response did not contain candidates")

    parts = (((candidates[0] or {}).get("content") or {}).get("parts") or [])
    content = "\n".join([str(p.get("text", "")) for p in parts if isinstance(p, dict)]).strip()
    return _extract_json_payload(content)


def _resolve_provider_order(ai_provider: Optional[str]) -> List[str]:
    selected = (ai_provider or "auto").strip().lower()

    if selected in {"ollama", "xai", "openai", "gemini"}:
        return [selected]
    if selected == "offline":
        return ["ollama"]
    if selected == "online":
        return ["xai", "openai", "gemini"]
    if selected == "hybrid":
        return ["ollama", "xai", "openai", "gemini"]

    mode = AI_MODE if AI_MODE in {"offline", "online", "hybrid"} else "offline"
    if mode == "offline":
        return ["ollama"]
    if mode == "online":
        return ["xai", "openai", "gemini"]
    return ["ollama", "xai", "openai", "gemini"]


def generate_json_with_ai(
    prompt: str,
    timeout: int = 120,
    temperature: float = 0.5,
    ai_provider: Optional[str] = None,
) -> Dict[str, Any]:
    provider_order = _resolve_provider_order(ai_provider)
    errors = []

    for provider in provider_order:
        try:
            if provider == "ollama":
                return _generate_with_ollama(prompt=prompt, timeout=timeout, temperature=temperature)
            if provider == "xai":
                return _generate_with_xai(prompt=prompt, timeout=timeout, temperature=temperature)
            if provider == "openai":
                return _generate_with_openai(prompt=prompt, timeout=timeout, temperature=temperature)
            if provider == "gemini":
                return _generate_with_gemini(prompt=prompt, timeout=timeout, temperature=temperature)
            errors.append(f"Unknown provider: {provider}")
        except Exception as exc:
            errors.append(f"{provider} failed: {exc}")

    raise RuntimeError("; ".join(errors) if errors else "No AI provider configured")


def _ollama_available() -> bool:
    url = _get_active_ollama_url()
    try:
        response = requests.get(f"{url}/api/tags", timeout=2)
        if response.status_code != 200:
            return False
        models = response.json().get("models", [])
        model_exists = any(
            m.get("name") == OLLAMA_MODEL_NAME or m.get("name", "").startswith(f"{OLLAMA_MODEL_NAME}:")
            for m in models
        )
        if not model_exists:
            print(f"WARNING: Model {OLLAMA_MODEL_NAME} not found in Ollama")
        return True
    except Exception:
        return False


def _xai_available() -> bool:
    if _is_placeholder_key(XAI_API_KEY):
        return False
    try:
        response = requests.get(
            f"{XAI_BASE_URL}/models",
            headers={"Authorization": f"Bearer {XAI_API_KEY}"},
            timeout=8
        )
        return response.status_code == 200
    except Exception:
        return False


def _openai_available() -> bool:
    if _is_placeholder_key(OPENAI_API_KEY):
        return False
    try:
        response = requests.get(
            f"{OPENAI_BASE_URL}/models",
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
            timeout=8,
        )
        return response.status_code == 200
    except Exception:
        return False


def _gemini_available() -> bool:
    if _is_placeholder_key(GEMINI_API_KEY):
        return False
    try:
        response = requests.get(
            f"{GEMINI_BASE_URL}/models?key={GEMINI_API_KEY}",
            timeout=8,
        )
        return response.status_code == 200
    except Exception:
        return False


def sanitize_low_mark_question_content(content: str) -> str:
    cleaned = LOW_MARK_PREFIX_PATTERN.sub("", content or "").strip()
    cleaned = normalize_match_the_following_content(cleaned)
    return cleaned


def normalize_match_the_following_content(content: str) -> str:
    text = (content or "").strip()
    if not re.match(r"^\s*match\s+the\s+following", text, flags=re.IGNORECASE):
        return text

    text = re.sub(r"^\s*match\s+the\s+following\s*[:\-]?\s*", "Match the following:\n", text, flags=re.IGNORECASE)
    text = re.sub(r"(?i)column\s*a\s*:\s*", "", text)
    text = re.sub(r"(?i)column\s*b\s*:\s*", "", text)
    text = re.sub(r"\s*;\s*", "\n", text)
    text = re.sub(r"\s+(?=\d+\))", "\n", text)
    text = re.sub(r"\n{2,}", "\n", text)

    pair_lines = []
    for line in text.splitlines():
        stripped = line.strip()
        if re.match(r"^\d+\)\s*.+\s*-\s*.+$", stripped):
            pair_lines.append(stripped)

    if pair_lines:
        normalized_pairs = []
        for index, line in enumerate(pair_lines[:4], 1):
            body = re.sub(r"^\d+\)\s*", "", line).strip()
            normalized_pairs.append(f"{index}) {body}")
        return "Match the following:\n" + "\n".join(normalized_pairs)

    return text.strip()


def is_match_the_following_question(content: str) -> bool:
    return bool(re.match(r"^\s*match\s+the\s+following", content or "", flags=re.IGNORECASE))


def has_exactly_four_match_pairs(content: str) -> bool:
    if not is_match_the_following_question(content):
        return True
    pairs = re.findall(r"(?m)^\s*\d+\)\s*.+\s*-\s*.+$", content or "")
    return len(pairs) == 4

def get_marks_instruction(marks):
    if marks <= 0.5:
        return "Use short, direct recall or low-complexity conceptual questions. Keep answers brief and factual."
    elif marks <= 1:
        return "Use short, direct recall or low-complexity conceptual questions. Keep answers brief and factual."
    elif marks <= 2:
        return "Focus on concise conceptual understanding with a brief explanation or purpose. Keep expected answers to 2-4 lines."
    elif marks <= 3:
        return "Focus on understanding and simple application with a short explanation and one small example. Keep answers to 4-6 lines."
    elif marks <= 5:
        return "Focus on application and analysis with a clear explanation, one example, and key comparison points. Keep answers to 6-10 lines."
    elif marks <= 7:
        return "Focus on application and analysis with a step-by-step explanation and an example. Keep answers to 10-15 lines."
    elif marks <= 10:
        return "Focus on analysis with deeper explanation, reasoning, and examples. Keep answers to 15-20 lines."
    elif marks <= 12:
        return "Focus on analysis and evaluation with structured reasoning and problem-solving. Keep answers to 20-25 lines."
    elif marks == 14:
        return "Focus on evaluation with justification, trade-offs, and strong reasoning. Keep answers to 25-30 lines."
    elif marks <= 15:
        return "Focus on evaluation and creation with comparative reasoning and applied examples. Keep answers to 30+ lines."
    elif marks <= 18:
        return "Focus on creation using real-world scenarios, multi-step reasoning, and integrated concepts. Keep answers to 35+ lines."
    elif marks <= 20:
        return "Focus on advanced creation with a case study, design logic, and justification. Keep answers to 40+ lines."
    else:
        return "Focus on advanced creation with a case study, design logic, and justification. Keep answers to 40+ lines."

def get_blooms_level(marks):
    if marks <= 1:
        return "Remember, Understand"
    elif marks <= 2:
        return "Understand"
    elif marks <= 3:
        return "Understand, Apply"
    elif marks <= 5:
        return "Apply, Analyze"
    elif marks <= 7:
        return "Apply, Analyze"
    elif marks <= 10:
        return "Analyze"
    elif marks <= 12:
        return "Analyze, Evaluate"
    elif marks <= 14:
        return "Evaluate"
    elif marks <= 15:
        return "Evaluate, Create"
    else:
        return "Create"

def get_blooms_instruction(level):
    mapping = {
        "Remember": "Use verbs like define, list, identify, name.",
        "Understand": "Use verbs like explain, summarize, describe.",
        "Apply": "Use verbs like solve, use, implement, demonstrate.",
        "Analyze": "Use verbs like analyze, compare, differentiate, examine.",
        "Evaluate": "Use verbs like evaluate, justify, critique, argue.",
        "Create": "Use verbs like design, develop, create, propose."
    }
    levels = [item.strip() for item in (level or "").split(",") if item.strip()]
    instructions = [mapping[item] for item in levels if item in mapping]
    return " ".join(instructions)

def test_ollama_connection(ai_provider: Optional[str] = None):
    """
    Test AI provider connectivity based on AI_MODE
    Returns True if at least one configured provider is reachable
    """
    provider_order = _resolve_provider_order(ai_provider)

    for provider in provider_order:
        if provider == "ollama" and _ollama_available():
            return True
        if provider == "xai" and _xai_available():
            return True
        if provider == "openai" and _openai_available():
            return True
        if provider == "gemini" and _gemini_available():
            return True
    return False


def generate_questions_with_ollama(
    topics: List[str],
    count: int,
    marks: float,
    difficulty: str,
    part_name: str,
    context: Optional[str] = None,
    ai_provider: Optional[str] = None,
    blooms_level: Optional[str] = None,
    cancel_check: Optional[Any] = None,
    progress_callback: Optional[Any] = None,
) -> List[Dict[str, Any]]:
    """
    Generate questions using Ollama AI model with retry logic to ensure count is reached
    """
    all_questions = []
    max_attempts = 10
    attempt = 0
    
    CHUNK_SIZE = 5

    # Keep prompts compact and stable. Large topic lists cause Ollama reasoning drift and invalid JSON.
    unique_topics = []
    seen_topics = set()
    for topic in topics:
        clean_topic = str(topic).strip()
        if not clean_topic or clean_topic in seen_topics:
            continue
        seen_topics.add(clean_topic)
        unique_topics.append(clean_topic)
    sample_topics = unique_topics[:12] if len(unique_topics) > 12 else unique_topics

    while len(all_questions) < count and attempt < max_attempts:
        if cancel_check and cancel_check():
            print("Question generation cancelled via cancel_check.")
            break
        attempt += 1
        remaining_count = count - len(all_questions)
        sub_count = min(remaining_count, CHUNK_SIZE)
        
        # --- START: DYNAMIC PROMPT SELECTION ---
        if marks <= 1:
            # SPECIALIZED PROMPT FOR LOW-MARK QUESTIONS (MCQ, Fill-in-the-blank, etc.)
            prompt = f"""
            You are an expert in creating simple, direct questions. Your task is to generate EXACTLY {sub_count} questions.

            STRICT CONSTRAINTS:
            1. Question Types Allowed: ONLY "Multiple Choice Question (MCQ)", "Fill in the blank", "True/False", or "Match the following".
            2. Topics: {', '.join(sample_topics)}
            3. Difficulty: {difficulty}
            4. Marks: {marks}

            ABSOLUTE RULES (NON-NEGOTIABLE):
            - DO NOT generate any definitional questions (e.g., "Define...", "What is...", "Explain...").
            - DO NOT generate any "list" or "name" questions.
            - The question MUST be one of the allowed types.
            - DO NOT mention the "unit" or any academic course context in the question content itself.

            OUTPUT REQUIREMENTS:
            - Return ONLY a valid JSON object with a key "questions" containing an array of EXACTLY {sub_count} question objects.
            - Each object must have "content", "marks", "difficulty", "topic", and "unit".
            
            Example JSON Structure:
            {{
              "questions": [
                {{
                  "content": "True or False: A binary tree can have more than two children.",
                  "marks": {marks},
                  "difficulty": "{difficulty}",
                  "topic": "Trees",
                  "unit": "3"
                }}
              ]
            }}
            """
        else:
            # ORIGINAL PROMPT FOR HIGHER-MARK QUESTIONS
            marks_instruction = get_marks_instruction(marks)
            effective_blooms_level = blooms_level or get_blooms_level(marks)
            blooms_instruction = get_blooms_instruction(effective_blooms_level)

            prompt = f"""
            You are a professional academic question paper generator.

            Task: Generate exactly {sub_count} questions.

            Strictly use only these topics: {', '.join(sample_topics)}
            Difficulty: {difficulty}
            Marks per question: {marks}
            Bloom level: {effective_blooms_level}
            {f"Grounding context: {context[:800]}" if context else ""}

            REQUIRED OUTPUT FORMAT:
            - Return ONLY raw JSON with no markdown, no code fences, no explanation, and no reasoning.
            - Entire response must be valid JSON.
            - Top-level object must be {{"questions": [ ... ]}}.
            - Array length must be exactly {sub_count}.
            - Each question object must contain only these keys:
              "content", "marks", "difficulty", "topic", "unit"
            - "content" must be a full question text.
            - "marks" must be a number: {marks}
            - "difficulty" must be "{difficulty}"
            - "topic" must be a topic from the provided list.
            - "unit" must be a unit number as a string.

            Content rules:
            - {marks_instruction}
            - {blooms_instruction}
            - Do not include any text before or after the JSON.
            - Do not include analysis, planning, or examples outside JSON.

            Example JSON:
            {{
              "questions": [
                {{
                  "content": "Describe the main difference between ...",
                  "marks": {marks},
                  "difficulty": "{difficulty}",
                  "topic": "{sample_topics[0] if sample_topics else 'Topic'}",
                  "unit": "1"
                }}
              ]
            }}
            """

        # --- END: DYNAMIC PROMPT SELECTION ---

        # Track the Bloom level used in the prompt for attaching to each question

        blooms_for_prompt: Optional[str] = None
        if marks > 1:
            blooms_for_prompt = effective_blooms_level

        try:
            try:
                parsed_data = generate_json_with_ai(
                    prompt=prompt,
                    timeout=3000,
                    temperature=0.5,
                    ai_provider=ai_provider,
                )
                batch_questions = []

                if isinstance(parsed_data, dict):
                    if "questions" in parsed_data:
                        batch_questions = parsed_data["questions"]
                    elif any(isinstance(v, list) for v in parsed_data.values()):
                        for v in parsed_data.values():
                            if isinstance(v, list):
                                batch_questions = v
                                break
                    elif "content" in parsed_data:
                        batch_questions = [parsed_data]
                elif isinstance(parsed_data, list):
                    batch_questions = parsed_data

                if not isinstance(batch_questions, list):
                    continue

                # Clean and validate each question to prevent 422 errors
                for q in batch_questions:
                    if not isinstance(q, dict) or "content" not in q:
                        continue

                    raw_content = str(q.get("content", "")).strip()
                    if marks <= 1:
                        raw_content = sanitize_low_mark_question_content(raw_content)
                        if not has_exactly_four_match_pairs(raw_content):
                            continue
                    
                    # Force conversion to expected types (especially strings for unit/topic/content)
                    cleaned_q = {
                        "content": raw_content,
                        "marks": float(q.get("marks", marks)) if q.get("marks") is not None else marks,
                        "difficulty": str(q.get("difficulty", difficulty)).lower(),
                        "topic": str(q.get("topic", topics[0] if topics else "")).strip(),
                        "unit": str(q.get("unit", "1")).strip(),
                        "part": part_name,
                        "blooms_level": blooms_for_prompt,
                    }
                    
                    if cleaned_q["content"]:
                        all_questions.append(cleaned_q)

                # Apply semantic deduplication after processing each batch
                all_questions = deduplicate_questions(all_questions)
                if progress_callback:
                    try:
                        progress_callback(min(len(all_questions), count), count)
                    except Exception as p_err:
                        print(f"Progress callback error: {p_err}")

            except (json.JSONDecodeError, ValueError) as parse_err:
                print(f"Failed to parse JSON from attempt {attempt}: {parse_err}")
                continue
                
        except Exception as e:
            print(f"Error on attempt {attempt}: {e}")
            if attempt == max_attempts: break
            continue

    # Final semantic deduplication pass
    all_questions = deduplicate_questions(all_questions)

    if len(all_questions) < count:
        print(f"WARNING: Final count ({len(all_questions)}) is still less than requested ({count}) after {max_attempts} attempts.")
    
    return all_questions[:count]
