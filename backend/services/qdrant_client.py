import hashlib
import atexit
import uuid
import warnings
from typing import List, Dict, Any, Optional

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from sentence_transformers import SentenceTransformer

from services.rag_config import (
    QDRANT_HOST,
    QDRANT_PORT,
    QDRANT_API_KEY,
    QDRANT_HTTPS,
    QDRANT_COLLECTION_NAME,
    EMBEDDING_MODEL_NAME,
    logger,
)


class QdrantManager:
    def __init__(self):
        try:
            warnings.filterwarnings(
                "ignore",
                message="Api key is used with an insecure connection.",
                category=UserWarning,
            )
            self.client = QdrantClient(
                host=QDRANT_HOST,
                port=QDRANT_PORT,
                api_key=QDRANT_API_KEY,
                https=QDRANT_HTTPS,
            )
            self.embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
            self.vector_size = self.embedding_model.get_sentence_embedding_dimension()
            self.collection_name = QDRANT_COLLECTION_NAME
            self._ensure_collection()
            logger.info(
                f"Connected to Qdrant server at {QDRANT_HOST}:{QDRANT_PORT} (https={QDRANT_HTTPS}), collection: {QDRANT_COLLECTION_NAME}"
            )
        except Exception as e:
            logger.error(f"Failed to initialize Qdrant: {e}")
            self.client = None
            self.embedding_model = None
            self.collection_name = None

    def _ensure_collection(self):
        if not self.client or not self.collection_name:
            return

        try:
            collections = self.client.get_collections().collections
            names = {collection.name for collection in collections}
            if self.collection_name not in names:
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=qmodels.VectorParams(size=self.vector_size, distance=qmodels.Distance.COSINE),
                )
        except Exception as e:
            logger.error(f"Error ensuring Qdrant collection: {e}")
            raise

    def _embed(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        embeddings = self.embedding_model.encode(texts, normalize_embeddings=True)
        return embeddings.tolist()

    def _stable_point_id(self, chunk: Dict[str, Any]) -> str:
        metadata = chunk.get("metadata", {})
        content = chunk.get("text", "")
        key = f"{metadata.get('subject_id', '')}|{metadata.get('doc_type', '')}|{metadata.get('filename', '')}|{content}"
        return str(uuid.uuid5(uuid.NAMESPACE_URL, key))

    def add_chunks(self, chunks: List[Dict[str, Any]]):
        if not self.client or not self.collection_name or not chunks:
            return False

        texts = [chunk.get("text", "") for chunk in chunks]
        vectors = self._embed(texts)

        points = []
        for chunk, vector in zip(chunks, vectors):
            metadata = chunk.get("metadata", {})
            payload = {
                "text": chunk.get("text", ""),
                "metadata": metadata,
                "doc_type": metadata.get("doc_type", "unknown"),
                "subject_id": str(metadata.get("subject_id", "")),
            }
            points.append(
                qmodels.PointStruct(
                    id=self._stable_point_id(chunk),
                    vector=vector,
                    payload=payload,
                )
            )

        try:
            logger.info(f"Upserting {len(points)} chunks into Qdrant.")
            self.client.upsert(collection_name=self.collection_name, points=points)
            return True
        except Exception as e:
            logger.error(f"Error adding chunks to Qdrant: {e}")
            return False

    def _build_filter(self, subject_id: Optional[str] = None, doc_type: Optional[str] = None) -> Optional[qmodels.Filter]:
        must_conditions = []

        if subject_id:
            must_conditions.append(
                qmodels.FieldCondition(
                    key="subject_id",
                    match=qmodels.MatchValue(value=str(subject_id))
                )
            )

        if doc_type:
            must_conditions.append(
                qmodels.FieldCondition(
                    key="doc_type",
                    match=qmodels.MatchValue(value=doc_type)
                )
            )

        if not must_conditions:
            return None

        return qmodels.Filter(must=must_conditions)

    def query(self, query_text: str, n_results: int = 5, subject_id: Optional[str] = None, doc_type: Optional[str] = None) -> Dict[str, Any]:
        if not self.client or not self.collection_name:
            return {"documents": [[]], "metadatas": [[]]}

        try:
            query_vector = self._embed([query_text])[0]
            query_filter = self._build_filter(subject_id=subject_id, doc_type=doc_type)
            response = self.client.query_points(
                collection_name=self.collection_name,
                query=query_vector,
                query_filter=query_filter,
                limit=n_results,
                with_payload=True,
            )
            points = response.points or []

            documents = []
            metadatas = []
            for point in points:
                payload = point.payload or {}
                documents.append(payload.get("text", ""))
                metadatas.append(payload.get("metadata", {}))

            return {"documents": [documents], "metadatas": [metadatas]}
        except Exception as e:
            logger.error(f"Error querying Qdrant: {e}")
            return {"documents": [[]], "metadatas": [[]]}

    def has_subject_data(self, subject_id: str) -> bool:
        if not self.client or not self.collection_name:
            return False

        try:
            query_filter = self._build_filter(subject_id=subject_id)
            points, _ = self.client.scroll(
                collection_name=self.collection_name,
                scroll_filter=query_filter,
                limit=1,
                with_payload=False,
                with_vectors=False,
            )
            return len(points) > 0
        except Exception as e:
            logger.error(f"Error checking subject data in Qdrant for {subject_id}: {e}")
            return False

    def close(self):
        if not self.client:
            return
        try:
            self.client.close()
        except Exception as e:
            logger.debug(f"Ignored Qdrant close error during shutdown: {e}")


try:
    qdrant_manager = QdrantManager()
except Exception:
    qdrant_manager = None
    logger.error("Could not create qdrant_manager singleton.")


def _shutdown_qdrant_client():
    if qdrant_manager:
        qdrant_manager.close()


atexit.register(_shutdown_qdrant_client)


def sync_subject_files_to_qdrant(subject_id: str, force: bool = False):
    from services.rag_ingestion import get_ingested_documents
    from services.rag_chunker import process_documents_to_chunks

    if not qdrant_manager or not qdrant_manager.client:
        return

    if not force and qdrant_manager.has_subject_data(subject_id):
        logger.info(f"Subject {subject_id} already has data in Qdrant. Skipping sync.")
        return

    docs = get_ingested_documents(subject_id)
    if docs:
        chunks = process_documents_to_chunks(docs)
        if chunks:
            success = qdrant_manager.add_chunks(chunks)
            if success:
                logger.info(f"Synced {len(chunks)} chunks for subject {subject_id}")
            else:
                logger.error(f"Failed to sync chunks for subject {subject_id}")
