import requests
import json

def test_ollama():
    prompt = "Generate 3 easy one word questions about Python programming. Write each question on a new line without numbering."
    url = "http://localhost:11434/api/generate"
    payload = {
        "model": "mistral:latest",
        "prompt": prompt,
        "stream": False
    }
    
    print(f"Calling Ollama: {url}")
    try:
        response = requests.post(url, json=payload, timeout=60)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print("\n=== OLLAMA RESPONSE ===")
            print(result.get('response', 'NO RESPONSE'))
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Connection Error: {e}")

if __name__ == "__main__":
    test_ollama()
