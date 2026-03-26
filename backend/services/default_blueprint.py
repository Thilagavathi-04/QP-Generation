# backend/default_blueprint.py

DEFAULT_BLUEPRINT_STRUCTURE = {
    "name": "Default University Blueprint",
    "description": "A standard 100-mark question paper blueprint with three parts (A, B, C). Part A contains 10 questions of 2 marks each (Easy difficulty), Part B contains 5 questions of 5 marks each (Medium difficulty), and Part C contains 5 questions of 11 marks each (Hard difficulty). This blueprint is automatically created by the system if no custom blueprints are available.",
    "total_marks": 100,
    "parts": [
        {
            "name": "Part A",
            "count": 10,
            "marks_per_question": 2,
            "difficulty": "Easy",
            "instruction": "Answer all questions."
        },
        {
            "name": "Part B",
            "count": 5,
            "marks_per_question": 5,
            "difficulty": "Medium",
            "instruction": "Answer all questions."
        },
        {
            "name": "Part C",
            "count": 5,
            "marks_per_question": 11,
            "difficulty": "Hard",
            "instruction": "Answer all questions."
        }
    ]
}
