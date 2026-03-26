import pdfplumber
import json
from typing import Dict, List, Any
from services.question_generator import (
    get_marks_instruction,
    get_blooms_level,
    get_blooms_instruction,
    generate_json_with_ai,
)


def extract_text_from_pdf(file_path: str) -> str:
    """
    Extract text content from a PDF file
    
    Args:
        file_path: Path to the PDF file
    
    Returns:
        Extracted text as string
    """
    text = ""
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception as e:
        print(f"Error extracting text from PDF: {e}")
    
    return text




def generate_answer_script(questions_by_part: Dict[str, List[Dict]]) -> List[Dict[str, Any]]:
    """
    Generate model answers for a set of questions using AI
    """
    all_answers = []
    
    # Flatten questions into a single list
    flat_questions = []
    for part_name, questions in questions_by_part.items():
        for q in questions:
            q['part'] = part_name
            flat_questions.append(q)
            
    print(f"Generating answers for {len(flat_questions)} questions...")
    
    for idx, q in enumerate(flat_questions):
        question_text = q.get('content', '')
        marks = q.get('marks', 0)
        marks_instruction = get_marks_instruction(marks)
        blooms_level = get_blooms_level(marks)
        blooms_instruction = get_blooms_instruction(blooms_level)

        if marks <= 1:
            expected_points_range = "1-3"
        elif marks <= 3:
            expected_points_range = "2-4"
        else:
            expected_points_range = "3-5"
        
        prompt = f"""
        You are an academic expert. Generate an official model answer for the following question.
        
        Question: {question_text}
        Marks allocated: {marks}

        STRICT MARKS-TO-ANSWER MAPPING:
        - {marks_instruction}
        - Bloom's level required: {blooms_level}
        - {blooms_instruction}

        NON-NEGOTIABLE RULES:
        - The answer depth, structure, and expected length MUST match the marks allocated.
        - Do not over-write short-mark answers or under-write high-mark answers.
        - Keep content academically correct, clear, and relevant to the question.
        
        Provide:
        1. A high-quality model answer that would receive full marks.
        2. A concise list of {expected_points_range} key expected points or keywords that an evaluator should look for.
        
        Format your response as a JSON object with strictly these keys:
        {{
            "answer": "the full model answer here",
            "expected_points": "point 1, point 2, point 3..."
        }}
        
        Return ONLY the JSON. No preamble or postscript.
        """
        
        try:
            data = generate_json_with_ai(prompt=prompt, timeout=120, temperature=0.4)

            if isinstance(data, dict):
                all_answers.append({
                    "question": question_text,
                    "answer": data.get("answer", "Answer generation failed"),
                    "marks": marks,
                    "expected_points": data.get("expected_points", ""),
                    "part": q.get('part')
                })
            else:
                all_answers.append({
                    "question": question_text,
                    "answer": "Error generating answer",
                    "marks": marks,
                    "expected_points": "",
                    "part": q.get('part')
                })
        except Exception as e:
            print(f"Error for question {idx+1}: {e}")
            all_answers.append({
                "question": question_text,
                "answer": f"Error: {str(e)}",
                "marks": marks,
                "expected_points": "",
                "part": q.get('part')
            })
            
    return all_answers


def grade_student_paper(answer_script: Dict[str, Any], student_text: str) -> Dict[str, Any]:
    """
    Grade a student's paper against model answers
    
    Args:
        answer_script: Model answers and grading rubric
        student_text: Student's submitted answer text
    
    Returns:
        Dictionary containing grading results, scores, and feedback
    """
    # TODO: Implement actual AI-based grading
    print("WARNING: grade_student_paper is a stub function")
    print(f"  - Student text length: {len(student_text)} characters")
    
    # Return empty grading result
    return {
        "total_score": 0,
        "max_score": 0,
        "percentage": 0,
        "feedback": "Grading functionality is not yet implemented",
        "question_scores": []
    }
