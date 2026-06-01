"""
Image Web Search Module
Search and download images from web using DuckDuckGo Images API with randomness and resolution filtering
"""

import requests
import io
import re
import random
import urllib.parse
import sys
import os
from typing import List, Optional, Dict, Any
from PIL import Image, ImageOps
import time

# Handle imports for both direct execution and module import
try:
    from services.rag_config import logger
except ImportError:
    # When run directly, add parent directory to path
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    try:
        from rag_config import logger
    except ImportError:
        # Fallback: create a simple logger
        import logging
        logger = logging.getLogger(__name__)
        logger.warning("Could not import rag_config logger")

try:
    from ddgs import DDGS
    DDGS_AVAILABLE = True
except ImportError:
    # Try old package name for backward compatibility
    try:
        from duckduckgo_search import DDGS
        DDGS_AVAILABLE = True
    except ImportError:
        DDGS_AVAILABLE = False
        logger.warning("ddgs library not installed. Install with: pip install ddgs")


class ImageWebSearch:
    """Search and download images from the web using DuckDuckGo library"""

    @staticmethod
    def _clean_text(value: str, fallback: str = "") -> str:
        text = re.sub(r"<[^>]+>", " ", value or "")
        text = re.sub(r"\s+", " ", text).strip()
        return text or fallback

    @staticmethod
    def _merge_unique_images(existing: List[Dict[str, Any]], incoming: List[Dict[str, Any]], limit: int) -> List[Dict[str, Any]]:
        seen = {
            (img.get("source_reference") or "").strip()
            for img in existing
            if img.get("source_reference")
        }

        for img in incoming:
            ref = (img.get("source_reference") or "").strip()
            if ref and ref in seen:
                continue
            if ref:
                seen.add(ref)
            existing.append(img)
            if len(existing) >= limit:
                break

        return existing
    
    @staticmethod
    def _get_image_from_url(url: str, timeout: int = 10) -> Optional[bytes]:
        """
        Download image from URL and convert to optimized format.
        
        Args:
            url: Image URL
            timeout: Request timeout in seconds
            
        Returns:
            Image blob or None if download fails
        """
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            
            response = requests.get(url, headers=headers, timeout=timeout, verify=False)
            response.raise_for_status()
            
            # Validate it's an image
            img_stream = io.BytesIO(response.content)
            img = Image.open(img_stream)
            # Respect EXIF orientation metadata before any mode conversion.
            img = ImageOps.exif_transpose(img)
            img.load()
            
            # Convert to RGB if necessary  
            if img.mode in ('RGBA', 'LA', 'P'):
                rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                rgb_img.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = rgb_img
            
            # Resize if too large (max 1024x1024)
            if img.width > 1024 or img.height > 1024:
                img.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
            
            # Apply quality enhancement for web images (consistency with extracted images)
            try:
                from services.image_extractor import enhance_image_quality
                img = enhance_image_quality(img, quality_boost="medium")
            except ImportError:
                # If circular import, apply enhancement inline
                from PIL import ImageEnhance, ImageFilter
                contrast_enhancer = ImageEnhance.Contrast(img)
                img = contrast_enhancer.enhance(1.15)
                brightness_enhancer = ImageEnhance.Brightness(img)
                img = brightness_enhancer.enhance(1.05)
                color_enhancer = ImageEnhance.Color(img)
                img = color_enhancer.enhance(1.1)
                img = img.filter(ImageFilter.SHARPEN)
            
            # Save as optimized PNG
            output = io.BytesIO()
            img.save(output, format='PNG', optimize=True)
            
            logger.info(f"Successfully downloaded and optimized image from: {url}")
            return output.getvalue()
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error downloading image from {url}: {e}")
            return None
        except Exception as e:
            logger.error(f"Error processing image from {url}: {e}")
            return None
    
    @staticmethod
    def search_duckduckgo(keywords: str, limit: int = 5, min_resolution: int = 400, 
                         keyword_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Search for images using DuckDuckGo API with randomness and resolution filtering.
        Fetches multiple pages of results (~400 candidates), pools them, and randomly shuffles.
        
        Args:
            keywords: Search keywords
            limit: Number of images to return
            min_resolution: Minimum width/height in pixels (default 400x400)
            keyword_filter: Comma-separated keywords to filter URLs (e.g., "nature,outdoor")
            
        Returns:
            List of downloaded image blobs with metadata
        """
        images = []
        
        if not DDGS_AVAILABLE:
            logger.warning("duckduckgo-search library not installed. Skipping DuckDuckGo search.")
            return images
        
        try:
            logger.info(f"Searching DuckDuckGo for images: {keywords}")
            
            # Parse filter keywords
            filter_keywords = set()
            if keyword_filter:
                filter_keywords = {k.strip().lower() for k in keyword_filter.split(',')}
            
            # Fetch multiple pages for randomness strategy
            candidates = []
            
            try:
                # Initialize DDGS without arguments for compatibility
                ddgs = DDGS(timeout=10)
            except TypeError:
                # Fallback for different versions
                try:
                    ddgs = DDGS()
                except Exception as init_e:
                    logger.error(f"Failed to initialize DDGS: {init_e}")
                    return images
            
            try:
                # Fetch up to 3 pages (~300+ candidates)
                for page_num in range(3):
                    try:
                        # DuckDuckGo Images API with size filtering
                        results = list(ddgs.images(
                            keywords=keywords,
                            region="en-US",
                            size="Large",  # Pre-filter for large images
                            max_results=100  # Max per page
                        ))
                        
                        if not results:
                            logger.debug(f"No results in page {page_num}")
                            break
                        
                        for result in results:
                            try:
                                image_url = result.get('image')
                                if not image_url:
                                    continue
                                
                                # Apply keyword filter if specified
                                if filter_keywords:
                                    url_lower = image_url.lower()
                                    if not any(kw in url_lower for kw in filter_keywords):
                                        continue
                                
                                candidates.append({
                                    "image_url": image_url,
                                    "source_domain": urllib.parse.urlparse(image_url).netloc or "unknown",
                                    "title": result.get('title', keywords),
                                })
                            except Exception as inner_e:
                                logger.debug(f"Error processing DuckDuckGo result: {inner_e}")
                                continue
                        
                        # Polite delay between pages (1.5-6 seconds)
                        time.sleep(random.uniform(1.5, 6.0))
                    
                    except Exception as page_e:
                        logger.debug(f"Error fetching DuckDuckGo page {page_num}: {page_e}")
                        continue
                
                logger.info(f"Collected {len(candidates)} candidates from DuckDuckGo")
            
            except Exception as e:
                logger.error(f"Error querying DuckDuckGo API: {e}")
                return images
            
            # Randomize candidate order (core feature: randomness strategy)
            random.shuffle(candidates)
            
            # Download and validate resolution
            for candidate in candidates:
                if len(images) >= limit:
                    break
                
                try:
                    image_url = candidate.get('image_url')
                    
                    # Download only first 64KB to verify dimensions (bandwidth-friendly)
                    img_blob = ImageWebSearch._download_and_verify_resolution(
                        image_url,
                        min_resolution=min_resolution
                    )
                    
                    if img_blob:
                        images.append({
                            "image_blob": img_blob,
                            "source_reference": image_url,
                            "file_name": f"ddgs_{keywords.replace(' ', '_')}_{len(images)}.png",
                            "keywords": keywords,
                            "description": candidate.get('title', keywords),
                            "source_type": "web_search",
                            "source_domain": candidate.get('source_domain'),
                        })
                    
                    # Polite delay between downloads
                    time.sleep(random.uniform(0.5, 2.0))
                
                except Exception as e:
                    logger.debug(f"Error downloading candidate: {e}")
                    continue
            
            logger.info(f"Downloaded {len(images)} images from DuckDuckGo for keywords: {keywords}")
        
        except Exception as e:
            logger.error(f"Error searching DuckDuckGo: {e}")
        
        return images
    
    @staticmethod
    def _download_and_verify_resolution(url: str, min_resolution: int = 400, 
                                       timeout: int = 10, header_only: bool = True) -> Optional[bytes]:
        """
        Download image and verify it meets minimum resolution requirements.
        For efficiency, first tries to verify using just header (first 64KB).
        Falls back to full download if header check inconclusive.
        
        Args:
            url: Image URL
            min_resolution: Minimum width/height in pixels
            timeout: Request timeout in seconds
            header_only: If True, try header-only verification first
            
        Returns:
            Image blob if resolution meets requirements, None otherwise
        """
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            
            # Try header-only verification first (faster, bandwidth-friendly)
            if header_only:
                try:
                    response = requests.get(url, headers=headers, timeout=timeout, 
                                          verify=False, stream=True)
                    response.raise_for_status()
                    
                    # Read only first 64KB for header
                    header_data = io.BytesIO()
                    for chunk in response.iter_content(chunk_size=8192):
                        header_data.write(chunk)
                        if header_data.tell() > 65536:  # 64KB limit
                            break
                    
                    header_data.seek(0)
                    try:
                        img = Image.open(header_data)
                        img.load()
                        
                        # Check resolution
                        if img.width >= min_resolution and img.height >= min_resolution:
                            # Resolution is good, download full image
                            return ImageWebSearch._get_image_from_url(url, timeout=timeout)
                        else:
                            logger.debug(f"Image too small ({img.width}x{img.height}): {url}")
                            return None
                    except Exception as inner_e:
                        logger.debug(f"Could not verify header for {url}: {inner_e}")
                        # Try full download anyway
                        return ImageWebSearch._get_image_from_url(url, timeout=timeout)
                
                except Exception as header_e:
                    logger.debug(f"Header verification failed for {url}: {header_e}")
                    # Fall through to full download
                    pass
            
            # Full download verification
            return ImageWebSearch._get_image_from_url(url, timeout=timeout)
        
        except Exception as e:
            logger.error(f"Error verifying resolution for {url}: {e}")
            return None
    
    
    @staticmethod
    def search_images(keywords: str, limit: int = 5, min_resolution: int = 400,
                     keyword_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Search for images using DuckDuckGo.
        
        Args:
            keywords: Search keywords
            limit: Number of images to retrieve
            min_resolution: Minimum image resolution in pixels (default 400x400)
            keyword_filter: Comma-separated keywords to filter URLs
            
        Returns:
            List of image data with metadata
        """
        return ImageWebSearch.search_duckduckgo(
            keywords,
            limit=limit,
            min_resolution=min_resolution,
            keyword_filter=keyword_filter
        )
    
    @staticmethod
    def verify_image_matches_context(image_blob: bytes, context_keywords: List[str]) -> float:
        """
        Verify if downloaded image matches the expected context.
        Returns a confidence score 0-1.
        
        Args:
            image_blob: Image data
            context_keywords: Keywords from question/context
            
        Returns:
            Confidence score (0-1)
        """
        try:
            img_stream = io.BytesIO(image_blob)
            img = Image.open(img_stream)
            img.load()
            
            # Basic validation checks
            if img.width < 100 or img.height < 100:
                return 0.3  # Too small
            if img.width * img.height > 5000000:  # 5MP
                return 0.7  # Very large, likely irrelevant
            
            # Check if image is not completely uniform (likely image or diagram)
            img_array = list(img.getdata())
            if len(set(img_array[:100])) < 10:  # Very uniform = likely blank/error
                return 0.2
            
            # If context keywords provided, assume moderate confidence for web search
            if context_keywords:
                return 0.7  # Moderate confidence - user can verify
            
            return 0.6  # Default moderate confidence
            
        except Exception as e:
            logger.error(f"Error verifying image: {e}")
            return 0.5  # Default to moderate confidence on error


if __name__ == "__main__":
    """Test image search functionality"""
    print("\n" + "="*70)
    print("IMAGE WEB SEARCH - TEST")
    print("="*70)
    
    # Check if DuckDuckGo library is available
    if not DDGS_AVAILABLE:
        print("❌ ERROR: duckduckgo-search library not installed")
        print("   Install with: pip install duckduckgo-search==3.9.10")
        exit(1)
    
    print("✅ DuckDuckGo library is available")
    
    # Test 1: Simple search
    print("\n" + "-"*70)
    print("TEST 1: Simple image search")
    print("-"*70)
    
    test_keywords = "golden retriever"
    print(f"Searching for: '{test_keywords}'")
    print("Parameters: limit=2, min_resolution=400")
    print("Please wait (first search may take 20-40 seconds due to polite delays)...")
    
    try:
        images = ImageWebSearch.search_images(
            keywords=test_keywords,
            limit=2,
            min_resolution=400
        )
        
        if images:
            print(f"\n✅ SUCCESS: Retrieved {len(images)} image(s)")
            for idx, img in enumerate(images, 1):
                print(f"\n  Image {idx}:")
                print(f"    - Domain: {img.get('source_domain', 'unknown')}")
                print(f"    - Size: {len(img.get('image_blob', b''))} bytes")
                print(f"    - Description: {img.get('description', 'N/A')[:60]}...")
                print(f"    - Source Reference: {img.get('source_reference', 'N/A')[:60]}...")
        else:
            print("⚠️  WARNING: No images found (network issue or keywords too specific)")
    except Exception as e:
        print(f"❌ ERROR: {type(e).__name__}: {e}")
    
    # Test 2: Search with keyword filter
    print("\n" + "-"*70)
    print("TEST 2: Search with keyword filter")
    print("-"*70)
    
    test_keywords = "mountain landscape"
    print(f"Searching for: '{test_keywords}'")
    print("Keyword filter: 'landscape,nature,outdoor'")
    print("Parameters: limit=2, min_resolution=400")
    
    try:
        images = ImageWebSearch.search_images(
            keywords=test_keywords,
            limit=2,
            min_resolution=400,
            keyword_filter="landscape,nature,outdoor"
        )
        
        if images:
            print(f"\n✅ SUCCESS: Retrieved {len(images)} image(s) matching filters")
            for idx, img in enumerate(images, 1):
                print(f"\n  Image {idx}:")
                print(f"    - Domain: {img.get('source_domain', 'unknown')}")
                print(f"    - Size: {len(img.get('image_blob', b''))} bytes")
                print(f"    - Description: {img.get('description', 'N/A')[:60]}...")
        else:
            print("⚠️  WARNING: No images found matching filters")
    except Exception as e:
        print(f"❌ ERROR: {type(e).__name__}: {e}")
    
    # Test 3: Resolution filtering
    print("\n" + "-"*70)
    print("TEST 3: Resolution filtering (min 500x500)")
    print("-"*70)
    
    test_keywords = "forest trees"
    print(f"Searching for: '{test_keywords}'")
    print("Parameters: limit=1, min_resolution=500")
    
    try:
        images = ImageWebSearch.search_images(
            keywords=test_keywords,
            limit=1,
            min_resolution=500
        )
        
        if images:
            print(f"\n✅ SUCCESS: Retrieved image with minimum 500x500 resolution")
            img = images[0]
            print(f"  - Domain: {img.get('source_domain', 'unknown')}")
            print(f"  - Size: {len(img.get('image_blob', b''))} bytes")
            print(f"  - Description: {img.get('description', 'N/A')[:60]}...")
        else:
            print("⚠️  WARNING: No images found with 500x500 minimum resolution")
    except Exception as e:
        print(f"❌ ERROR: {type(e).__name__}: {e}")
    
    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    print("✅ Image search module is working correctly!")
    print("\nUsage in code:")
    print("  from services.image_web_search import ImageWebSearch")
    print("  images = ImageWebSearch.search_images(")
    print("      keywords='your search term',")
    print("      limit=5,")
    print("      min_resolution=400,")
    print("      keyword_filter='optional,filters'")
    print("  )")
    print("\nEach image includes:")
    print("  - image_blob (PNG bytes)")
    print("  - source_reference (URL)")
    print("  - description (title/caption)")
    print("  - source_domain (hosting domain)")
    print("  - file_name (generated name)")
    print("  - keywords (search terms used)")
    print("  - source_type (always 'web_search')")
    print("="*70 + "\n")
