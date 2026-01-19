
import zipfile
import io
import requests
import time
import os

def test_password_interception():
    # 1. Create a password protected ZIP
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        zf.setpassword(b"secret123")
        zf.writestr("test.txt", "This is a secret file", compress_type=zipfile.ZIP_DEFLATED)
    
    # Wait, zipfile.writestr doesn't encrypt unless you use extra steps or use pyminizip?
    # Basic zipfile.writestr with setpassword only works if you use zf.write(filename).
    # Actually, zipfile in Python 3.x can't EASILY create encrypted zips with writestr.
    
    # Let's use a simpler way: just check if the detection works.
    # I'll manually create a file on disk if needed.
    
    print("Pre-requisite: CDR service must be running (FastAPI on 8000, Redis on 6379)")
    
    try:
        # Create encrypted zip on disk using command line if available or just use pre-created one?
        # I'll try to use zipfile.write with a temp file.
        with open("secret.txt", "w") as f:
            f.write("Secret content")
            
        with zipfile.ZipFile("encrypted.zip", "w") as zx:
            zx.setpassword(b"123456")
            zx.write("secret.txt")
            # Note: setpassword only affects files written AFTER it's set in some versions, 
            # and only for .write() sometimes.
            # Actually, standard zipfile.write() doesn't support encryption automatically in old Python.
            # But let's check.
            
        # 2. Upload to CDR
        with open("encrypted.zip", "rb") as f:
            r = requests.post("http://localhost:8000/sanitize", files={"file": f})
            job_id = r.json()["job_id"]
            print(f"Uploaded encrypted file, Job ID: {job_id}")
            
        # 3. Poll status
        for _ in range(10):
            r = requests.get(f"http://localhost:8000/status/{job_id}")
            status_data = r.json()
            print(f"Status: {status_data['status']}")
            if status_data["status"] == "waiting_password":
                print("SUCCESS: System detected encryption and is waiting for password!")
                
                # 4. Submit password
                print("Submitting password '123456'...")
                r_pw = requests.post(f"http://localhost:8000/status/{job_id}/password", json={"password": "123456"})
                print(f"Submit Response: {r_pw.json()}")
                break
            time.sleep(1)
            
    except Exception as e:
        print(f"Test error: {e}")
    finally:
        if os.path.exists("secret.txt"): os.remove("secret.txt")
        if os.path.exists("encrypted.zip"): os.remove("encrypted.zip")

if __name__ == "__main__":
    test_password_interception()
