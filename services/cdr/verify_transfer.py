import sys
import os
import logging

# Configure logging to stdout
logging.basicConfig(level=logging.INFO)

# Adjust path to ensure we can import app
sys.path.append('/app')

try:
    from app.utils.transfer import transfer_file_to_remote
    print("Import successful")
except ImportError as e:
    print(f"Import failed: {e}")
    sys.exit(1)

# Create dummy file
test_filename = "test_connectivity_check.txt"
with open(test_filename, "w") as f:
    f.write("This is a test file from cdr-worker verification.")

try:
    print(f"Attempting transfer of {test_filename}...")
    remote = transfer_file_to_remote(test_filename)
    print(f"SUCCESS: Transferred to {remote}")
except Exception as e:
    print(f"FAILURE: {e}")
    sys.exit(1)
