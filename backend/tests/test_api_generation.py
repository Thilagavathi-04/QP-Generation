import requests
import json
import sys

# Force UTF-8 for console output
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def test_generation():
    url = "http://localhost:8010/api/subjects/15/generate-questions"
    payload = {
        "from_unit": 1,
        "to_unit": 1,
        "count": 5,
        "marks": 2.0,
        "difficulty": "Medium",
        "part_name": "Part A"
    }
    
    print(f"Calling API: {url}")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(url, json=payload, timeout=600)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("\n=== GENERATED QUESTIONS ===")
            for i, q in enumerate(data.get('questions', [])):
                print(f"{i+1}. {q['content']} ({q['marks']} marks)")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Connection Error: {e}")

if __name__ == "__main__":
    test_generation()
