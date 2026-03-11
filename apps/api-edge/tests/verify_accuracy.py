import sys
from pathlib import Path
import json

# Add app directory to path
sys.path.append(str(Path(__file__).parent.parent))

from app.services.omr import omr_service

def verify():
    # Path to POC sample image
    image_path = Path("../../../OMR-POC/answer1.png")
    
    if not image_path.exists():
        print(f"Error: Sample image not found at {image_path}")
        return

    print(f"Processing {image_path.name}...")
    result = omr_service.process_scan(image_path)
    
    student_info = result["data"]["student_info"]
    last_name = student_info["last_name"]["answer"]
    first_name = student_info["first_name"]["answer"]
    lrn = student_info["lrn"]["answer"]
    
    print("\n--- OMR Extraction Results ---")
    print(f"Last Name:  {last_name}")
    print(f"First Name: {first_name}")
    print(f"LRN:        {lrn}")
    
    # Check subjects
    print("\n--- Subject Scores (Question 1) ---")
    for sub in ["math", "english", "science"]:
        q1 = result["data"]["answers"].get(sub, {}).get("1", {})
        print(f"{sub.capitalize()}: Q1={q1.get('answer')} (Conf: {q1.get('confidence')})")

    # Simple logic check
    if last_name and first_name:
        print("\n✅ Parsing Successful!")
    else:
        print("\n❌ Parsing Failed: Name empty")

if __name__ == "__main__":
    verify()
