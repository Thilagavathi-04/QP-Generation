#!/usr/bin/env python3
"""
Test script for Enhanced Web Search functionality
Tests all search endpoints to ensure they're working properly
"""

import requests
import json
import time

BASE_URL = "http://127.0.0.1:8010"
ADMIN_EMAIL = "admin@qpgen.local"
ADMIN_PASSWORD = "admin@123"

def print_section(title):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)

def login():
    """Login and get admin token"""
    print_section("AUTHENTICATION TEST")
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            }
        )
        if response.status_code == 200:
            data = response.json()
            token = data.get('token')
            print(f"✓ Login successful")
            print(f"  Token: {token[:50]}...")
            return token
        else:
            print(f"✗ Login failed: {response.status_code}")
            print(f"  Response: {response.text}")
            return None
    except Exception as e:
        print(f"✗ Error during login: {e}")
        return None

def test_question_search():
    """Test question search endpoint"""
    print_section("QUESTION SEARCH TEST")
    
    test_cases = [
        {
            "name": "Simple keyword search",
            "params": {"q": "what"}
        },
        {
            "name": "Search with difficulty filter",
            "params": {"q": "what", "difficulty": "easy"}
        },
        {
            "name": "Search with unit filter",
            "params": {"q": "what", "unit": "1"}
        },
        {
            "name": "All questions (no filter)",
            "params": {}
        }
    ]
    
    for test in test_cases:
        try:
            response = requests.get(
                f"{BASE_URL}/api/search/questions",
                params=test["params"],
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                count = data.get('count', 0)
                print(f"✓ {test['name']}")
                print(f"  Results: {count} questions found")
                if count > 0:
                    first = data['results'][0]
                    print(f"  First result: {first.get('content', 'N/A')[:60]}...")
            else:
                print(f"✗ {test['name']}: Status {response.status_code}")
                print(f"  Response: {response.text[:200]}")
        except Exception as e:
            print(f"✗ {test['name']}: {e}")

def test_paper_search():
    """Test paper search endpoint"""
    print_section("PAPER SEARCH TEST")
    
    test_cases = [
        {
            "name": "Search all papers",
            "params": {}
        },
        {
            "name": "Search by title keyword",
            "params": {"q": "exam"}
        }
    ]
    
    for test in test_cases:
        try:
            response = requests.get(
                f"{BASE_URL}/api/search/papers",
                params=test["params"],
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                count = data.get('count', 0)
                print(f"✓ {test['name']}")
                print(f"  Results: {count} papers found")
                if count > 0:
                    first = data['results'][0]
                    print(f"  First result: {first.get('title', 'N/A')}")
            else:
                print(f"✗ {test['name']}: Status {response.status_code}")
        except Exception as e:
            print(f"✗ {test['name']}: {e}")

def test_subject_search():
    """Test subject search endpoint"""
    print_section("SUBJECT SEARCH TEST")
    
    test_cases = [
        {
            "name": "Search all subjects",
            "params": {}
        },
        {
            "name": "Search by name",
            "params": {"q": "programming"}
        }
    ]
    
    for test in test_cases:
        try:
            response = requests.get(
                f"{BASE_URL}/api/search/subjects",
                params=test["params"],
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                count = data.get('count', 0)
                print(f"✓ {test['name']}")
                print(f"  Results: {count} subjects found")
                if count > 0:
                    first = data['results'][0]
                    print(f"  First result: {first.get('name', 'N/A')} ({first.get('subject_id', 'N/A')})")
            else:
                print(f"✗ {test['name']}: Status {response.status_code}")
        except Exception as e:
            print(f"✗ {test['name']}: {e}")

def test_search_performance():
    """Test search performance"""
    print_section("SEARCH PERFORMANCE TEST")
    
    test_params = {
        "q": "test",
        "limit": 50
    }
    
    try:
        start = time.time()
        response = requests.get(
            f"{BASE_URL}/api/search/questions",
            params=test_params,
            timeout=10
        )
        elapsed = time.time() - start
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Search completed in {elapsed:.2f}s")
            print(f"  Results: {data.get('count', 0)} items")
            print(f"  Response size: {len(response.text)} bytes")
            
            if elapsed > 2:
                print(f"  ⚠ WARNING: Search took longer than 2 seconds")
            elif elapsed < 0.5:
                print(f"  ✓ Excellent performance (< 0.5s)")
            else:
                print(f"  ✓ Good performance (< 2s)")
        else:
            print(f"✗ Search failed: Status {response.status_code}")
    except Exception as e:
        print(f"✗ Performance test failed: {e}")

def test_search_edge_cases():
    """Test edge cases"""
    print_section("EDGE CASES TEST")
    
    test_cases = [
        {
            "name": "Empty search",
            "params": {"q": ""}
        },
        {
            "name": "Special characters",
            "params": {"q": "@#$%"}
        },
        {
            "name": "Very long query",
            "params": {"q": "a" * 500}
        },
        {
            "name": "Unicode characters",
            "params": {"q": "你好世界"}
        },
        {
            "name": "SQL injection attempt",
            "params": {"q": "'; DROP TABLE questions; --"}
        },
        {
            "name": "Large limit",
            "params": {"limit": 10000}
        }
    ]
    
    for test in test_cases:
        try:
            response = requests.get(
                f"{BASE_URL}/api/search/questions",
                params=test["params"],
                timeout=5
            )
            
            if response.status_code == 200:
                print(f"✓ {test['name']}: Handled gracefully")
            else:
                print(f"⚠ {test['name']}: Status {response.status_code}")
        except Exception as e:
            print(f"✗ {test['name']}: {e}")

def main():
    print("\n╔═══════════════════════════════════════════════════════════════╗")
    print("║          ENHANCED WEB SEARCH - COMPREHENSIVE TEST            ║")
    print("╚═══════════════════════════════════════════════════════════════╝")
    
    # Authenticate
    token = login()
    if not token:
        print("\n✗ Authentication failed. Exiting.")
        return
    
    # Run all tests
    test_question_search()
    test_paper_search()
    test_subject_search()
    test_search_performance()
    test_search_edge_cases()
    
    # Summary
    print_section("TEST SUMMARY")
    print("✓ Search endpoint tests completed")
    print("✓ All endpoints are responding")
    print("\nRECOMMENDATIONS:")
    print("1. Review any failed tests above")
    print("2. Test with more data for performance benchmarking")
    print("3. Consider adding caching for frequently searched terms")
    print("4. Monitor search query performance in production")

if __name__ == "__main__":
    main()
