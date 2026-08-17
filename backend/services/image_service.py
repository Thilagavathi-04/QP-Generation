"""
Image Service Module
Handles database operations for question images.

Images are persisted in both database (metadata + blob) and filesystem
for easier inspection/reuse under backend/data/question_images.
"""

from __future__ import annotations

import hashlib
import io
from pathlib import Path
from typing import Any, Dict, List, Optional

from PIL import Image

from core.database import get_db_connection, get_cursor, get_placeholder
from services.rag_config import logger


BASE_DIR = Path(__file__).resolve().parent.parent
QUESTION_IMAGE_ROOT = BASE_DIR / "data" / "question_images"
QUESTION_IMAGE_ROOT.mkdir(parents=True, exist_ok=True)


def _slugify(value: str, max_len: int = 64) -> str:
    value = (value or "").strip().lower()
    chars = []
    for ch in value:
        if ch.isalnum():
            chars.append(ch)
        elif chars and chars[-1] != "_":
            chars.append("_")
    slug = "".join(chars).strip("_")
    return (slug[:max_len] or "unknown")


def _pick_primary_keyword(keywords: str) -> str:
    parts = [p.strip() for p in (keywords or "").replace(";", ",").split(",") if p.strip()]
    return parts[0] if parts else "general"


def _source_folder(source_type: str) -> str:
    src = (source_type or "").strip().lower()
    if src in {"web_search", "web"}:
        return "web"
    if src in {"pdf_extraction", "textbook", "book"}:
        return "textbook"
    if src == "generated":
        return "generated"
    return "other"


def _image_metadata(image_blob: bytes) -> tuple[str, int, int, str]:
    try:
        with Image.open(io.BytesIO(image_blob)) as img:
            fmt = (img.format or "PNG").upper()
            width, height = img.size
    except Exception:
        fmt, width, height = "PNG", 0, 0

    extension_map = {
        "JPEG": "jpg",
        "JPG": "jpg",
        "PNG": "png",
        "WEBP": "webp",
        "GIF": "gif",
        "BMP": "bmp",
        "TIFF": "tiff",
    }
    ext = extension_map.get(fmt, "png")
    mime = f"image/{'jpeg' if ext == 'jpg' else ext}"
    return ext, width, height, mime


def _write_image_file(keywords: str, source_type: str, image_blob: bytes) -> tuple[str, str, str, int, int]:
    file_hash = hashlib.sha256(image_blob).hexdigest()
    ext, width, height, mime = _image_metadata(image_blob)

    keyword_folder = _slugify(_pick_primary_keyword(keywords), max_len=48)
    target_dir = QUESTION_IMAGE_ROOT / _source_folder(source_type) / keyword_folder
    target_dir.mkdir(parents=True, exist_ok=True)

    file_name = f"{file_hash[:16]}.{ext}"
    file_path = target_dir / file_name
    if not file_path.exists():
        file_path.write_bytes(image_blob)

    rel_path = file_path.relative_to(BASE_DIR).as_posix()
    return rel_path, file_hash, mime, width, height


class ImageService:
    """Service for managing images in the database"""

    @staticmethod
    def _hydrate_blob_if_needed(image_row: Dict[str, Any]) -> Dict[str, Any]:
        if image_row.get("image_blob"):
            return image_row

        rel_path = image_row.get("file_path")
        if not rel_path:
            return image_row

        candidate = BASE_DIR / rel_path
        if candidate.exists():
            try:
                image_row["image_blob"] = candidate.read_bytes()
            except Exception as exc:
                logger.warning(f"Failed to load image bytes from file system ({candidate}): {exc}")

        return image_row

    @staticmethod
    def save_image(
        keywords: str,
        description: str,
        image_blob: bytes,
        caption: str = "",
        context: str = "",
        source_type: str = "pdf_extraction",
        source_reference: str = None,
        file_name: str = None,
    ) -> Optional[int]:
        """
        Save an image in both DB and filesystem.

        Web images are grouped by keyword folder under:
        backend/data/question_images/web/<keyword>/
        """
        if not image_blob:
            logger.error("Cannot save empty image blob")
            return None

        connection = get_db_connection()
        if not connection:
            logger.error("Failed to get database connection")
            return None

        try:
            rel_path, file_hash, mime_type, width, height = _write_image_file(keywords, source_type, image_blob)

            cursor = get_cursor(connection)
            placeholder = get_placeholder()

            # Deduplicate by hash if image already exists.
            cursor.execute(
                f"SELECT id FROM question_images WHERE file_hash = {placeholder} LIMIT 1",
                [file_hash],
            )
            existing = cursor.fetchone()
            if existing:
                existing_id = existing["id"] if isinstance(existing, dict) else existing[0]
                logger.info(f"Reused existing image with ID: {existing_id}")
                cursor.close()
                connection.close()
                return existing_id

            resolved_file_name = file_name or Path(rel_path).name
            query = f"""
                INSERT INTO question_images
                (keywords, description, caption, context, image_blob, source_type, source_reference, file_name, file_path, file_hash, mime_type, width, height)
                VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
            """

            cursor.execute(
                query,
                [
                    keywords,
                    description,
                    caption,
                    context,
                    image_blob,
                    source_type,
                    source_reference,
                    resolved_file_name,
                    rel_path,
                    file_hash,
                    mime_type,
                    width,
                    height,
                ],
            )
            connection.commit()

            image_id = cursor.lastrowid if hasattr(cursor, "lastrowid") else None
            logger.info(f"Saved image with ID: {image_id} at {rel_path}")

            cursor.close()
            connection.close()
            return image_id

        except Exception as e:
            logger.error(f"Error saving image: {e}")
            connection.rollback()
            connection.close()
            return None

    @staticmethod
    def _execute_and_fetch(query: str, params: List[Any]) -> List[Dict[str, Any]]:
        connection = get_db_connection()
        if not connection:
            logger.error("Failed to get database connection")
            return []

        try:
            cursor = get_cursor(connection)
            cursor.execute(query, params)
            results = cursor.fetchall() or []
            cursor.close()
            connection.close()
            return [ImageService._hydrate_blob_if_needed(dict(row)) for row in results]
        except Exception as e:
            logger.error(f"Error querying images: {e}")
            connection.close()
            return []

    @staticmethod
    def get_image_by_keywords(keywords: str, limit: int = 5) -> List[Dict[str, Any]]:
        keyword_list = [kw.strip() for kw in (keywords or "").split(",") if kw.strip()]
        if not keyword_list:
            return []

        placeholder = get_placeholder()
        conditions = []
        params: List[Any] = []
        for kw in keyword_list[:10]:
            conditions.append(f"keywords LIKE {placeholder}")
            params.append(f"%{kw}%")

        query = f"""
            SELECT id, keywords, description, caption, context, image_blob, source_type, source_reference,
                   file_name, file_path, file_hash, mime_type, width, height
            FROM question_images
            WHERE {' OR '.join(conditions)}
            ORDER BY id DESC
            LIMIT {placeholder}
        """
        params.append(limit)
        return ImageService._execute_and_fetch(query, params)

    @staticmethod
    def get_image_by_description(description: str, limit: int = 5) -> List[Dict[str, Any]]:
        placeholder = get_placeholder()
        query = f"""
            SELECT id, keywords, description, caption, context, image_blob, source_type, source_reference,
                   file_name, file_path, file_hash, mime_type, width, height
            FROM question_images
            WHERE description LIKE {placeholder}
            ORDER BY id DESC
            LIMIT {placeholder}
        """
        return ImageService._execute_and_fetch(query, [f"%{description}%", limit])

    @staticmethod
    def get_image_by_id(image_id: int) -> Optional[Dict[str, Any]]:
        placeholder = get_placeholder()
        query = f"""
            SELECT id, keywords, description, caption, context, image_blob, source_type, source_reference,
                   file_name, file_path, file_hash, mime_type, width, height
            FROM question_images
            WHERE id = {placeholder}
            LIMIT 1
        """
        rows = ImageService._execute_and_fetch(query, [image_id])
        return rows[0] if rows else None

    @staticmethod
    def search_images(query: str, limit: int = 10) -> List[Dict[str, Any]]:
        placeholder = get_placeholder()
        query_terms = (query or "").lower().split()
        stop_words = {
            "the", "a", "an", "and", "or", "is", "are", "was", "were",
            "in", "on", "at", "to", "of", "for", "with",
        }
        query_terms = [t for t in query_terms if t not in stop_words and len(t) > 2]

        if not query_terms:
            pattern = f"%{query}%"
            sql = f"""
                SELECT id, keywords, description, caption, context, image_blob, source_type, source_reference,
                       file_name, file_path, file_hash, mime_type, width, height
                FROM question_images
                WHERE keywords LIKE {placeholder} OR description LIKE {placeholder}
                ORDER BY id DESC
                LIMIT {placeholder}
            """
            return ImageService._execute_and_fetch(sql, [pattern, pattern, limit])

        conditions = []
        params: List[Any] = []
        for term in query_terms[:5]:
            conditions.append(f"(keywords LIKE {placeholder} OR description LIKE {placeholder})")
            params.append(f"%{term}%")
            params.append(f"%{term}%")

        where_clause = " OR ".join(conditions)
        sql = f"""
            SELECT id, keywords, description, caption, context, image_blob, source_type, source_reference,
                   file_name, file_path, file_hash, mime_type, width, height
            FROM question_images
            WHERE {where_clause}
            ORDER BY id DESC
            LIMIT {placeholder}
        """
        params.append(limit)
        return ImageService._execute_and_fetch(sql, params)

    @staticmethod
    def delete_image(image_id: int) -> bool:
        connection = get_db_connection()
        if not connection:
            logger.error("Failed to get database connection")
            return False

        try:
            cursor = get_cursor(connection)
            placeholder = get_placeholder()

            cursor.execute(
                f"SELECT file_path FROM question_images WHERE id = {placeholder}",
                [image_id],
            )
            row = cursor.fetchone()
            rel_path = row.get("file_path") if isinstance(row, dict) else None

            cursor.execute(f"DELETE FROM question_images WHERE id = {placeholder}", [image_id])
            connection.commit()

            if rel_path:
                file_path = BASE_DIR / rel_path
                try:
                    if file_path.exists():
                        file_path.unlink()
                except Exception as exc:
                    logger.warning(f"Failed to delete image file {file_path}: {exc}")

            cursor.close()
            connection.close()
            logger.info(f"Deleted image with ID: {image_id}")
            return True
        except Exception as e:
            logger.error(f"Error deleting image: {e}")
            connection.rollback()
            connection.close()
            return False

    @staticmethod
    def get_all_images(limit: int = 100) -> List[Dict[str, Any]]:
        placeholder = get_placeholder()
        query = f"""
            SELECT id, keywords, description, caption, context, source_type, source_reference,
                   file_name, file_path, file_hash, mime_type, width, height
            FROM question_images
            ORDER BY created_at DESC
            LIMIT {placeholder}
        """
        return ImageService._execute_and_fetch(query, [limit])
