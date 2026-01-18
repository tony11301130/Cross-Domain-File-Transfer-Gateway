
import time
import os
import signal
import sys
from queue_manager import queue_manager
from engine import get_sanitizer
from metrics import FILES_PROCESSED_TOTAL, PROCESSING_DURATION_SECONDS, SANITIZATION_FAILURES_TOTAL

def handle_sigterm(signum, frame):
    print("Received SIGTERM, shutting down worker...")
    sys.exit(0)

signal.signal(signal.SIGTERM, handle_sigterm)
signal.signal(signal.SIGINT, handle_sigterm)

def process_task(task):
    job_id = task['job_id']
    file_path = task['file_path']
    file_type = task['file_type']
    
    print(f"Processing Job {job_id}: {file_path} ({file_type})")
    queue_manager.update_job_status(job_id, "processing")
    
    start_time = time.time()
    
    try:
        sanitizer = get_sanitizer(file_type)
        if not sanitizer:
            raise ValueError(f"No sanitizer found for {file_type}")

        # Process
        with open(file_path, "rb") as f_in:
            sanitized_content = sanitizer.sanitize(f_in)

        if sanitized_content is None:
            raise ValueError("Sanitization returned empty content")
            
        # Save output
        output_path = file_path + ".sanitized"
        with open(output_path, "wb") as f_out:
            f_out.write(sanitized_content)
            
        duration = time.time() - start_time
        PROCESSING_DURATION_SECONDS.labels(file_type=file_type).observe(duration)
        FILES_PROCESSED_TOTAL.labels(status="success", file_type=file_type).inc()
        
        queue_manager.update_job_status(job_id, "completed", {
            "result_path": output_path,
            "duration": duration
        })
        print(f"Job {job_id} completed in {duration:.2f}s")
        
    except Exception as e:
        print(f"Job {job_id} failed: {e}")
        SANITIZATION_FAILURES_TOTAL.labels(reason=str(type(e).__name__)).inc()
        FILES_PROCESSED_TOTAL.labels(status="error", file_type=file_type).inc()
        queue_manager.update_job_status(job_id, "failed", {"error": str(e)})

def start_worker():
    print("CDR Worker Started (v2 - Fixed Byte Handling)...")
    while True:
        try:
            task = queue_manager.dequeue_job()
            if task:
                process_task(task)
            else:
                # No tasks, just loop (dequeue_job blocks for 5s)
                pass
        except Exception as e:
            print(f"Worker Loop Error: {e}")
            time.sleep(1)

if __name__ == "__main__":
    start_worker()
