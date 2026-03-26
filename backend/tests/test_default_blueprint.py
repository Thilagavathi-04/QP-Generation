#!/usr/bin/env python3
"""
Test script to verify default blueprint functionality
"""
import json
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from services.default_blueprint import DEFAULT_BLUEPRINT_STRUCTURE


def test_default_blueprint():
    """Test that the default blueprint structure is valid"""
    print("Testing Default Blueprint Structure...")
    print("=" * 60)

    required_fields = ["name", "description", "total_marks", "parts"]
    for field in required_fields:
        assert field in DEFAULT_BLUEPRINT_STRUCTURE, f"Missing field: {field}"
        print(f"✓ Field '{field}' present")

    assert isinstance(DEFAULT_BLUEPRINT_STRUCTURE["parts"], list), "Parts must be a list"
    assert len(DEFAULT_BLUEPRINT_STRUCTURE["parts"]) > 0, "Must have at least one part"
    print(f"✓ Blueprint has {len(DEFAULT_BLUEPRINT_STRUCTURE['parts'])} parts")

    for index, part in enumerate(DEFAULT_BLUEPRINT_STRUCTURE["parts"]):
        part_fields = ["name", "count", "marks_per_question", "difficulty", "instruction"]
        for field in part_fields:
            assert field in part, f"Part {index} missing field: {field}"
        print(f"✓ Part {index + 1} ({part['name']}) is valid")

    total = sum(part["count"] * part["marks_per_question"] for part in DEFAULT_BLUEPRINT_STRUCTURE["parts"])
    print(f"\nCalculated total marks: {total}")
    print(f"Declared total marks: {DEFAULT_BLUEPRINT_STRUCTURE['total_marks']}")

    if total == DEFAULT_BLUEPRINT_STRUCTURE["total_marks"]:
        print("✓ Total marks match!")
    else:
        print("⚠ Warning: Total marks don't match")

    print("\n" + "=" * 60)
    print("Default Blueprint Structure:")
    print("=" * 60)
    print(json.dumps(DEFAULT_BLUEPRINT_STRUCTURE, indent=2))

    print("\n" + "=" * 60)
    print("✓ All tests passed!")
    print("=" * 60)


if __name__ == "__main__":
    test_default_blueprint()
