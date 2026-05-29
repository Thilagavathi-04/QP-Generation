#!/bin/bash
# Quick Test Script for Enhanced Search
# Run this to verify search endpoints are working

echo "🔍 Enhanced Web Search - Quick Test"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://127.0.0.1:8010"

# Test 1: Login
echo -e "${YELLOW}Test 1: Authentication${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@qpgen.local","password":"admin@123"}')

if echo "$LOGIN_RESPONSE" | grep -q "token"; then
  echo -e "${GREEN}✓ Login successful${NC}"
  TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
else
  echo -e "${RED}✗ Login failed${NC}"
  echo "Make sure backend is running on port 8010"
  exit 1
fi

echo ""

# Test 2: Question Search
echo -e "${YELLOW}Test 2: Question Search${NC}"
QUESTION_RESPONSE=$(curl -s "$BASE_URL/api/search/questions?q=&limit=5")
QUESTION_COUNT=$(echo "$QUESTION_RESPONSE" | grep -o '"count":[0-9]*' | cut -d':' -f2)

if [ ! -z "$QUESTION_COUNT" ]; then
  echo -e "${GREEN}✓ Question search working${NC}"
  echo "  Found $QUESTION_COUNT questions"
else
  echo -e "${RED}✗ Question search failed${NC}"
fi

echo ""

# Test 3: Paper Search
echo -e "${YELLOW}Test 3: Paper Search${NC}"
PAPER_RESPONSE=$(curl -s "$BASE_URL/api/search/papers?q=&limit=5")
PAPER_COUNT=$(echo "$PAPER_RESPONSE" | grep -o '"count":[0-9]*' | cut -d':' -f2)

if [ ! -z "$PAPER_COUNT" ]; then
  echo -e "${GREEN}✓ Paper search working${NC}"
  echo "  Found $PAPER_COUNT papers"
else
  echo -e "${RED}✗ Paper search failed${NC}"
fi

echo ""

# Test 4: Subject Search
echo -e "${YELLOW}Test 4: Subject Search${NC}"
SUBJECT_RESPONSE=$(curl -s "$BASE_URL/api/search/subjects?q=&limit=5")
SUBJECT_COUNT=$(echo "$SUBJECT_RESPONSE" | grep -o '"count":[0-9]*' | cut -d':' -f2)

if [ ! -z "$SUBJECT_COUNT" ]; then
  echo -e "${GREEN}✓ Subject search working${NC}"
  echo "  Found $SUBJECT_COUNT subjects"
else
  echo -e "${RED}✗ Subject search failed${NC}"
fi

echo ""

# Test 5: Search with Filters
echo -e "${YELLOW}Test 5: Filtered Search${NC}"
FILTERED_RESPONSE=$(curl -s "$BASE_URL/api/search/questions?q=what&difficulty=easy&limit=5")
if echo "$FILTERED_RESPONSE" | grep -q '"success"'; then
  echo -e "${GREEN}✓ Filtered search working${NC}"
  echo "  Search with difficulty filter successful"
else
  echo -e "${RED}✗ Filtered search failed${NC}"
fi

echo ""
echo -e "${GREEN}✓ All tests completed!${NC}"
echo ""
echo "Next Steps:"
echo "1. Open http://localhost:5173 in your browser"
echo "2. Navigate to Question Bank"
echo "3. Test the enhanced search input"
echo "4. Try different filter combinations"
