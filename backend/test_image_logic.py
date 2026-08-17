import sys
import os
import io

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.image_extractor import is_valid_extracted_image, determine_image_type, extract_caption_from_context
from services.image_integration import calculate_image_match_score

print("--- Testing Image Extractor Logic ---")
print(f"Valid image (800x600): {is_valid_extracted_image(800, 600)}")
print(f"Tiny image (40x40): {is_valid_extracted_image(40, 40)}")
print(f"Line border (1000x10): {is_valid_extracted_image(1000, 10)}")

print(f"Caption extraction 1: {extract_caption_from_context('some text here Fig. 3.4 Architecture of CNN and other stuff')}")
print(f"Caption extraction 2: {extract_caption_from_context('Random text Table 1 Comparison of algorithms and other stuff')}")

print("--- Testing Image Matching Logic ---")
q1 = "Explain the architecture of a convolutional neural network."
keywords1 = ["architecture", "convolutional", "neural", "network", "cnn"]

img1 = {
    "keywords": "diagram network layers",
    "description": "A diagram of CNN",
    "caption": "Figure 5.2 Convolutional Neural Network Architecture",
    "context": "Here we describe the architecture of CNN.",
    "source_type": "textbook"
}

img2 = {
    "keywords": "logo university",
    "description": "University logo",
    "caption": "",
    "context": "",
    "source_type": "textbook"
}

try:
    score1 = calculate_image_match_score(q1, img1, keywords1)
    print(f"Score for highly relevant image: {score1:.3f}")
    
    score2 = calculate_image_match_score(q1, img2, keywords1)
    print(f"Score for unrelated logo: {score2:.3f}")
except Exception as e:
    print(f"Error calculating score: {e}")

