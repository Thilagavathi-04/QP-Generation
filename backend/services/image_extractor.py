"""
Image Extraction Module
Extracts images from PDFs and generates keywords/descriptions
"""

import io
import os
import re
import sys
import tempfile
from pathlib import Path
from typing import List, Dict, Any, Tuple
import fitz  # PyMuPDF
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

# Handle imports for both direct execution and module import
try:
    from services.rag_config import logger
    from services.image_integration import flip_image_vertically
except ImportError:
    # When run directly, add parent directory to path
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    try:
        from rag_config import logger
        from image_integration import flip_image_vertically
    except ImportError:
        # Fallback: create a simple logger
        import logging
        logger = logging.getLogger(__name__)
        logger.warning("Could not import rag_config logger")
        flip_image_vertically = None


def detect_and_fix_rotation(img: Image.Image) -> Image.Image:
    """
    Detect and fix common image rotations (90, 180, 270 degrees).
    Handles both EXIF-based and content-based rotations (e.g., text/images rotated in PDF).
    
    Args:
        img: PIL Image object
        
    Returns:
        Corrected PIL Image object
    """
    try:
        # First try EXIF rotation (for images with EXIF data)
        img = ImageOps.exif_transpose(img)
        
        width, height = img.size
        
        # Content-based rotation detection
        # Images that are extremely tall and narrow are likely rotated 90 degrees
        # Example: A normal 2000x400 document image appears as 400x2000 when rotated
        aspect_ratio = width / height if height > 0 else 1
        
        # Heuristic: if aspect ratio is very small (< 0.35) and height is substantial,
        # the image is likely rotated 90 degrees clockwise in the PDF
        # Rotate it back to correct orientation
        if aspect_ratio < 0.35 and height >= 400:
            logger.info(f"Detected likely 90-degree rotation (aspect ratio {aspect_ratio:.2f}): correcting image")
            # Rotate 90 degrees counter-clockwise to fix clockwise rotation
            img = img.rotate(90, expand=True)
            logger.info(f"After rotation: {img.width}x{img.height}")
        
        return img
    except Exception as e:
        logger.warning(f"Error detecting/fixing rotation: {e}")
        return img


def enhance_image_quality(pil_img: Image.Image, quality_boost: str = "medium") -> Image.Image:
    """
    Enhance image quality for better display in question papers.
    
    Args:
        pil_img: PIL Image object
        quality_boost: "low", "medium", or "high"
        
    Returns:
        Enhanced PIL Image object
    """
    try:
        if quality_boost == "high":
            # Aggressive enhancement for low-quality images
            contrast_boost = 1.2
            brightness_boost = 1.05
            saturation_boost = 1.1
        elif quality_boost == "medium":
            # Moderate enhancement for standard images
            contrast_boost = 1.12
            brightness_boost = 1.03
            saturation_boost = 1.0
        else:  # low
            # Minimal enhancement
            contrast_boost = 1.05
            brightness_boost = 1.0
            saturation_boost = 0.95
        
        # Enhance contrast
        contrast_enhancer = ImageEnhance.Contrast(pil_img)
        pil_img = contrast_enhancer.enhance(contrast_boost)
        
        # Enhance brightness
        brightness_enhancer = ImageEnhance.Brightness(pil_img)
        pil_img = brightness_enhancer.enhance(brightness_boost)
        
        # Enhance color saturation (if RGB)
        if pil_img.mode == 'RGB':
            color_enhancer = ImageEnhance.Color(pil_img)
            pil_img = color_enhancer.enhance(saturation_boost)
        
        # Apply sharpening for clarity
        pil_img = pil_img.filter(ImageFilter.SHARPEN)
        pil_img = pil_img.filter(ImageFilter.SHARPEN)  # Apply twice for better clarity
        
        return pil_img
    
    except Exception as e:
        logger.warning(f"Error enhancing image quality: {e}")
        return pil_img


def extract_images_from_pdf(pdf_path: str) -> List[Dict[str, Any]]:
    """
    Extract all images from a PDF file using PyMuPDF.
    
    Args:
        pdf_path: Path to the PDF file
        
    Returns:
        List of dictionaries containing:
        - image_blob: Binary image data
        - file_name: Generated file name
        - source_reference: Page number and image index
    """
    images = []
    
    try:
        pdf_document = fitz.open(pdf_path)
        
        for page_num, page in enumerate(pdf_document):
            # Get all images on the page
            image_list = page.get_images()
            
            for img_index, img_ref in enumerate(image_list):
                try:
                    # Extract the image
                    xref = img_ref[0]
                    pix = fitz.Pixmap(pdf_document, xref)
                    
                    # Ensure RGB color space for consistency
                    if pix.colorspace != fitz.csRGB:
                        pix = fitz.Pixmap(fitz.csRGB, pix)
                    
                    # Convert PyMuPDF Pixmap directly to PIL Image using frombytes
                    # Determine color mode based on pixmap components
                    if pix.n == 3:  # RGB
                        mode = 'RGB'
                    elif pix.n == 4:  # RGBA
                        mode = 'RGBA'
                    elif pix.n == 2:  # Grayscale + alpha
                        mode = 'LA'
                    else:  # Grayscale
                        mode = 'L'
                    
                    # Create PIL Image from pixmap samples directly
                    pil_img = Image.frombytes(
                        mode,
                        (pix.width, pix.height),
                        pix.samples
                    )
                    


                    # Apply rotation correction
                    # pil_img = detect_and_fix_rotation(pil_img)
                    
                    # Convert RGBA to RGB if needed (remove alpha channel)
                    if pil_img.mode == 'RGBA':
                        # Create white background
                        bg = Image.new('RGB', pil_img.size, (255, 255, 255))
                        bg.paste(pil_img, mask=pil_img.split()[3])  # Use alpha as mask
                        pil_img = bg
                    elif pil_img.mode == 'LA':
                        # Convert LA to L (grayscale)
                        pil_img = pil_img.convert('L')
                    elif pil_img.mode != 'RGB':
                        # Convert everything else to RGB
                        pil_img = pil_img.convert('RGB')
                    
                    # Apply quality enhancement
                    # pil_img = enhance_image_quality(pil_img, quality_boost="medium")

                    output = io.BytesIO()
                    pil_img.save(output, format='PNG', optimize=True)

                    custom_path = "/home/thilagavathi/projects/images/test.png"
                    # Create directory if it doesn't exist
                    os.makedirs(os.path.dirname(custom_path), exist_ok=True)
                    pil_img.save(custom_path, format='PNG', optimize=True)
                    
                    img_blob = output.getvalue()
                    
                    # Apply vertical flip before saving to database
                    if flip_image_vertically:
                        img_blob = flip_image_vertically(img_blob)
                    
                    file_name = f"page_{page_num + 1}_img_{img_index + 1}.png"
                    source_ref = f"page_{page_num + 1}_index_{img_index}"
                    
                    images.append({
                        "image_blob": img_blob,
                        "file_name": file_name,
                        "source_reference": source_ref,
                        "page_num": page_num + 1,
                        "img_index": img_index + 1
                    })
                    
                    logger.info(f"Extracted image: {file_name} from {pdf_path}")
                    pix = None  # Free resources
                except Exception as e:
                    logger.error(f"Error extracting image {img_index} from page {page_num}: {e}")
                    continue
        
        pdf_document.close()
        logger.info(f"Successfully extracted {len(images)} images from {pdf_path}")
        
    except Exception as e:
        logger.error(f"Error processing PDF {pdf_path}: {e}")
    
    return images


def generate_image_keywords(image_blob: bytes, context_text: str = None) -> Tuple[str, str]:
    """
    Generate keywords and description for an image.
    Uses image analysis and context to generate meaningful keywords.
    
    Args:
        image_blob: Binary image data
        context_text: Optional context text from surrounding PDF content
        
    Returns:
        Tuple of (keywords, description)
    """
    try:
        # Analyze image using PIL
        img_stream = io.BytesIO(image_blob)
        pil_img = Image.open(img_stream)
        pil_img.load()
        
        # Generate basic keywords from image properties
        keywords = set()
        
        # Add image type keywords
        keywords.add(f"{pil_img.width}x{pil_img.height}")  # dimensions
        
        # Analyze image content (basic color analysis)
        extrema = pil_img.getextrema() if pil_img.mode == 'L' else None
        if extrema:
            keywords.add("diagram" if extrema[1] < 200 else "photo")
        
        # Extract text from context if provided
        if context_text:
            # Get relevant keywords from context (first 200 chars)
            context_words = context_text[:200].split()
            for word in context_words[:10]:
                if len(word) > 3:  # Only words longer than 3 chars
                    keywords.add(word.lower().strip('.,;:'))
        
        keywords_str = ", ".join(sorted(list(keywords)[:20]))  # Limit to 20 keywords
        
        # Generate basic description
        description = f"Image extracted from document"
        if context_text:
            description += f": {context_text[:100]}"
        
        return keywords_str, description
        
    except Exception as e:
        logger.error(f"Error generating keywords for image: {e}")
        return "image, document", "Document image"


def enrich_keyword_list(raw_keywords: str, description: str = "", context_text: str = "") -> str:
    """Build a richer, comma-separated keyword list for image indexing."""
    tokens = []

    for segment in [raw_keywords or "", description or "", context_text or ""]:
        if not segment:
            continue
        for piece in re.split(r"[^a-zA-Z0-9]+", segment.lower()):
            cleaned = piece.strip()
            if len(cleaned) >= 3:
                tokens.append(cleaned)

    text_blob = f"{description} {context_text}".lower()
    if "sort" in text_blob:
        tokens.extend([
            "sorting",
            "sorting algorithm",
            "bubble sort",
            "quick sort",
            "merge sort",
            "heap sort",
            "insertion sort",
            "selection sort",
        ])
    if "tree" in text_blob:
        tokens.extend(["tree", "binary tree", "bst", "traversal"]) 
    if "graph" in text_blob:
        tokens.extend(["graph", "vertex", "edge", "path"]) 
    if "hash" in text_blob:
        tokens.extend(["hash", "hash table", "collision"]) 

    seen = set()
    ordered = []
    for token in tokens:
        normalized = token.strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        ordered.append(normalized)

    return ", ".join(ordered[:30]) or "image, document"


def extract_images_and_text_from_pdf(pdf_path: str) -> Dict[str, Any]:
    """
    Extract both text and images from PDF with context.
    Useful for generating meaningful keywords based on context.
    
    Args:
        pdf_path: Path to the PDF file
        
    Returns:
        Dictionary with:
        - text: Full extracted text
        - images: List of images with context
    """
    images_with_context = []
    full_text = ""
    
    try:
        pdf_document = fitz.open(pdf_path)
        
        for page_num, page in enumerate(pdf_document):
            # Extract text
            page_text = page.get_text()
            full_text += page_text + "\n"
            
            # Get images
            image_list = page.get_images()
            
            for img_index, img_ref in enumerate(image_list):
                try:
                    # Extract context around image (text from same page)
                    context_text = page_text[:200] if page_text else ""
                    
                    # Extract image
                    xref = img_ref[0]
                    pix = fitz.Pixmap(pdf_document, xref)
                    
                    # Ensure RGB color space for consistency
                    if pix.colorspace != fitz.csRGB:
                        pix = fitz.Pixmap(fitz.csRGB, pix)
                    
                    # Convert PyMuPDF Pixmap directly to PIL Image
                    if pix.n == 3:  # RGB
                        mode = 'RGB'
                    elif pix.n == 4:  # RGBA
                        mode = 'RGBA'
                    elif pix.n == 2:  # Grayscale + alpha
                        mode = 'LA'
                    else:  # Grayscale
                        mode = 'L'
                    
                    pil_img = Image.frombytes(
                        mode,
                        (pix.width, pix.height),
                        pix.samples
                    )
                    
                    # Handle alpha channels
                    if pil_img.mode == 'RGBA':
                        bg = Image.new('RGB', pil_img.size, (255, 255, 255))
                        bg.paste(pil_img, mask=pil_img.split()[3])
                        pil_img = bg
                    elif pil_img.mode == 'LA':
                        pil_img = pil_img.convert('L')
                    elif pil_img.mode != 'RGB':
                        pil_img = pil_img.convert('RGB')
                    
                    # Enhanced image processing
                    contrast_enhancer = ImageEnhance.Contrast(pil_img)
                    pil_img = contrast_enhancer.enhance(1.5)
                    
                    brightness_enhancer = ImageEnhance.Brightness(pil_img)
                    pil_img = brightness_enhancer.enhance(1.2)
                    
                    # Sharpen for clarity
                    pil_img = pil_img.filter(ImageFilter.SHARPEN)
                    
                    if pil_img.width > 1024 or pil_img.height > 1024:
                        pil_img.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
                    
                    output = io.BytesIO()
                    pil_img.save(output, format='PNG', compress_level=6)
                    img_blob = output.getvalue()
                    
                    # Apply vertical flip before saving to database
                    if flip_image_vertically:
                        img_blob = flip_image_vertically(img_blob)
                    
                    # Generate keywords with context
                    keywords, description = generate_image_keywords(img_blob, context_text)
                    
                    images_with_context.append({
                        "image_blob": img_blob,
                        "file_name": f"page_{page_num + 1}_img_{img_index + 1}.png",
                        "source_reference": f"page_{page_num + 1}_index_{img_index}",
                        "keywords": keywords,
                        "description": description,
                        "context": context_text,
                        "source_type": "pdf_extraction"
                    })
                    
                    pix = None
                    
                except Exception as e:
                    logger.error(f"Error processing image {img_index} on page {page_num}: {e}")
                    continue
        
        pdf_document.close()
        
    except Exception as e:
        logger.error(f"Error processing PDF {pdf_path}: {e}")
    
    return {
        "text": full_text,
        "images": images_with_context,
        "total_images": len(images_with_context)
    }


def resize_image_for_document(image_blob: bytes, max_width: int = 500, 
                             max_height: int = 500) -> bytes:
    """
    Resize image to fit in document while maintaining aspect ratio.
    
    Args:
        image_blob: Binary image data
        max_width: Maximum width in pixels
        max_height: Maximum height in pixels
        
    Returns:
        Resized image blob
    """
    try:
        img_stream = io.BytesIO(image_blob)
        img = Image.open(img_stream)
        img.load()
        
        # Calculate aspect ratio
        img.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
        
        # Save resized image
        output = io.BytesIO()
        img.save(output, format='PNG')
        
        return output.getvalue()
    
    except Exception as e:
        logger.error(f"Error resizing image: {e}")
        return image_blob  # Return original if resizing fails


def ingest_pdf_images_to_database(pdf_path: str, source_reference_prefix: str = "book") -> int:
    """
    Extract images from a PDF and store them in question_images with rich keyword lists.

    Returns the number of images successfully saved.
    """
    saved_count = 0

    try:
        from services.image_service import ImageService

        extracted = extract_images_and_text_from_pdf(pdf_path)
        images = extracted.get("images", [])

        for image_data in images:
            image_blob = image_data.get("image_blob")
            if not image_blob:
                continue

            keywords = enrich_keyword_list(
                image_data.get("keywords", ""),
                image_data.get("description", ""),
                image_data.get("context", ""),
            )

            image_id = ImageService.save_image(
                keywords=keywords,
                description=image_data.get("description", "Book image"),
                image_blob=image_blob,
                source_type="pdf_extraction",
                source_reference=f"{source_reference_prefix}:{image_data.get('source_reference', '')}",
                file_name=image_data.get("file_name"),
            )

            if image_id:
                saved_count += 1

        logger.info(f"Saved {saved_count} extracted book images from: {pdf_path}")
    except Exception as e:
        logger.error(f"Error ingesting PDF images from {pdf_path}: {e}")

    return saved_count
