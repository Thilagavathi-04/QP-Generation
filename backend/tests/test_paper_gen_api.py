import requests
import json
import os

def test_paper_generation():
    url = "http://localhost:8010/api/question-papers/generate"
    
    # We'll use multipart/form-data as expected by the backend
    data = {
        'title': 'Test Examination Paper',
        'subject_id': '15', # AIP
        'question_bank_id': '3', # The bank we verified earlier
        'blueprint_id': '1', # Default blueprint
        'exam_type': 'Regular',
        'exam_date': '2026-05-20',
        'duration': '3',
        'file_format': 'pdf'
    }
    
    print(f"Calling API: {url}")
    
    try:
        # FastAPI Form parameters are sent as data in requests.post
        response = requests.post(url, data=data, timeout=300)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("\n=== PAPER GENERATED SUCCESS ===")
            print(f"Paper ID: {result.get('id')}")
            print(f"Title: {result.get('title')}")
            print(f"File Path: {result.get('file_path')}")
            
            if os.path.exists(result.get('file_path')):
                print("Confirmed: File exists on disk.")
            else:
                print("Warning: File path returned but file not found on disk.")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_paper_generation()
