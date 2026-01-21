import redis
import json
import time
import uuid
import sys

# Connect to Redis
try:
    r = redis.Redis(host="redis", port=6379, decode_responses=True)
    r.ping()
except redis.ConnectionError:
    print("Could not connect to Redis. Run this inside the container.")
    sys.exit(1)

# File from previous upload (adjust if needed)
FILE_PATH = "/app/storage/ingress/893edef6-78ca-46d4-8681-8ff9c57e5714_protected.zip"
JOB_ID = str(uuid.uuid4())

print(f"--- Starting Password Flow Verification (Job: {JOB_ID}) ---")

# 1. Enqueue Initial Job
job = {
    "job_id": JOB_ID,
    "file_path": FILE_PATH,
    "file_type": "application/zip",
    "original_filename": "protected.zip",
    "timestamp": time.time(),
    "status": "queued"
}

r.rpush("cdr_tasks", json.dumps(job))
print("[1] Job enqueued. Waiting for worker to detect encryption...")

# Helper to poll status
def wait_for_status(target_statuses, timeout=10):
    start = time.time()
    while time.time() - start < timeout:
        res = r.get(f"cdr_result:{JOB_ID}")
        if res:
            data = json.loads(res)
            current = data.get('status')
            # print(f"    Current status: {current}")
            if current in target_statuses:
                return data, current
            if current == 'failed' and 'failed' not in target_statuses:
                print(f"    Job FAILED unexpectedly: {data.get('error')}")
                return data, 'failed'
        time.sleep(0.5)
    return None, 'timeout'

# 2. Expect 'waiting_password'
data, status = wait_for_status(['waiting_password'], 10)
if status == 'waiting_password':
    print(f"[2] SUCCESS: Job is asking for password. (Status: {status})")
else:
    print(f"[2] FAILED: Expected 'waiting_password', got '{status}'")
    sys.exit(1)

# 3. Submit Correct Password
print("[3] Submitting password 'test1234'...")
data['status'] = 'queued'
data['password'] = 'test1234'

# Update Redis state mimicking the API
r.set(f"cdr_result:{JOB_ID}", json.dumps(data), ex=3600)
r.rpush("cdr_tasks", json.dumps(data))

# 4. Expect 'completed'
print("[4] Waiting for processing result...")
data, status = wait_for_status(['completed', 'processing'], 10)

if status == 'processing':
    # Wait a bit more for completion
    data, status = wait_for_status(['completed'], 10)

if status == 'completed':
    print("[5] SUCCESS: Job completed successfully with password!")
    print(f"    Result saved to: {data.get('sanitized_file_path', 'unknown')}")
else:
    print(f"[5] FAILED: Expected 'completed', got '{status}'")
    sys.exit(1)
