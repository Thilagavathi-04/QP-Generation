import sys
import os
from pathlib import Path

sys.path.append(os.getcwd())

from services.qdrant_client import qdrant_manager
from services.rag_retrieval import retrieve_context

def run_debug():
    with open("debug_output_retrieval.txt", "w") as f:
        subject_id = "1234"
        
        if qdrant_manager:
            f.write("DEBUG: Testing retrieval WITHOUT where clause...\n")
            res_no_where = qdrant_manager.query(
                query_text="What is this about?",
                n_results=5,
            )
            f.write(f"  Results count: {len(res_no_where['documents'][0]) if res_no_where['documents'] else 0}\n")
            if res_no_where['metadatas'] and res_no_where['metadatas'][0]:
                f.write(f"  First result metadata: {res_no_where['metadatas'][0][0]}\n")

            f.write("\nDEBUG: Testing retrieval WITH subject_id only...\n")
            res_sid = qdrant_manager.query(
                query_text="What is this about?",
                n_results=5,
                subject_id=subject_id,
            )
            f.write(f"  Results count: {len(res_sid['documents'][0]) if res_sid['documents'] else 0}\n")

            f.write("\nDEBUG: Testing retrieval WITH doc_type only...\n")
            res_type = qdrant_manager.query(
                query_text="What is this about?",
                n_results=5,
                doc_type="syllabus",
            )
            f.write(f"  Results count: {len(res_type['documents'][0]) if res_type['documents'] else 0}\n")

if __name__ == "__main__":
    run_debug()
