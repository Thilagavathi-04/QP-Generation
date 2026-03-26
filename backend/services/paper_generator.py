"""
Question Paper Generator Module
Generates PDF and DOCX question papers from question banks using blueprints
"""

import json
import re
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any
from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from core.database import get_db_type


NUMBER_WORDS = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
}


def _parse_answer_any_count(instruction: str) -> int | None:
    text = (instruction or "").strip().lower()
    if not text:
        return None

    match = re.search(r"answer\s+any\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)", text)
    if not match:
        return None

    token = match.group(1)
    if token.isdigit():
        return int(token)
    return NUMBER_WORDS.get(token)


def _effective_answer_count(part: Dict[str, Any], fetched_questions_count: int) -> int:
    configured_count = int(part.get('num_questions') or part.get('count') or fetched_questions_count or 0)
    instruction = part.get('instructions') or part.get('instruction') or ""
    answer_any = _parse_answer_any_count(instruction)

    if answer_any is not None:
        return max(0, min(answer_any, configured_count, fetched_questions_count))
    return max(0, min(configured_count, fetched_questions_count))


def load_blueprint(blueprint_path: str) -> Dict[str, Any]:
    """Load blueprint from JSON file or parse DOCX file"""
    # Check if it's a JSON file
    if blueprint_path.lower().endswith('.json'):
        try:
            with open(blueprint_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except UnicodeDecodeError:
            # Try with different encoding if UTF-8 fails
            with open(blueprint_path, 'r', encoding='latin-1') as f:
                return json.load(f)
    
    # If it's a DOCX/DOC file, return a default blueprint structure
    elif blueprint_path.lower().endswith(('.docx', '.doc')):
        # Return a default blueprint structure for DOCX files
        return {
            "total_marks": 100,
            "parts": [
                {
                    "name": "Part A",
                    "count": 10,
                    "marks_per_question": 2,
                    "difficulty": "easy",
                    "description": "Multiple Choice Questions"
                },
                {
                    "name": "Part B",
                    "count": 5,
                    "marks_per_question": 5,
                    "difficulty": "medium",
                    "description": "Short Answer Questions"
                },
                {
                    "name": "Part C",
                    "count": 3,
                    "marks_per_question": 10,
                    "difficulty": "hard",
                    "description": "Long Answer Questions"
                }
            ]
        }
    else:
        raise ValueError(f"Unsupported blueprint file format: {blueprint_path}")


def fetch_questions_for_part(
    cursor,
    question_bank_id: int,
    part_name: str,
    count: int,
    difficulty: str = None,
    marks: float = None
) -> List[Dict]:
    """Fetch questions from database matching criteria with fallback logic"""
    
    db_type = get_db_type()
    rand_func = "RANDOM()" if db_type == "sqlite" else "RAND()"
    placeholder = "?" if db_type == "sqlite" else "%s"
    
    print(f"\n  📋 Fetching questions for {part_name}")
    print(f"     Question Bank ID: {question_bank_id}")
    print(f"     Requested count: {count}")
    print(f"     Difficulty: {difficulty}")
    print(f"     Marks: {marks}")
    
    # ✅ Strategy 1: Match by difficulty and marks (NO part name filter)
    query = f"""
        SELECT id, content, part, unit, topic, difficulty, marks 
        FROM questions 
        WHERE question_bank_id = {placeholder}
    """
    params = [question_bank_id]
    
    # Add filters if provided
    if difficulty:
        query += f" AND LOWER(difficulty) = LOWER({placeholder})"
        params.append(difficulty)
    
    if marks:
        query += f" AND ABS(marks - {placeholder}) < 0.5"
        params.append(marks)
    
    query += f" ORDER BY {rand_func} LIMIT {placeholder}"
    params.append(count)
    
    cursor.execute(query, tuple(params))
    result = cursor.fetchall()
    print(f"     Strategy 1 (difficulty + marks): Found {len(result)} questions")
    
    # Strategy 2: If not enough, try with difficulty only (relax marks constraint)
    if len(result) < count and difficulty:
        print(f"     Trying Strategy 2 (difficulty only)...")
        query = f"""
            SELECT id, content, part, unit, topic, difficulty, marks 
            FROM questions 
            WHERE question_bank_id = {placeholder}
            AND LOWER(difficulty) = LOWER({placeholder})
            ORDER BY {rand_func}
            LIMIT {placeholder}
        """
        cursor.execute(query, (question_bank_id, difficulty, count))
        result = cursor.fetchall()
        print(f"     Strategy 2 (difficulty only): Found {len(result)} questions")
    
    # Strategy 3: If still not enough, try marks-based (relax difficulty)
    if len(result) < count and marks:
        print(f"     Trying Strategy 3 (marks-based)...")
        query = f"""
            SELECT id, content, part, unit, topic, difficulty, marks 
            FROM questions 
            WHERE question_bank_id = {placeholder}
            AND ABS(marks - {placeholder}) < 2.0
            ORDER BY {rand_func}
            LIMIT {placeholder}
        """
        cursor.execute(query, (question_bank_id, marks, count))
        result = cursor.fetchall()
        print(f"     Strategy 3 (marks-based): Found {len(result)} questions")
    
    # Strategy 4: Last resort - get any questions from the bank
    if len(result) < count:
        print(f"     Trying Strategy 4 (any questions)...")
        query = f"""
            SELECT id, content, part, unit, topic, difficulty, marks 
            FROM questions 
            WHERE question_bank_id = {placeholder}
            ORDER BY {rand_func}
            LIMIT {placeholder}
        """
        cursor.execute(query, (question_bank_id, count))
        result = cursor.fetchall()
        print(f"     Strategy 4 (any questions): Found {len(result)} questions")
    
    if not result:
        print(f"     ❌ ERROR: No questions found in question bank {question_bank_id}")
    else:
        print(f"     ✅ Successfully fetched {len(result)} questions")
    
    # Convert Row objects to dictionaries
    return [dict(row) for row in result]


def generate_docx_paper(
    title: str,
    subject_name: str,
    exam_type: str,
    exam_date: str,
    total_marks: int,
    duration: str,
    blueprint: Dict,
    questions_by_part: Dict[str, List[Dict]],
    output_path: str
):
    """Generate DOCX question paper"""
    
    doc = Document()
    
    # Set margins
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(0.5)
        section.bottom_margin = Inches(0.5)
        section.left_margin = Inches(0.75)
        section.right_margin = Inches(0.75)
    
    # Header
    header = doc.add_paragraph()
    header.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = header.add_run(title)
    run.bold = True
    run.font.size = Pt(16)
    
    # Subject and details
    details = doc.add_paragraph()
    details.alignment = WD_ALIGN_PARAGRAPH.CENTER
    details.add_run(f"{subject_name}\n").font.size = Pt(12)
    details.add_run(f"{exam_type} Examination").font.size = Pt(11)
    
    # Exam info table
    info = doc.add_paragraph()
    info.alignment = WD_ALIGN_PARAGRAPH.LEFT
    info.add_run(f"Date: {exam_date or 'TBD'}").font.size = Pt(10)
    info.add_run(f"\t\t\tDuration: {duration} hours" if duration else "").font.size = Pt(10)
    info.add_run(f"\t\t\tMax Marks: {total_marks}").font.size = Pt(10)
    
    doc.add_paragraph("_" * 80)
    
    # Instructions
    doc.add_paragraph()
    inst = doc.add_paragraph()
    inst.add_run("Instructions:\n").bold = True
    inst.add_run("1. Read all questions carefully before answering.\n")
    inst.add_run("2. Write your answers in the provided answer booklet.\n")
    inst.add_run("3. All questions are compulsory unless specified otherwise.\n")
    
    doc.add_paragraph("_" * 80)
    doc.add_paragraph()
    
    # Question sections
    question_number = 1
    
    for part in blueprint.get('parts', []):
        # Support both 'name' and 'part_name' keys
        part_name = part.get('part_name') or part.get('name')
        part_questions = questions_by_part.get(part_name, [])
        
        if not part_questions:
            continue
        
        # Part heading
        part_heading = doc.add_paragraph()
        part_heading.add_run(f"\n{part_name}").bold = True
        effective_count = _effective_answer_count(part, len(part_questions))
        part_heading.add_run(
            f" ({effective_count} × {part['marks_per_question']} = {effective_count * part['marks_per_question']} marks)"
        )
        part_heading.alignment = WD_ALIGN_PARAGRAPH.LEFT
        
        # Part instruction
        instruction = part.get('instructions') or part.get('instruction')
        if instruction:
            inst_para = doc.add_paragraph(instruction)
            inst_para.italic = True
        
        doc.add_paragraph()
        
        # Questions
        for q in part_questions:
            q_para = doc.add_paragraph()
            q_para.add_run(f"{question_number}. ").bold = True
            q_para.add_run(q['content'])
            
            question_number += 1
            doc.add_paragraph()
    
    # Footer
    doc.add_paragraph("_" * 80)
    footer = doc.add_paragraph()
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    footer.add_run("*** End of Question Paper ***").italic = True
    
    # Save
    doc.save(output_path)


def generate_pdf_paper(
    title: str,
    subject_name: str,
    exam_type: str,
    exam_date: str,
    total_marks: int,
    duration: str,
    blueprint: Dict,
    questions_by_part: Dict[str, List[Dict]],
    output_path: str
):
    """Generate PDF question paper"""
    
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=0.75*inch,
        leftMargin=0.75*inch,
        topMargin=0.5*inch,
        bottomMargin=0.5*inch
    )
    
    # Container for the 'Flowable' objects
    elements = []
    
    # Styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=16,
        textColor=colors.HexColor('#1a1a1a'),
        spaceAfter=12,
        alignment=1,  # Center
        fontName='Helvetica-Bold'
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=12,
        textColor=colors.HexColor('#333333'),
        spaceAfter=6,
        fontName='Helvetica-Bold'
    )
    
    normal_style = styles['Normal']
    
    # Title
    elements.append(Paragraph(title, title_style))
    elements.append(Paragraph(f"{subject_name}", heading_style))
    elements.append(Paragraph(f"{exam_type} Examination", normal_style))
    elements.append(Spacer(1, 0.2*inch))
    
    # Info line
    info_text = f"Date: {exam_date or 'TBD'} &nbsp;&nbsp;&nbsp; Duration: {duration} hours &nbsp;&nbsp;&nbsp; Max Marks: {total_marks}"
    elements.append(Paragraph(info_text, normal_style))
    elements.append(Spacer(1, 0.1*inch))
    elements.append(Paragraph("_" * 100, normal_style))
    elements.append(Spacer(1, 0.2*inch))
    
    # Instructions
    elements.append(Paragraph("<b>Instructions:</b>", normal_style))
    elements.append(Paragraph("1. Read all questions carefully before answering.", normal_style))
    elements.append(Paragraph("2. Write your answers in the provided answer booklet.", normal_style))
    elements.append(Paragraph("3. All questions are compulsory unless specified otherwise.", normal_style))
    elements.append(Spacer(1, 0.1*inch))
    elements.append(Paragraph("_" * 100, normal_style))
    elements.append(Spacer(1, 0.3*inch))
    
    # Questions
    question_number = 1
    
    for part in blueprint.get('parts', []):
        # Support both 'name' and 'part_name' keys
        part_name = part.get('part_name') or part.get('name')
        part_questions = questions_by_part.get(part_name, [])
        
        if not part_questions:
            continue
        
        # Part heading
        effective_count = _effective_answer_count(part, len(part_questions))
        part_text = (
            f"<b>{part_name}</b> ({effective_count} × {part['marks_per_question']} = "
            f"{effective_count * part['marks_per_question']} marks)"
        )
        elements.append(Paragraph(part_text, heading_style))
        
        instruction = part.get('instructions') or part.get('instruction')
        if instruction:
            elements.append(Paragraph(f"<i>{instruction}</i>", normal_style))
        
        elements.append(Spacer(1, 0.1*inch))
        
        # Questions
        for q in part_questions:
            q_text = f"<b>{question_number}.</b> {q['content']}"
            elements.append(Paragraph(q_text, normal_style))
            elements.append(Spacer(1, 0.15*inch))
            question_number += 1
        
        elements.append(Spacer(1, 0.2*inch))
    
    # Footer
    elements.append(Paragraph("_" * 100, normal_style))
    elements.append(Spacer(1, 0.1*inch))
    footer_style = ParagraphStyle('Footer', parent=normal_style, alignment=1)
    elements.append(Paragraph("<i>*** End of Question Paper ***</i>", footer_style))
    
    # Build PDF
    doc.build(elements)


def generate_question_paper(
    cursor,
    title: str,
    subject_id: int,
    subject_name: str,
    question_bank_id: int,
    blueprint_path: str,
    exam_type: str,
    exam_date: str,
    duration: str,
    file_format: str,
    output_path: str
) -> str:
    """
    Main function to generate question paper
    
    Returns: path to generated file
    """
    
    # Load blueprint
    blueprint = load_blueprint(blueprint_path)
    
    # ✅ Add debug logging
    print(f"\n{'='*60}")
    print(f"🎯 GENERATING QUESTION PAPER")
    print(f"{'='*60}")
    print(f"📄 Title: {title}")
    print(f"📚 Subject: {subject_name} (ID: {subject_id})")
    print(f"🏦 Question Bank ID: {question_bank_id}")
    print(f"📋 Blueprint: {blueprint.get('name', 'Unnamed')}")
    print(f"📊 Parts in blueprint: {len(blueprint.get('parts', []))}")
    print(f"📝 Format: {file_format.upper()}")
    print(f"{'='*60}\n")
    
    # Fetch questions for each part
    questions_by_part = {}
    
    for part in blueprint.get('parts', []):
        # Support both 'name' and 'part_name' keys
        part_name = part.get('part_name') or part.get('name')
        
        # Support both 'count' and 'num_questions' keys
        count = part.get('num_questions') or part.get('count')
        
        difficulty = part.get('difficulty')
        marks = part.get('marks_per_question')
        
        print(f"🔍 Processing: {part_name}")
        print(f"   Requested: {count} questions @ {marks} marks each")
        print(f"   Difficulty: {difficulty or 'Any'}")
        
        questions = fetch_questions_for_part(
            cursor,
            question_bank_id,
            part_name,
            count,
            difficulty,
            marks
        )
        
        if len(questions) < count:
            print(f"   ⚠️  WARNING: Could only fetch {len(questions)}/{count} questions!")
        else:
            print(f"   ✅ Successfully fetched {len(questions)} questions")
        
        questions_by_part[part_name] = questions
    
    # ✅ Check if we have any questions at all
    total_questions = sum(len(qs) for qs in questions_by_part.values())
    print(f"\n{'='*60}")
    print(f"📊 SUMMARY")
    print(f"{'='*60}")
    print(f"Total questions fetched: {total_questions}")
    
    if total_questions == 0:
        raise Exception("❌ No questions found in the question bank! Please add questions first.")
    
    # Calculate total marks based on effective answerable questions (e.g., "Answer any 2")
    total_marks = 0
    for part in blueprint.get('parts', []):
        part_name = part.get('part_name') or part.get('name')
        part_questions = questions_by_part.get(part_name, [])
        effective_count = _effective_answer_count(part, len(part_questions))
        total_marks += effective_count * float(part.get('marks_per_question') or 0)
    
    print(f"Total marks: {total_marks}")
    print(f"Output file: {output_path}")
    print(f"{'='*60}\n")
    
    # Generate paper based on format
    if file_format.lower() == 'pdf':
        print("📄 Generating PDF...")
        generate_pdf_paper(
            title, subject_name, exam_type, exam_date or 'TBD',
            total_marks, duration, blueprint, questions_by_part, output_path
        )
    elif file_format.lower() == 'docx':
        print("📄 Generating DOCX...")
        generate_docx_paper(
            title, subject_name, exam_type, exam_date or 'TBD',
            total_marks, duration, blueprint, questions_by_part, output_path
        )
    else:
        raise ValueError(f"Unsupported file format: {file_format}")
    
    print(f"\n✅ Question paper generated successfully!")
    print(f"📁 Location: {output_path}")
    print(f"{'='*60}\n")
    
    return output_path, questions_by_part