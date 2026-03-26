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
from typing import List, Optional, Dict, Any

# Load backend/.env for AI provider settings
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

AI_MODE = os.getenv("AI_MODE", "offline").strip().lower()  # offline | online | hybrid
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").strip()
OLLAMA_MODEL_NAME = os.getenv("OLLAMA_MODEL", "mistral:latest").strip()
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


def _extract_json_payload(raw_text: str) -> Dict[str, Any]:
    text = (raw_text or "").strip()

    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text).strip()

    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
        raise ValueError("Model response was valid JSON but not a JSON object")
    except Exception:
        first = text.find("{")
        last = text.rfind("}")
        if first == -1 or last == -1 or last <= first:
            raise ValueError("Model response did not contain a JSON object")
        candidate = text[first:last + 1]
        parsed = json.loads(candidate)
        if isinstance(parsed, dict):
            return parsed
        raise ValueError("Extracted JSON payload was not a JSON object")


def _generate_with_ollama(prompt: str, timeout: int, temperature: float = 0.5) -> Dict[str, Any]:
    payload = {
        "model": OLLAMA_MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {
            "num_predict": 2048,
            "temperature": temperature,
            "top_p": 0.9
        }
    }

    response = requests.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload, timeout=timeout)
    if response.status_code != 200:
        raise RuntimeError(f"Ollama API Error: {response.status_code}")

    body = response.json()
    return _extract_json_payload(body.get("response", ""))


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
    try:
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
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
        return "Question Type: 'Fill in the blank', 'True/False', 'Multiple Choice Question (MCQ)', match the following."
    elif marks <= 1:
        return "Question Type: 'Fill in the blank', 'True/False', 'Multiple Choice Question (MCQ)', match the following."
    elif marks <= 2:
        return "Bloom's Level: Understand. Generate short answer questions with definition + brief explanation/purpose. Expected answer length: 2-4 lines. No detailed reasoning."
    elif marks <= 3:
        return "Bloom's Level: Understand, Apply. Generate short descriptive questions with explanation + small example. Expected answer length: 4-6 lines."
    elif marks <= 5:
        return "Bloom's Level: Apply, Analyze. Generate descriptive questions with explanation + example + key points. Expected answer length: 6-10 lines. Can include small code/algorithm/comparison."
    elif marks <= 7:
        return "Bloom's Level: Apply, Analyze. Generate moderately detailed questions with concept explanation + working + example. Expected answer length: 10-15 lines."
    elif marks <= 10:
        return "Bloom's Level: Analyze. Generate detailed questions with in-depth explanation + diagrams/examples. Expected answer length: 15-20 lines. May include derivations/coding/multiple concepts."
    elif marks <= 12:
        return "Bloom's Level: Analyze, Evaluate. Generate long-answer questions with theory + problem-solving + structured explanation. Expected answer length: 20-25 lines. Use diagrams/flowcharts where applicable."
    elif marks == 14:
        return "Bloom's Level: Evaluate. Generate advanced long-answer questions with deep explanation + analysis + justification. Expected answer length: 25-30 lines."
    elif marks <= 15:
        return "Bloom's Level: Evaluate, Create. Generate comprehensive questions covering theory + example + application. Expected answer length: 30+ lines."
    elif marks <= 18:
        return "Bloom's Level: Create. Generate complex multi-part questions with case study/real-world scenario and combined concepts. Expected answer length: 35+ lines."
    elif marks <= 20:
        return "Bloom's Level: Create (Mastery). Generate very advanced multi-step, multi-concept questions with case study + system design + analysis + justification. Expected answer length: 40+ lines."
    else:
        return "Bloom's Level: Create (Mastery). Generate very advanced multi-step, multi-concept questions with case study + system design + analysis + justification. Expected answer length: 40+ lines."

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
) -> List[Dict[str, Any]]:
    """
    Generate questions using Ollama AI model with retry logic to ensure count is reached
    """
    all_questions = []
    max_attempts = 3
    attempt = 0
    
    while len(all_questions) < count and attempt < max_attempts:
        attempt += 1
        remaining_count = count - len(all_questions)
        
        # --- START: DYNAMIC PROMPT SELECTION ---
        if marks <= 1:
            # SPECIALIZED PROMPT FOR LOW-MARK QUESTIONS (MCQ, Fill-in-the-blank, etc.)
            prompt = f"""
            You are an expert in creating simple, direct questions. Your task is to generate EXACTLY {remaining_count} questions.

            STRICT CONSTRAINTS:
            1. Question Types Allowed: ONLY "Multiple Choice Question (MCQ)", "Fill in the blank", "True/False", or "Match the following".
            2. Topics: {', '.join(topics)}
            3. Difficulty: {difficulty}
            4. Marks: {marks}

            ABSOLUTE RULES (NON-NEGOTIABLE):
            - DO NOT generate any definitional questions (e.g., "Define...", "What is...", "Explain...").
            - DO NOT generate any "list" or "name" questions.
            - The question MUST be one of the allowed types. For example:
              - "The capital of France is ______."
              - "True or False: The earth is flat."
              - "What is 2+2? A) 3, B) 4, C) 5"
                            - "Match the following:\n1) Apple - Vegetable\n2) Carrot - Flower\n3) Dog - Animal\n4) Rose - Fruit"
                        - For "Match the following", ALWAYS use EXACTLY this structure in content with exactly 4 pairs:
                            Match the following:
                            1) Item - Match
                            2) Item - Match
                            3) Item - Match
                            4) Item - Match
            - DO NOT mention the "unit" or any academic course context in the question content itself.

            OUTPUT REQUIREMENTS:
            - Return ONLY a valid JSON object with a key "questions" containing an array of EXACTLY {remaining_count} question objects.
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
            blooms_level = get_blooms_level(marks)
            blooms_instruction = get_blooms_instruction(blooms_level)

            prompt = f"""
            You are a professional academic question paper generator.

            Generate EXACTLY {remaining_count} questions.

            STRICT CONSTRAINTS:
            1. Topics: {', '.join(topics)}
            2. Difficulty: {difficulty}
            3. Marks per question: {marks}
            
            {f"Use the following grounding context from textbooks/syllabus: {context}" if context else ""}

            IMPORTANT RULES:

            1. MARKS-BASED STRUCTURE:
            - {marks_instruction}

            2. BLOOM'S TAXONOMY (VERY STRICT):
            - Each question MUST follow Bloom's level: {blooms_level}
            - {blooms_instruction}

            3. COMBINED RULE:
            - The question must match BOTH:
              ✔ marks (length/depth)
              ✔ Bloom’s level (thinking skill)

            FAILURE CONDITIONS:
            - Wrong cognitive level = INVALID
            - Wrong length for marks = INVALID

            OUTPUT REQUIREMENTS:
            1. Return ONLY a valid JSON object.
            2. The object MUST have a key named "questions" which is an array of exactly {remaining_count} question objects.
            3. Each question object must have exactly these keys:
               - "content": (string) The full text of the question
               - "marks": (float) {marks}
               - "difficulty": (string) "{difficulty}"
               - "topic": (string) one of the topics from the provided list
               - "unit": (string) the unit number
            
            STRICT JSON STRUCTURE:
            {{
              "questions": [
                {{
                  "content": "Distinct question?",
                  "marks": {marks},
                  "difficulty": "{difficulty}",
                  "topic": "...",
                  "unit": "1"
                }}
              ]
            }}
            
            Do not include any conversational text, markdown formatting (except the JSON itself), or explanations.
            """
        # --- END: DYNAMIC PROMPT SELECTION ---

        try:
            try:
                parsed_data = generate_json_with_ai(
                    prompt=prompt,
                    timeout=300,
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
                        "part": part_name
                    }
                    
                    if cleaned_q["content"] and len(all_questions) < count:
                        all_questions.append(cleaned_q)

            except (json.JSONDecodeError, ValueError) as parse_err:
                print(f"Failed to parse JSON from attempt {attempt}: {parse_err}")
                continue
                
        except Exception as e:
            print(f"Error on attempt {attempt}: {e}")
            if attempt == max_attempts: break
            continue

    if len(all_questions) < count:
        print(f"WARNING: Final count ({len(all_questions)}) is still less than requested ({count}) after {max_attempts} attempts.")
    
    return all_questions
