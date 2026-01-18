import requests
import base64
import time
import os
import sys

# Configuration
BASE_URL = "http://localhost:8001"
PNG_FILE = "test_image.png"
TXT_FILE = "test_text.txt"

# Minimal 1x1 PNG Base64
MINIMAL_PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5K5kJggg=="

def create_test_files():
    # Create PNG
    with open(PNG_FILE, "wb") as f:
        f.write(base64.b64decode(MINIMAL_PNG_B64))
    
    # Create Text File
    with open(TXT_FILE, "w") as f:
        f.write("This is a simple text file, not supported by CDR.")

def cleanup_files():
    if os.path.exists(PNG_FILE): os.remove(PNG_FILE)
    if os.path.exists(TXT_FILE): os.remove(TXT_FILE)
    if os.path.exists("sanitized_output.png"): os.remove("sanitized_output.png")

def wait_for_service(retries=10, delay=1):
    print("Checking service health...")
    for i in range(retries):
        try:
            resp = requests.get(f"{BASE_URL}/health")
            if resp.status_code == 200:
                print("Service is UP!")
                return True
        except requests.exceptions.ConnectionError:
            pass
        print(f"Waiting for service... ({i+1}/{retries})")
        time.sleep(delay)
    return False

def test_sanitize_image():
    print("\n[Test 1] Sanitizing Image (Supported)...")
    try:
        files = {'file': (PNG_FILE, open(PNG_FILE, 'rb'), 'image/png')}
        resp = requests.post(f"{BASE_URL}/sanitize", files=files)
        
        if resp.status_code == 200:
            print("Status: SUCCESS (200)")
            print(f"Original Size: {os.path.getsize(PNG_FILE)} bytes")
            print(f"Sanitized Size: {len(resp.content)} bytes")
            with open("sanitized_output.png", "wb") as f:
                f.write(resp.content)
            print("Saved sanitized output to 'sanitized_output.png'")
        else:
            print(f"Status: FAILED ({resp.status_code})")
            print(f"Response: {resp.text}")
            
    except Exception as e:
        print(f"Exception: {e}")

def test_sanitize_unsupported():
    print("\n[Test 2] Sanitizing Text File (Unsupported)...")
    try:
        files = {'file': (TXT_FILE, open(TXT_FILE, 'rb'), 'text/plain')}
        resp = requests.post(f"{BASE_URL}/sanitize", files=files)
        
        if resp.status_code == 415:
            print("Status: SUCCESS (415 Unsupported Media Type)")
            print(f"Response: {resp.json()}")
        else:
            print(f"Status: UNEXPECTED ({resp.status_code}) - Expected 415")
            print(f"Response: {resp.text}")
            
    except Exception as e:
        print(f"Exception: {e}")

def test_sanitize_pptx_simulation():
    print("\n[Test 3] Sanitizing PPTX (Simulation)...")
    try:
        # We upload the TXT file but CLAIM it is a PPTX.
        # This tests if the router accepts the MIME type and tries to process it.
        # It should fail with 500 (Internal Error) because python-pptx cannot open a text file.
        # If it returns 415, then our router update FAILED.
        
        pptx_mime = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        files = {'file': (TXT_FILE, open(TXT_FILE, 'rb'), pptx_mime)}
        
        resp = requests.post(f"{BASE_URL}/sanitize", files=files)
        
        if resp.status_code == 500:
            print("Status: SUCCESS (500) - Router accepted MIME, parsing failed as expected.")
            print(f"Response: {resp.json()}")
        elif resp.status_code == 415:
            print("Status: FAILED (415) - Router did not accept PPTX MIME type.")
        else:
            print(f"Status: UNEXPECTED ({resp.status_code})")
            print(f"Response: {resp.text}")

    except Exception as e:
        print(f"Exception: {e}")

def main():
    try:
        create_test_files()
        
        if not wait_for_service():
            print("Service failed to start.")
            sys.exit(1)
            
        test_sanitize_image()
        test_sanitize_unsupported()
        test_sanitize_pptx_simulation()
        
    finally:
        cleanup_files()

if __name__ == "__main__":
    main()
