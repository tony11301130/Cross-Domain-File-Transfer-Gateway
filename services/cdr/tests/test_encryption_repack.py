import sys
import os
import io
import shutil
import zipfile
# Ensure we can import the app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../")))

try:
    from app.sanitizers.archive.repacker import ArchiveRepacker
except ImportError:
    # Adjust path if run from different location
    # Was: d:/user/Documents/code/Cross-Domain-File-Transfer-Gateway/services/cdr
    # Now: d:/user/Documents/code/Cross-Domain-File-Transfer-Gateway/services/cdr/tests
    # We need to go up 4 levels to get to root if we want absolute path from relative...
    # But let's just use the absolute path approach or adjust relative.
    # The original relative path was: os.path.join(os.path.dirname(__file__), "../../../")
    # Now it should be "../../../../"
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../")))
    from app.sanitizers.archive.repacker import ArchiveRepacker

def test_repack_with_encryption():
    print("Testing ArchiveRepacker with AES Encryption...")
    
    # 1. Create dummy content
    test_dir = "test_repack_dir"
    if os.path.exists(test_dir):
        shutil.rmtree(test_dir)
    os.makedirs(test_dir)
    with open(os.path.join(test_dir, "secret.txt"), "w") as f:
        f.write("This is a secret message.")

    # 2. Repack with password
    password = "MyStrongPassword123!"
    repacker = ArchiveRepacker("application/zip")
    output_buffer = io.BytesIO()
    
    try:
        repacker.repack(test_dir, output_buffer, password=password)
        print("Repack successful.")
    except Exception as e:
        print(f"Repack FAILED: {e}")
        return

    # 3. Verify Encryption
    output_buffer.seek(0)
    
    # Try opening without password (should fail to read content)
    try:
        with zipfile.ZipFile(output_buffer, "r") as zf:
            print("Zip content:", zf.namelist())
            try:
                # Attempt to read (should require password)
                # Note: zipfile might not throw error immediately on open, but on read
                data = zf.read("secret.txt") 
                # If we get here without password, it's NOT encrypted
                print("FAILURE: Read file WITHOUT password! Encryption failed.")
            except RuntimeError as e:
                if "password required" in str(e).lower():
                    print("SUCCESS: Reading without password failed as expected.")
                else:
                     print(f"Unexpected error reading without password: {e}")
    except Exception as e:
         print(f"Error inspecting zip: {e}")

    # 4. Try opening WITH password (should succeed)
    output_buffer.seek(0)
    try:
        with zipfile.ZipFile(output_buffer, "r") as zf:
            zf.setpassword(password.encode())
            data = zf.read("secret.txt")
            if data.decode() == "This is a secret message.":
                print("SUCCESS: Decrypted content matches original.")
            else:
                print("FAILURE: Content mismatch.")
    except Exception as e:
        print(f"FAILURE: Could not decrypt with correct password: {e}")

    # Cleanup
    if os.path.exists(test_dir):
        shutil.rmtree(test_dir)

if __name__ == "__main__":
    test_repack_with_encryption()
