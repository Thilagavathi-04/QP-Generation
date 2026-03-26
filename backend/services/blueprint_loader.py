from services.blueprint_repository import BlueprintRepository
from services.blueprint_guard import BlueprintGuard

class BlueprintLoader:
    """
    Structured loader for blueprints and their associations.
    """
    
    @staticmethod
    def load_for_generation(blueprint_id: int):
        """
        Loads the blueprint using the safeguard and repository.
        Ensures the returned object is ready for matching with a Question Bank.
        """
        # 1. Use Guard to verify existence and check persistence
        blueprint = BlueprintGuard.verify_existence(blueprint_id)
        
        # 2. Log retrieval event safely
        print(f"Blueprint Retrieval Event: Loaded '{blueprint['name']}' (ID: {blueprint['id']}) for generation.")
        
        return blueprint

    @staticmethod
    def list_all():
        """Retrieve all blueprints from the primary persistence layer."""
        from core.database import get_db_connection, get_cursor
        
        connection = get_db_connection()
        if not connection:
            return []
            
        try:
            cursor = get_cursor(connection)
            cursor.execute("SELECT * FROM blueprints ORDER BY updated_at DESC")
            return [dict(row) for row in cursor.fetchall()]
        finally:
            connection.close()
