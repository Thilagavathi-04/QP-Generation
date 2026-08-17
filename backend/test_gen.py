import requests
import time

try:
    res = requests.post('http://localhost:8010/api/subjects/63/generate-questions', json={
        "from_unit": 1,
        "to_unit": 5,
        "count": 2,
        "marks": 2,
        "difficulty": "medium",
        "part_name": "Part A",
        "ai_provider": "ollama",
        "plan": []
    })
    print("POST response:", res.json())

    job_id = res.json().get('job_id')
    if job_id:
        while True:
            status = requests.get(f'http://localhost:8010/api/jobs/{job_id}').json()
            print("Status:", status.get('status'))
            if status.get('status') in ['completed', 'failed']:
                print(status)
                break
            time.sleep(2)
except Exception as e:
    print("Error:", e)
