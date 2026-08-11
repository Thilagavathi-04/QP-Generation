import os
import sys

sys.path.append(os.getcwd())

import numpy as np

from services import rag_chunker


class _FakeSemanticModel:
    def encode(self, sentences, normalize_embeddings=True):
        vectors = []
        for sentence in sentences:
            lowered = sentence.lower()
            if any(token in lowered for token in ["algebra", "equation", "matrix", "linear"]):
                vectors.append([1.0, 0.0])
            elif any(token in lowered for token in ["biology", "cell", "mammal", "organism"]):
                vectors.append([0.0, 1.0])
            else:
                vectors.append([0.5, 0.5])
        return np.array(vectors, dtype=float)


def run_test():
    original_model_loader = rag_chunker._get_embedding_model
    original_min_length = rag_chunker.SEMANTIC_CHUNK_MIN_CHAR_LENGTH

    try:
        rag_chunker._get_embedding_model = lambda: _FakeSemanticModel()
        rag_chunker.SEMANTIC_CHUNK_MIN_CHAR_LENGTH = 0

        documents = [
            {
                "text": (
                    "Algebra studies equations and linear relationships. "
                    "Matrix operations build on the same ideas. "
                    "Biology studies cells and organisms. "
                    "Mammals nurse their young and adapt to environments."
                ),
                "metadata": {"filename": "semantic-smoke.pdf", "subject_id": "demo"},
            }
        ]

        chunks = rag_chunker.process_documents_to_chunks(documents)

        assert len(chunks) == 2, f"Expected 2 semantic chunks, got {len(chunks)}: {chunks}"
        assert "Algebra studies equations" in chunks[0]["text"]
        assert "Biology studies cells" in chunks[1]["text"]

        print("Semantic chunking smoke test passed.")
    finally:
        rag_chunker._get_embedding_model = original_model_loader
        rag_chunker.SEMANTIC_CHUNK_MIN_CHAR_LENGTH = original_min_length


if __name__ == "__main__":
    run_test()