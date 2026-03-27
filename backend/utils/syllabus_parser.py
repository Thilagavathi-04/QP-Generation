import pdfplumber
import re
from typing import List, Dict, Tuple
from core.database import get_placeholder

def roman_to_int(roman: str) -> int:
    """Convert Roman numeral to integer"""
    roman_map = {'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100}
    result = 0
    prev_value = 0
    
    for char in reversed(roman.upper()):
        value = roman_map.get(char, 0)
        if value < prev_value:
            result -= value
        else:
            result += value
        prev_value = value
    
    return result

# ==================== STEP 1: EXTRACT RAW TEXT ====================
def extract_raw_text_from_pdf(pdf_path: str) -> str:
    """Extract raw text from PDF without parsing anything"""
    raw_text = ""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    raw_text += page_text + "\n"
    except Exception as e:
        raise Exception(f"Error reading PDF: {str(e)}")
    
    return raw_text

# ==================== STEP 2: NORMALIZE TEXT ====================
def normalize_text(text: str) -> str:
    """Normalize the text: fix spaces, dashes, line breaks"""
    if not text:
        return ""
    
    # Fix multiple spaces
    text = re.sub(r' +', ' ', text)
    
    # Normalize dashes (replace various dash types with standard hyphen)
    text = text.replace('–', '-').replace('—', '-').replace('−', '-')
    
    # Fix line breaks: remove excessive newlines
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    # Remove trailing/leading spaces from each line
    lines = [line.strip() for line in text.split('\n')]
    text = '\n'.join(lines)
    
    # Remove lines that are just whitespace
    lines = [line for line in lines if line]
    text = '\n'.join(lines)
    
    return text

# ==================== STEP 3: LOCATE UNIT HEADERS ====================
def locate_unit_headers(text: str) -> List[Dict]:
    """Locate all UNIT headers using regex and treat them as anchors"""
    unit_anchors = []
    lines = text.split('\n')
    
    # Regex patterns to match various UNIT header formats:
    # UNIT I, UNIT-I, UNIT I:, UNIT 1, etc.
    unit_patterns = [
        re.compile(r'^UNIT[\s\-]*([IVX]+|[0-9]+)[\s\:\-]*(.*)$', re.IGNORECASE),
        re.compile(r'^UNIT[\s]*([IVX]+|[0-9]+)[\s\:\-]+(.+)$', re.IGNORECASE),
    ]
    
    for line_idx, line in enumerate(lines):
        line_stripped = line.strip()
        
        for pattern in unit_patterns:
            match = pattern.match(line_stripped)
            
            if match:
                unit_identifier = match.group(1).strip()
                unit_title = match.group(2).strip() if match.group(2) else ""
                
                # Convert Roman numeral to integer, or use numeric value
                try:
                    if unit_identifier.isdigit():
                        unit_number = int(unit_identifier)
                    else:
                        unit_number = roman_to_int(unit_identifier)
                except:
                    continue
                
                unit_anchors.append({
                    'unit_number': unit_number,
                    'unit_title': unit_title,
                    'line_index': line_idx,
                    'original_line': line_stripped
                })
                break  # Found a match, move to next line
    
    return unit_anchors

# ==================== STEP 4: SLICE DOCUMENT BY UNIT BOUNDARIES ====================
def detect_section_header(line: str) -> bool:
    """Detect if a line is a non-UNIT section header (e.g., COURSE OUTCOMES, REFERENCES, etc.)"""
    line_upper = line.strip().upper()
    
    # Common section headers that indicate end of UNIT content
    section_headers = [
        'COURSE OUTCOMES',
        'COURSE OUTCOME',
        'LEARNING OUTCOMES',
        'LEARNING OUTCOME',
        'REFERENCES',
        'REFERENCE',
        'TEXT BOOKS',
        'TEXTBOOKS',
        'TEXT BOOK',
        'TEXTBOOK',
        'REFERENCE BOOKS',
        'REFERENCE BOOK',
        'SUGGESTED READINGS',
        'SUGGESTED READING',
        'BIBLIOGRAPHY',
        'ADDITIONAL RESOURCES',
        'WEB RESOURCES',
        'ONLINE RESOURCES',
        'ASSESSMENT',
        'EVALUATION',
        'GRADING',
        'COURSE PLAN',
        'LESSON PLAN',
        'SYLLABUS CONTENT',
        'CO-PO MAPPING',
        'MAPPING',
        'OBJECTIVES',
        'COURSE OBJECTIVES',
    ]
    
    # Check if line matches any section header
    for header in section_headers:
        if line_upper.startswith(header) or line_upper == header:
            return True
    
    # Also check for patterns like "5. REFERENCES" or "5.REFERENCES"
    if re.match(r'^\d+[\.\)]\s*[A-Z\s]+$', line_upper):
        for header in section_headers:
            if header in line_upper:
                return True
    
    return False

def slice_text_by_units(text: str, unit_anchors: List[Dict]) -> List[Dict]:
    """
    Slice the document to only the text between UNIT headers (ignore everything else).
    Stop extraction when encountering non-UNIT section headers.
    """
    lines = text.split('\n')
    unit_slices = []
    
    for i, anchor in enumerate(unit_anchors):
        start_line = anchor['line_index'] + 1  # Start after the UNIT header
        
        # Determine end line
        if i + 1 < len(unit_anchors):
            # Next UNIT exists - use it as boundary
            end_line = unit_anchors[i + 1]['line_index']
        else:
            # This is the last UNIT - scan for section headers or use end of document
            end_line = len(lines)
            
            # Scan from start_line to find first section header
            for line_idx in range(start_line, len(lines)):
                if detect_section_header(lines[line_idx]):
                    end_line = line_idx
                    break
        
        # Extract text slice
        unit_content = '\n'.join(lines[start_line:end_line])
        
        unit_slices.append({
            'unit_number': anchor['unit_number'],
            'unit_title': anchor['unit_title'],
            'content': unit_content.strip()
        })
    
    return unit_slices

# ==================== STEP 5: SPLIT INTO TOPIC CANDIDATES ====================
def extract_topic_candidates(unit_content: str) -> List[str]:
    """For each UNIT slice, split content into topic candidates using - , . separators"""
    if not unit_content:
        return []
    
    candidates = []
    
    # Strategy 1: Split by lines and look for topic patterns
    lines = unit_content.split('\n')
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Check if line contains topic separators (-, :, etc.)
        if any(sep in line for sep in [' - ', ' – ', ': ', ' : ']):
            # First split by these separators
            parts = re.split(r'\s*[\-–:]\s*', line)
            # Then further split each part by commas/semicolons so that
            # densely packed lists (a, b, c, ...) become individual
            # topic candidates instead of one long string.
            for part in parts:
                part = part.strip()
                if not part:
                    continue
                subparts = re.split(r'\s*[,;]\s*', part)
                candidates.extend([sp.strip() for sp in subparts if sp.strip()])
        
        # Split by commas or semicolons (for subtopics) when no -/: present
        elif any(sep in line for sep in [', ', '; ', ' , ', ' ; ']):
            parts = re.split(r'\s*[,;]\s*', line)
            candidates.extend([p.strip() for p in parts if p.strip()])
        
        # Split by periods if they're clearly separating items
        elif line.count('.') > 1:
            parts = re.split(r'\.\s+', line)
            candidates.extend([p.strip() for p in parts if p.strip() and len(p.strip()) > 3])
        
        else:
            # Add as single candidate
            candidates.append(line)
    
    return candidates

def identify_topics_from_candidates(candidates: List[str]) -> List[Dict]:
    """Identify which candidates are topics vs subtopics"""
    topics = []
    current_topic = None
    
    for candidate in candidates:
        if not candidate or len(candidate) < 3:
            continue
        
        # Topic indicators:
        # - Starts with capital letter
        # - Not too long (< 100 chars typically)
        # - Doesn't start with lowercase or special chars
        
        is_likely_topic = (
            candidate[0].isupper() and 
            len(candidate) < 150 and
            not candidate.startswith(tuple('0123456789-.,;'))
        )
        
        if is_likely_topic and (':' in candidate or '-' in candidate):
            # Split into topic and subtopics
            parts = re.split(r'\s*[\-–:]\s*', candidate, maxsplit=1)
            
            if len(parts) >= 2:
                topic_name = parts[0].strip()
                subtopics_text = parts[1].strip()
                
                # Further split subtopics by commas, semicolons
                subtopics = re.split(r'\s*[,;]\s*', subtopics_text)
                subtopics = [s.strip().rstrip('.,;:') for s in subtopics if s.strip() and len(s.strip()) > 2]
                
                current_topic = {
                    'topic_name': topic_name,
                    'subtopics': subtopics
                }
                topics.append(current_topic)
            else:
                # Single topic without subtopics
                current_topic = {
                    'topic_name': candidate.rstrip('.,;:'),
                    'subtopics': []
                }
                topics.append(current_topic)
        
        elif is_likely_topic:
            # Standalone topic
            current_topic = {
                'topic_name': candidate.rstrip('.,;:'),
                'subtopics': []
            }
            topics.append(current_topic)
        
        else:
            # Likely a subtopic - add to current topic if exists
            if current_topic:
                current_topic['subtopics'].append(candidate.rstrip('.,;:'))
    
    # If no topics found, create a general topic with all candidates
    if not topics and candidates:
        topics.append({
            'topic_name': 'General Topics',
            'subtopics': [c.rstrip('.,;:') for c in candidates if c and len(c) > 2]
        })
    
    return topics

# ==================== STEP 6: CLEAN, VALIDATE, AND SAVE ====================
def clean_and_validate_topic(topic_name: str) -> str:
    """Clean and validate topic name"""
    if not topic_name:
        return ""
    
    # Remove extra spaces
    topic_name = ' '.join(topic_name.split())
    
    # Remove trailing punctuation
    topic_name = topic_name.rstrip('.,;:-()')
    
    # Remove leading numbers or bullets
    topic_name = re.sub(r'^[\d\.\)\]\-\s]+', '', topic_name)
    
    # Capitalize first letter if not already
    if topic_name and topic_name[0].islower():
        topic_name = topic_name[0].upper() + topic_name[1:]
    
    return topic_name.strip()

def clean_and_validate_subtopic(subtopic_name: str) -> str:
    """Clean and validate subtopic name"""
    if not subtopic_name:
        return ""
    
    # Remove extra spaces
    subtopic_name = ' '.join(subtopic_name.split())
    
    # Remove trailing punctuation
    subtopic_name = subtopic_name.rstrip('.,;:-()')
    
    # Remove leading bullets or numbers
    subtopic_name = re.sub(r'^[\d\.\)\]\-\s]+', '', subtopic_name)
    
    # Must have at least 3 characters
    if len(subtopic_name) < 3:
        return ""
    
    return subtopic_name.strip()

def parse_syllabus(pdf_path: str) -> Dict:
    """
    Main function to parse syllabus PDF using the 6-step approach:
    1. Extract raw text from PDF
    2. Normalize the text (fix spaces, dashes, line breaks)
    3. Locate all UNIT headers using regex as anchors
    4. Slice document to only text between UNIT headers
    5. Split content into topic candidates using separators
    6. Clean, validate, and return structured data
    """
    try:
        # STEP 1: Extract raw text
        raw_text = extract_raw_text_from_pdf(pdf_path)
        
        if not raw_text.strip():
            raise Exception("No text content found in PDF")
        
        # STEP 2: Normalize text
        normalized_text = normalize_text(raw_text)
        
        # STEP 3: Locate UNIT headers
        unit_anchors = locate_unit_headers(normalized_text)
        
        if not unit_anchors:
            raise Exception("No UNIT headers found in syllabus")
        
        # STEP 4: Slice by unit boundaries
        unit_slices = slice_text_by_units(normalized_text, unit_anchors)
        
        # STEP 5 & 6: Extract, clean, and validate topics
        parsed_units = []
        
        for unit_slice in unit_slices:
            # Extract topic candidates
            candidates = extract_topic_candidates(unit_slice['content'])
            
            # Identify topics from candidates
            topics = identify_topics_from_candidates(candidates)
            
            # Clean and validate
            cleaned_topics = []
            for topic in topics:
                clean_topic_name = clean_and_validate_topic(topic['topic_name'])
                
                if not clean_topic_name:
                    continue
                
                clean_subtopics = []
                for subtopic in topic['subtopics']:
                    clean_subtopic = clean_and_validate_subtopic(subtopic)
                    if clean_subtopic:
                        clean_subtopics.append(clean_subtopic)
                
                cleaned_topics.append({
                    'topic_name': clean_topic_name,
                    'subtopics': clean_subtopics
                })
            
            # Only add unit if it has topics
            if cleaned_topics:
                parsed_units.append({
                    'unit_number': unit_slice['unit_number'],
                    'unit_title': unit_slice['unit_title'],
                    'topics': cleaned_topics
                })
        
        return {
            'success': True,
            'units': parsed_units
        }
    
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

def save_syllabus_to_db(connection, subject_id: int, parsed_data: Dict, subject_code: str) -> bool:
    """
    Save parsed syllabus data to database using transactions
    """
    if not parsed_data.get('success'):
        return False
    
    try:
        cursor = connection.cursor()
        placeholder = get_placeholder()
        
        # Delete existing syllabus data for this subject
        cursor.execute(f"DELETE FROM units WHERE subject_id = {placeholder}", (subject_id,))
        
        # Insert units, topics, and subtopics
        for unit_data in parsed_data['units']:
            # Insert unit
            cursor.execute(f"""
                INSERT INTO units (subject_id, unit_number, unit_title)
                VALUES ({placeholder}, {placeholder}, {placeholder})
            """, (subject_id, unit_data['unit_number'], unit_data['unit_title']))
            
            unit_id = cursor.lastrowid
            unit_number = unit_data['unit_number']
            
            # Insert topics
            topic_index = 1
            for topic_data in unit_data['topics']:
                # Generate unique topic_id: subjectid_unit{unit_number}_topic{topic_index}
                unique_topic_id = f"{subject_code}_unit{unit_number}_topic{topic_index}"
                
                cursor.execute(f"""
                    INSERT INTO topics (topic_id, unit_id, topic_name)
                    VALUES ({placeholder}, {placeholder}, {placeholder})
                """, (unique_topic_id, unit_id, topic_data['topic_name']))
                
                topic_id = cursor.lastrowid
                topic_index += 1
                
                # Insert subtopics
                for subtopic_name in topic_data['subtopics']:
                    cursor.execute(f"""
                        INSERT INTO subtopics (topic_id, subtopic_name)
                        VALUES ({placeholder}, {placeholder})
                    """, (topic_id, subtopic_name))
        
        connection.commit()
        cursor.close()
        return True
    
    except Exception as e:
        connection.rollback()
        print(f"Error saving syllabus to DB: {str(e)}")
        return False
