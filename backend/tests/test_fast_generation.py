import time

from services.question_generator import _extract_json_payload, generate_questions_with_ollama


def test_extract_json_payload_accepts_json_list_and_markdown_wrapper():
    list_payload = '[{"content": "A"}, {"content": "B"}]'
    assert _extract_json_payload(list_payload) == {"questions": [{"content": "A"}, {"content": "B"}]}

    fenced_payload = '```json\n{"questions": [{"content": "A"}]}\n```'
    assert _extract_json_payload(fenced_payload) == {"questions": [{"content": "A"}]}


def main():
    print("Testing question generation speed...")
    start_time = time.time()

    questions = generate_questions_with_ollama(
        topics=["Data Structures", "Arrays", "Linked Lists"],
        count=3,
        marks=2,
        difficulty="medium",
        part_name="Part A",
        ai_provider="ollama"
    )

    elapsed = time.time() - start_time
    print(f"Generated {len(questions)} questions in {elapsed:.2f} seconds!")
    for idx, q in enumerate(questions, 1):
        print(f"{idx}. {q.get('content')}")


if __name__ == "__main__":
    main()
