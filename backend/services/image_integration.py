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
        image_data = _search_database_for_image(keywords, used_image_ids)
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


def _search_database_for_image(keywords: list, used_image_ids: set) -> Optional[Dict[str, Any]]:
    """
    Search database for images matching keywords.
    
    Args:
        keywords: List of keywords to search
        used_image_ids: Set of already-used image IDs
        
    Returns:
        Image data dict or None
    """
    try:
        from services.image_service import ImageService
        
        candidates = []

        # Try each keyword to find available images
        for keyword in keywords[:5]:  # Try first 5 keywords
            try:
                images = ImageService.search_images(keyword, limit=10)
                
                logger.info(f"Searching local image database for keyword: {keyword}")
                
                if images:
                    for img in images:
                        img_id = img.get('id')
                        if img_id and img_id in used_image_ids:
                            continue

                        haystack = f"{img.get('keywords', '')} {img.get('description', '')}".lower()
                        match_score = 1 if keyword.lower() in haystack else 0
                        candidates.append((
                            _source_priority(img.get('source_type')),
                            -match_score,
                            -int(img.get('id') or 0),
                            img,
                        ))
            except Exception as kw_error:
                logger.debug(f"Error searching for keyword '{keyword}': {kw_error}")
                continue

        if candidates:
            candidates.sort(key=lambda item: (item[0], item[1], item[2]))
            best_img = candidates[0][3]
            logger.debug(
                "Selected DB image (priority=%s, source=%s, id=%s)",
                candidates[0][0],
                best_img.get('source_type', 'database'),
                best_img.get('id'),
            )
            return {
                "image_blob": best_img.get('image_blob'),
                "keywords": best_img.get('keywords', ''),
                "description": best_img.get('description', ''),
                "source_type": best_img.get('source_type', 'database'),
                "confidence": 0.8,
                "file_name": best_img.get('file_name', 'image.png'),
                "id": best_img.get('id')
            }
        
        logger.debug(f"No matching images found in database for keywords: {keywords}")
        return None
        
    except Exception as e:
        logger.error(f"Error searching database for images: {e}")
        return None


def fix_extreme_brightness_image(image_blob: bytes) -> bytes:
    """
    Enhance image for better visibility in documents.
    Applies aggressive contrast and sharpening to all images.
    
    Args:
        image_blob: Original image blob
        
    Returns:
        Enhanced image blob
    """
    try:
        from PIL import Image, ImageEnhance, ImageOps
        from PIL import ImageFilter
        import io
        
        # Open and normalize EXIF orientation first.
        img = Image.open(io.BytesIO(image_blob))
        img = ImageOps.exif_transpose(img)
        img = img.convert('RGB')
        img.load()
        
        ori_size = len(image_blob)
        logger.info(f"Enhancing image ({ori_size} bytes, {img.width}x{img.height})")
        
        # Use conservative, conditional enhancement to avoid washed-out/blank images.
        gray = img.convert('L')
        extrema = gray.getextrema()
        dynamic_range = float(extrema[1] - extrema[0])

        contrast_factor = 1.15 if dynamic_range < 80 else 1.05
        brightness_factor = 1.0

        if extrema[1] < 90:
            brightness_factor = 1.08
        elif extrema[1] > 245 and dynamic_range < 40:
            brightness_factor = 0.94

        contrast = ImageEnhance.Contrast(img)
        img = contrast.enhance(contrast_factor)

        brightness = ImageEnhance.Brightness(img)
        img = brightness.enhance(brightness_factor)

        img = img.filter(ImageFilter.SHARPEN)
        
        # Save
        output = io.BytesIO()
        img.save(output, format='PNG', optimize=False)
        return output.getvalue()
    
    except Exception as e:
        logger.error(f"Error enhancing image: {e}", exc_info=True)
        return image_blob


def rotate_image_for_pdf_insertion(image_blob: bytes, clockwise_degrees: int = 90) -> bytes:
    """
    Rotate image blob before embedding in generated PDFs.

    Args:
        image_blob: Original image blob
        clockwise_degrees: Rotation angle in clockwise direction

    Returns:
        Rotated image blob as PNG bytes
    """
    try:
        from PIL import Image, ImageOps
        import io

        img = Image.open(io.BytesIO(image_blob))
        img = ImageOps.exif_transpose(img)
        img = img.convert('RGB')
        img.load()
        original_size = (img.width, img.height)
        original_bytes = len(image_blob)

        # PIL rotate uses counter-clockwise angles, so negate clockwise input.
        ccw_degrees = (-int(clockwise_degrees)) % 360
        if ccw_degrees:
            img = img.rotate(ccw_degrees, expand=True)
            logger.info(
                "Rotation applied for PDF insertion: clockwise=%s, size=%sx%s -> %sx%s",
                clockwise_degrees,
                original_size[0],
                original_size[1],
                img.width,
                img.height,
            )
        else:
            logger.info(
                "Rotation skipped for PDF insertion: clockwise=%s results in 0-degree transform (size=%sx%s)",
                clockwise_degrees,
                original_size[0],
                original_size[1],
            )

        output = io.BytesIO()
        img.save(output, format='PNG', optimize=False)
        rotated_blob = output.getvalue()
        logger.info(
            "Rotation output bytes for PDF insertion: %s -> %s",
            original_bytes,
            len(rotated_blob),
        )
        return rotated_blob
    except Exception as e:
        logger.error(f"Error rotating image for PDF insertion: {e}", exc_info=True)
        return image_blob


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


