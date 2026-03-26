from fastapi import HTTPException
from services.blueprint_repository import BlueprintRepository
import os

class BlueprintGuard:
    """
    Validation and safety layer for blueprint retrieval and generation.
    """
    
    @staticmethod
    def verify_existence(blueprint_id: int):
        """
        Validates blueprint existence before generation.
        Returns the blueprint record if found, otherwise raises a detailed HTTPException.
        """
        if not blueprint_id:
            raise HTTPException(
                status_code=400, 
                detail="Blueprint ID is required for generation."
            )
            
        blueprint = BlueprintRepository.get_by_id(blueprint_id)
        
        if not blueprint:
            raise HTTPException(
                status_code=404, 
                detail="Blueprint exists in UI but is not persisted. Please save blueprint before generation."
            )
            
        # Convert sqlite3.Row to dict to support .get()
        blueprint = dict(blueprint)
            
        # Check if physical file exists for generation logic
        file_path = blueprint.get('file_path')
        if not file_path or not os.path.exists(file_path):
            # Attempt to recover by re-saving if we have parts_config
            parts_config = blueprint.get('parts_config')
            if parts_config:
                 print(f"Blueprint {blueprint_id} missing file on disk. Attempting recovery...")
                 BlueprintRepository.save_blueprint(
                     name=blueprint['name'],
                     description=blueprint.get('description'),
                     parts_config=parts_config,
                     blueprint_id=blueprint_id
                 )
                 # Re-fetch
                 blueprint = BlueprintRepository.get_by_id(blueprint_id)
                 file_path = blueprint.get('file_path')
            
            if not file_path or not os.path.exists(file_path):
                raise HTTPException(
                    status_code=404, 
                    detail="Blueprint configuration file is missing from server. Please re-save the blueprint structure."
                )
                
        return blueprint

    @staticmethod
    def align_with_question_bank(blueprint, question_bank_id):
        """
        Optional: Logic to pre-check if question bank has enough questions for each part.
        Currently ensures the blueprint is treated as a grounding constraint.
        """
        # Blueprint is NOT optional, NOT inferred
        if not blueprint:
            raise ValueError("Blueprint alignment failed: No blueprint provided.")
        
        # Additional checks can be added here to ensure the bank matches blueprint parts
        return True
