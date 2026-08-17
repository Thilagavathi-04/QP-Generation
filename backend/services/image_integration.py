"""
Image Integration Helper for Question Paper Generation
Provides utilities for integrating images into generated question papers
"""

import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from pathlib import Path
from services.rag_config import logger
import tempfile

# Try to import image agents, but don't fail if unavailable
try:
    from services.image_agents import retrieve_image_for_question
except Exception as exc:
    retrieve_image_for_question = None
    logger.warning(f"Image agents module not available: {exc}")


BASE_DIR = Path(__file__).resolve().parent.parent
IMAGE_TRACE_DIR = BASE_DIR / "logs"
IMAGE_TRACE_DIR.mkdir(parents=True, exist_ok=True)


def _slugify(value: str, limit: int = 32) -> str:
    slug = []
    for char in (value or "").lower():
        if char.isalnum():
            slug.append(char)
        elif slug and slug[-1] != "_":
            slug.append("_")
    result = "".join(slug).strip("_")
    return result[:limit] or "image"


def _describe_source_type(source_type: str | None) -> str:
    normalized = (source_type or "").strip().lower()
    if normalized in {"pdf_extraction", "textbook", "book"}:
        return "textbook image"
    if normalized == "web_search":
        return "web searched image"
    if normalized in {"database", "db"}:
        return "database image"
    return normalized or "unknown"


class ImageGenerationTrace:
    def __init__(self, question_text: str, trace_label: str | None = None):
        self.question_text = question_text or ""
        self.trace_label = trace_label or "image"
        self.created_at = datetime.now()
        safe_label = _slugify(self.trace_label)
        self.file_path = IMAGE_TRACE_DIR / f"image_generation_{self.created_at:%Y%m%d_%H%M%S}_{safe_label}_{uuid.uuid4().hex[:8]}.md"
        self.lines = []
        self.add_header()

    def add_header(self) -> None:
        self.lines = [
            f"# Image Generation Trace",
            f"- Created at: {self.created_at:%Y-%m-%d %H:%M:%S}",
            f"- Label: {self.trace_label}",
            f"- Question: {self.question_text[:220]}",
            "",
            "## Steps",
        ]
        self._write()

    def add_step(self, title: str, detail: str) -> None:
        self.lines.append(f"- {title}: {detail}")
        self._write()

    def finalize(self, outcome: str, image_data: Dict[str, Any] | None = None, detail: str | None = None) -> None:
        self.lines.extend([
            "",
            "## Result",
            f"- Outcome: {outcome}",
        ])
        if image_data:
            self.lines.append(f"- Source: {_describe_source_type(image_data.get('source_type'))}")
            if image_data.get("description"):
                self.lines.append(f"- Description: {image_data.get('description')}")
            if image_data.get("file_name"):
                self.lines.append(f"- File name: {image_data.get('file_name')}")
        if detail:
            self.lines.append(f"- Detail: {detail}")
        self._write()

    def _write(self) -> None:
        self.file_path.write_text("\n".join(self.lines) + "\n", encoding="utf-8")


def _trace_from_source_type(source_type: str | None) -> str:
    return _describe_source_type(source_type)


def _source_priority(source_type: str | None) -> int:
    normalized = (source_type or "").strip().lower()
    if normalized in {"pdf_extraction", "textbook", "book"}:
        return 0
    if normalized in {"database", "db"}:
        return 1
    if normalized == "web_search":
        return 2
    return 3


def flip_image_vertically(image_blob: bytes) -> bytes:
    """
    Flip/invert image vertically (up -> down) before saving to database.
    This corrects images that are extracted in inverted orientation from PDFs.
    
    Args:
        image_blob: Binary image data (PNG/JPG)
        
    Returns:
        Vertically flipped image blob
    """
    try:
        from PIL import Image
        import io
        import numpy as np
        
        # Open image from blob
        img = Image.open(io.BytesIO(image_blob))
        img = img.convert('RGB')
        
        # Convert to numpy array
        img_array = np.array(img)
        
        # Apply vertical flip: reverse first axis (rows)
        # image_array[::-1, :, :] flips up -> down
        flipped_array = img_array[::-1, :, :]
        
        # Convert back to PIL Image
        flipped_img = Image.fromarray(flipped_array, 'RGB')
        
        # Save as PNG blob
        output = io.BytesIO()
        flipped_img.save(output, format='PNG', optimize=True)
        flipped_blob = output.getvalue()
        
        logger.info(f"Applied vertical flip to image: {len(image_blob)} bytes -> {len(flipped_blob)} bytes")
        return flipped_blob
        
    except Exception as e:
        logger.error(f"Error flipping image vertically: {e}", exc_info=True)
        return image_blob


def detect_image_required_in_question(question_text: str) -> bool:
    """
    Detect if a question requires an image based on keywords.
    
    Args:
        question_text: The question content
        
    Returns:
        True if image is likely needed
    """
    image_keywords = [
        # Core visualization keywords
        'draw', 'sketch', 'diagram', 'graph', 'circuit', 'structure',
        'flowchart', 'figure', 'apparatus', 'setup', 'arrange', 'show',
        'illustrate', 'design', 'explain with diagram', 'represent',
        'image', 'picture', 'photograph', 'chart', 'table', 'plot',
        'curve', 'map', 'layout', 'model', 'schematic',
        # Algorithm & data structure keywords
        'algorithm', 'tree', 'vertex', 'vertices', 'node', 'nodes',
        'path', 'edge', 'edges', 'cycle', 'flow', 'network',
        'state machine', 'automaton', 'transition',
        # Sorting algorithms (CRITICAL: questions often ask to compare or analyze sorts)
        'sort', 'sorting', 'heap sort', 'quick sort', 'merge sort', 'bubble sort',
        'insertion sort', 'selection sort', 'shell sort', 'radix sort',
        # Data structures
        'linked list', 'queue', 'stack', 'hash', 'hash table', 'hash map',
        'binary search tree', 'bst', 'avl tree', 'red black', 'trie',
        # Analysis & representation keywords
        'represent', 'representation', 'demonstrate', 'comparison', 'compare',
        'explain', 'depict', 'visual', 'visualization', 'construct', 
        'complexity', 'time complexity', 'space complexity', 'performance',
        'analyze', 'analysis', 'justify', 'trace', 'step', 'execute',
        'recursive', 'recursion', 'backtrack', 'dynamic programming',
        'traverse', 'traversal', 'search', 'path finding',
        # Graph/Network keywords
        'graph', 'vertex', 'edge', 'weighted', 'directed', 'undirected',
        'shortest path', 'spanning tree', 'topological', 'cycle detection'
    ]
    
    question_lower = question_text.lower()
    return any(keyword in question_lower for keyword in image_keywords)


def extract_keywords_from_question(question_text: str) -> list:
    """
    Extract relevant keywords from the question for image search.
    
    Args:
        question_text: The question content
        
    Returns:
        List of extracted keywords
    """
    keywords = []
    
    # Extract nouns and meaningful phrases
    stop_words = {'the', 'a', 'an', 'and', 'or', 'is', 'are', 'was', 'were',
                  'draw', 'show', 'explain', 'describe', 'define', 'of', 'for',
                  'with', 'by', 'from', 'to', 'in', 'on', 'at', 'be', 'have',
                  'has', 'do', 'does', 'did', 'will', 'would', 'could', 'should'}
    
    words = question_text.lower().split()
    for word in words:
        word_clean = word.strip('.,;:?!')
        if len(word_clean) > 3 and word_clean not in stop_words and word_clean.isalpha():
            keywords.append(word_clean)
    
    # Remove duplicates while preserving order
    seen = set()
    unique_keywords = []
    for kw in keywords:
        if kw not in seen:
            seen.add(kw)
            unique_keywords.append(kw)
    
    return unique_keywords[:15]  # Return top 15 keywords


def get_image_for_question(
    question_text: str,
    used_image_ids: set = None,
    trace_label: str | None = None,
) -> Optional[Dict[str, Any]]:
    """
    Retrieve an image for a question using multiple strategies:
    1. Try database (from uploaded textbooks/books)
    2. Try web search
    
    Args:
        question_text: The question content
        used_image_ids: Set of image IDs already used in the paper to avoid duplicates
        
    Returns:
        Dictionary with image data or None
    """
    try:
        trace = ImageGenerationTrace(question_text, trace_label=trace_label)
        if used_image_ids is None:
            used_image_ids = set()
        trace.add_step("Start", "Image lookup requested")

        if not detect_image_required_in_question(question_text):
            logger.debug(f"Question doesn't require image")
            trace.add_step("Detection", "Question does not require an image")
            trace.finalize("not_required")
            return None
        
        keywords = extract_keywords_from_question(question_text)
        trace.add_step("Keywords", ", ".join(keywords) if keywords else "No keywords extracted")
        
        if not keywords:
            logger.warning(f"Could not extract keywords from question")
            trace.finalize("no_keywords")
            return None
        
        logger.info(f"Retrieving image for question with keywords: {keywords}")
        
        # Strategy 1: Try to get image directly from database
        logger.debug(f"Strategy 1: Searching database...")
        trace.add_step("Database search", f"Trying database keywords: {', '.join(keywords[:5])}")
        image_data = _search_database_for_image(question_text, keywords, used_image_ids)
        if image_data:
            logger.info(f"✅ Found image in database")
            trace.add_step("Database result", f"Selected {_trace_from_source_type(image_data.get('source_type'))}")
            trace.finalize("selected", image_data=image_data)
            return image_data
        
        # Strategy 2: Try web search
        if retrieve_image_for_question:
            logger.debug(f"Strategy 2: Trying web search with keywords: {keywords[:3]}")
            trace.add_step("Web search", f"Searching web for keywords: {', '.join(keywords[:3])}")
            try:
                image_data = retrieve_image_for_question(question_text, keywords, allow_database=False)
                if image_data:
                    # Persist web image so future queries can fetch from DB/FS by keyword.
                    if image_data.get('image_blob'):
                        try:
                            from services.image_service import ImageService

                            persisted_id = ImageService.save_image(
                                keywords=", ".join(keywords),
                                description=image_data.get('description', 'Web search image'),
                                image_blob=image_data['image_blob'],
                                source_type=image_data.get('source_type', 'web_search'),
                                source_reference=image_data.get('source_reference'),
                                file_name=image_data.get('file_name'),
                            )
                            if persisted_id:
                                image_data['id'] = persisted_id
                        except Exception as persist_error:
                            logger.warning(f"Unable to persist web image: {persist_error}")

                    logger.info(f"✅ Found image via web search - source: {image_data.get('source_type')}")
                    trace.add_step("Web search result", f"Retrieved {_trace_from_source_type(image_data.get('source_type'))} (confidence: {image_data.get('confidence', 'N/A')})")
                    trace.finalize("selected", image_data=image_data)
                    return image_data
                else:
                    logger.debug(f"Web search returned no images for keywords: {keywords[:3]}")
                    trace.add_step("Web search result", "No images found from web search")
            except Exception as web_error:
                logger.error(f"Web search failed: {web_error}", exc_info=True)
                trace.add_step("Web search error", f"Exception: {str(web_error)[:100]}")
        else:
            logger.warning(f"Image agents helper not available - web search disabled")
            trace.add_step("Web search", "Image agents helper is unavailable")
        
        logger.warning(f"Could not retrieve image from database or web search for keywords: {keywords}")
        trace.finalize("not_found")
        return None
        
    except Exception as e:
        logger.error(f"Error retrieving image for question: {e}")
        import traceback
        traceback.print_exc()
        try:
            if 'trace' in locals():
                trace.finalize("error", detail=str(e))
        except Exception:
            pass
        return None


MIN_IMAGE_MATCH_SCORE = 0.55
MIN_IMAGE_MATCH_MARGIN = 0.03

def calculate_image_match_score(question_text: str, img: Dict[str, Any], keywords: list) -> float:
    score = 0.0
    
    # Keyword overlap (Max 0.20)
    haystack = f"{img.get('keywords', '')} {img.get('description', '')} {img.get('caption', '')}".lower()
    keyword_matches = sum(1 for kw in keywords if kw.lower() in haystack)
    keyword_score = min(1.0, keyword_matches / max(1, len(keywords)))
    score += 0.20 * keyword_score
    
    # Try semantic similarity if embedding model is available (Max 0.45)
    semantic_score = 0.0
    try:
        from services.qdrant_client import qdrant_manager
        if qdrant_manager and qdrant_manager.embedding_model:
            import numpy as np
            q_vec = qdrant_manager.embedding_model.encode(question_text, normalize_embeddings=True)
            
            # Create a rich text representation of the image
            img_text = f"Caption: {img.get('caption', '')}. Keywords: {img.get('keywords', '')}. Context: {img.get('context', '')[:300]}"
            img_vec = qdrant_manager.embedding_model.encode(img_text, normalize_embeddings=True)
            
            semantic_score = float(np.dot(q_vec, img_vec))
            semantic_score = max(0.0, min(1.0, semantic_score))
            score += 0.45 * semantic_score
        else:
            score += 0.45 * keyword_score 
    except Exception as e:
        logger.debug(f"Semantic scoring failed: {e}")
        score += 0.45 * keyword_score
        
    # Caption exact matching is very strong (Max 0.25)
    caption = (img.get('caption') or '').lower()
    caption_score = 0.0
    if caption:
        caption_matches = sum(1 for kw in keywords if kw.lower() in caption)
        caption_score = min(1.0, caption_matches / max(1, len(keywords)))
    score += 0.25 * caption_score
    
    # Source priority penalty (Prefer textbooks, max 0.10)
    source_type = (img.get('source_type') or '').lower()
    if source_type in ['pdf_extraction', 'textbook', 'book']:
        score += 0.10
        
    return score


def _search_database_for_image(question_text: str, keywords: list, used_image_ids: set) -> Optional[Dict[str, Any]]:
    """
    Search database for images matching keywords and rank them by relevance.
    
    Args:
        question_text: Original question text for semantic matching
        keywords: List of keywords to search
        used_image_ids: Set of already-used image IDs
        
    Returns:
        Image data dict or None
    """
    try:
        from services.image_service import ImageService
        
        candidates = []
        seen_ids = set()

        # Try each keyword to find available images
        for keyword in keywords[:5]:  # Try first 5 keywords
            try:
                images = ImageService.search_images(keyword, limit=10)
                
                if images:
                    for img in images:
                        img_id = img.get('id')
                        if not img_id or img_id in used_image_ids or img_id in seen_ids:
                            continue
                            
                        # Filter out logos/icons
                        if (img.get('width', 1000) < 150 and img.get('height', 1000) < 150) or "logo" in img.get('keywords', '').lower():
                            continue

                        seen_ids.add(img_id)
                        
                        score = calculate_image_match_score(question_text, img, keywords)
                        candidates.append((score, img))
            except Exception as kw_error:
                logger.debug(f"Error searching for keyword '{keyword}': {kw_error}")
                continue

        if candidates:
            candidates.sort(key=lambda item: item[0], reverse=True)
            
            best_score, best_img = candidates[0]
            
            logger.info("--- Image Candidate Scoring ---")
            logger.info(f"Question: {question_text}")
            for rank, (score, img) in enumerate(candidates[:3]):
                logger.info(f"Candidate {rank+1}: score={score:.3f}, source={img.get('source_type')}, caption='{img.get('caption', '')[:30]}', keywords='{img.get('keywords', '')[:30]}'")
            
            # 1. Confidence threshold check
            if best_score < MIN_IMAGE_MATCH_SCORE:
                logger.warning(f"REJECTED: Best image score ({best_score:.3f}) is below confidence threshold ({MIN_IMAGE_MATCH_SCORE})")
                return None
                
            # 2. Margin check against second best candidate
            if len(candidates) > 1:
                second_score, _ = candidates[1]
                margin = best_score - second_score
                if margin < MIN_IMAGE_MATCH_MARGIN and second_score > (MIN_IMAGE_MATCH_SCORE - 0.1):
                    logger.warning(f"REJECTED: Margin ({margin:.3f}) between Top 1 ({best_score:.3f}) and Top 2 ({second_score:.3f}) is too small")
                    return None
            
            logger.info(f"SELECTED: image_id={best_img.get('id')} with score={best_score:.3f}")
            
            return {
                "image_blob": best_img.get('image_blob'),
                "keywords": best_img.get('keywords', ''),
                "description": best_img.get('description', ''),
                "caption": best_img.get('caption', ''),
                "source_type": best_img.get('source_type', 'database'),
                "confidence": best_score,
                "file_name": best_img.get('file_name', 'image.png'),
                "id": best_img.get('id')
            }
        
        logger.debug(f"No matching images found in database for keywords: {keywords}")
        return None
        
    except Exception as e:
        logger.error(f"Error searching database for images: {e}")
        return None



def save_image_blob_to_temp(image_blob: bytes) -> Optional[str]:
    """
    Save image blob to a temporary file and return the path.
    
    Args:
        image_blob: Binary image data
        
    Returns:
        Path to temporary file or None
    """
    try:
        if not image_blob:
            logger.error("Empty image blob provided to save_image_blob_to_temp")
            return None
        
        # Validate that image_blob is valid PNG
        if not image_blob.startswith(b'\x89PNG'):
            logger.warning(f"Image blob doesn't start with PNG magic bytes. Size: {len(image_blob)} bytes. First 20 bytes: {image_blob[:20]}")
        
        # Create temporary file with explicit mode and buffering
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.png', mode='wb')
        
        # Write all bytes at once
        bytes_written = temp_file.write(image_blob)
        
        # Ensure all data is written to disk
        temp_file.flush()
        import os
        os.fsync(temp_file.fileno())
        temp_file.close()
        
        if bytes_written != len(image_blob):
            logger.error(f"Incomplete write: wrote {bytes_written} of {len(image_blob)} bytes")
            return None
        
        # Verify the file was written correctly
        import os
        file_size = os.path.getsize(temp_file.name)
        if file_size != len(image_blob):
            logger.error(f"File size mismatch: expected {len(image_blob)}, got {file_size}")
            return None
        
        logger.info(f"Saved {len(image_blob)} bytes to temp file: {temp_file.name}")
        return temp_file.name
    
    except Exception as e:
        logger.error(f"Error saving image to temp file: {e}", exc_info=True)
        return None


def cleanup_temp_image_file(file_path: str) -> bool:
    """
    Clean up temporary image file.
    
    Args:
        file_path: Path to temporary file
        
    Returns:
        True if successful
    """
    try:
        if file_path:
            Path(file_path).unlink(missing_ok=True)
            return True
    except Exception as e:
        logger.error(f"Error cleaning up temp file: {e}")
    
    return False


class QuestionImageData:
    """Container for question with associated image data"""
    
    def __init__(self, question_content: str, question_number: int):
        self.content = question_content
        self.number = question_number
        self.image_data = None
        self.image_file_path = None
    
    def fetch_image(self) -> bool:
        """
        Fetch image for the question.
        
        Returns:
            True if image found, False otherwise
        """
        try:
            image_data = get_image_for_question(self.content, trace_label=f"question_{self.number}")
            
            if image_data and image_data.get('image_blob'):
                self.image_data = image_data
                
                # Save to temp file for use in document generation
                self.image_file_path = save_image_blob_to_temp(image_data['image_blob'])
                
                return self.image_file_path is not None
        
        except Exception as e:
            logger.error(f"Error fetching image for question {self.number}: {e}")
        
        return False
    
    def has_image(self) -> bool:
        """Check if question has an image"""
        return self.image_file_path is not None
    
    def cleanup(self) -> None:
        """Clean up temporary files"""
        if self.image_file_path:
            cleanup_temp_image_file(self.image_file_path)
            self.image_file_path = None
    
    def __del__(self):
        """Cleanup on deletion"""
        self.cleanup()


def process_questions_for_images(questions_by_part: Dict[str, list]) -> Dict[str, list]:
    """
    Process all questions and fetch images as needed.
    Returns processed questions with image data.
    
    Args:
        questions_by_part: Dictionary of questions by part
        
    Returns:
        Dictionary with QuestionImageData objects
    """
    processed = {}
    question_number = 1
    
    for part_name, questions in questions_by_part.items():
        processed[part_name] = []
        
        for q in questions:
            # Create wrapper with image data
            q_data = QuestionImageData(q.get('content', ''), question_number)
            
            # Try to fetch image
            q_data.fetch_image()
            
            # Store original question data along with image
            q_data.original_data = q
            
            processed[part_name].append(q_data)
            question_number += 1
    
    return processed


