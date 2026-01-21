
import time
import os
import signal
import sys
import logging
from .queue_manager import queue_manager
from .engine import get_sanitizer
from .metrics import FILES_PROCESSED_TOTAL, PROCESSING_DURATION_SECONDS, SANITIZATION_FAILURES_TOTAL
from .metrics import FILES_PROCESSED_TOTAL, PROCESSING_DURATION_SECONDS, SANITIZATION_FAILURES_TOTAL
import shutil
import json

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

def handle_sigterm(signum, frame):
    logger.info("Received SIGTERM, shutting down worker...")
    sys.exit(0)

signal.signal(signal.SIGTERM, handle_sigterm)
signal.signal(signal.SIGINT, handle_sigterm)

def process_task(task):
    job_id = task['job_id']
    file_path = task['file_path']
    file_type = task['file_type']
    
    # IMPROVED TYPE DETECTION
    import magic
    try:
        if file_type == 'application/octet-stream' or not file_type:
            detected_type = magic.from_file(file_path, mime=True)
            if detected_type:
                logger.info(f"Refining file type from {file_type} to {detected_type}")
                file_type = detected_type
    except Exception as e:
        logger.warning(f"Magic type detection failed: {e}")

    logger.info(f"Processing Job {job_id}: {file_path} ({file_type})")
    queue_manager.update_job_status(job_id, "processing")
    
    start_time = time.time()
    
    from app.core.models import SanitizationPolicy
    from app.sanitizers.fallback import FallbackSanitizer

    try:
        # Default Policy (Todo: Load from task)
        policy = SanitizationPolicy()
        if 'policy' in task and isinstance(task['policy'], dict):
             # Simple dict mapping if needed, or pydantic parse
             # policy = SanitizationPolicy(**task['policy'])
             pass

        sanitizer = None
        sanitized_content = None
        report = None
        
        # DECISION LOGIC: 
        # 1. Check if we should force fallback
        # 2. Try Standard Sanitizer
        # 3. If Standard fails/errors and fallback enabled -> Try Fallback
        
        use_fallback = policy.force_fallback
        
        password = task.get('password')
        
        if not use_fallback:
            try:
                sanitizer = get_sanitizer(file_type)
                if not sanitizer:
                    logger.warning(f"No surgical sanitizer for {file_type}, attempting fallback if generic.")
                    # If no surgical sanitizer, we might want to try fallback immediately if it's a supported format ?
                    # For now, raise Error
                    if policy.fallback_enabled:
                         use_fallback = True
                    else:
                        raise ValueError(f"No specific sanitizer found for {file_type}")
                else:
                    # Run Surgical
                    with open(file_path, "rb") as f_in:
                        sanitized_content, report = sanitizer.sanitize(f_in, policy, password=password)
                        
            except Exception as e:
                logger.error(f"Surgical sanitization failed: {e}")
                if policy.fallback_enabled:
                    logger.info("Retrying with Fallback/Deep Sanitization...")
                    use_fallback = True
                else:
                    raise e
        
        if use_fallback:
             ext = os.path.splitext(file_path)[1]
             fallback = FallbackSanitizer(mime_type=file_type, extension=ext)
             with open(file_path, "rb") as f_in:
                sanitized_content, report = fallback.sanitize(f_in, policy)
                if report:
                    report.method_used = "fallback"

        # Final Check
        if sanitized_content is None:
            if report and report.requires_password:
                # SPECIAL CASE: Password Required Interception
                queue_manager.update_job_status(job_id, "waiting_password", {
                    "report": [log.dict() for log in report.logs],
                    "requires_password": True
                })
                logger.info(f"Job {job_id} is waiting for password.")
                return

            reason = "Sanitization Failed (Unknown)"
            if report and not report.is_safe:
                reason = "Blocked by Policy/Security"
            
            # Extract last log detail
            fail_msg = reason
            if report and report.logs:
                fail_msg = f"{reason}: {report.logs[-1].details}"
            
            raise ValueError(fail_msg)
            
        # Determine job result directory
        # Structure:
        # /app/storage/results/{job_id}/
        #   ├── safe/
        #   │   └── filename
        #   ├── original/
        #   │   └── filename
        #   └── report.json
        
        storage_root = os.path.dirname(os.path.dirname(os.path.dirname(file_path))) # Assuming input is in .../storage/ingress/file or .../storage/uploads/file
        # Fallback if path parsing fails, use strict relative path from common root if possible, or just absolute
        # Let's rely on a fixed structure relative to the known storage mount.
        # If file_path is /app/storage/ingress/foo.pdf, we want /app/storage/results/...
        
        # A safer way: look for 'storage' in path or config
        # For now, let's assume we can step up from the input file dir if it is in storage.
        # But if file_path is weird, we might fail.
        # Let's try to find the common 'storage' root.
        
        base_dir = os.path.dirname(file_path)
        while len(base_dir) > 5:
            if os.path.basename(base_dir) == 'storage':
                break
            base_dir = os.path.dirname(base_dir)
            
        if os.path.basename(base_dir) != 'storage':
             # Fallback: assume CWD/storage or /app/storage
             results_base = os.path.join(os.getcwd(), 'storage')
        else:
             results_base = base_dir

        job_dir = os.path.join(results_base, "results", job_id)
        safe_dir = os.path.join(job_dir, "safe")
        original_dir = os.path.join(job_dir, "original")
        
        os.makedirs(safe_dir, exist_ok=True)
        os.makedirs(original_dir, exist_ok=True)

        original_filename = os.path.basename(file_path)
        
        # 1. Save Safe File
        safe_output_path = os.path.join(safe_dir, original_filename)
        with open(safe_output_path, "wb") as f_out:
            f_out.write(sanitized_content)
            
        # 2. Archive Original File
        original_archive_path = os.path.join(original_dir, original_filename)
        try:
            shutil.copy2(file_path, original_archive_path)
        except Exception as copy_err:
            logger.warning(f"Failed to archive original file: {copy_err}")
            
        # 3. Save Report
        logs = [log.dict() for log in report.logs]
        report_data = {
            "job_id": job_id,
            "timestamp": time.time(),
            "is_safe": report.is_safe,
            "method": report.method_used,
            "logs": logs,
            "files": {
                "safe": safe_output_path,
                "original": original_archive_path
            }
        }
        report_path = os.path.join(job_dir, "report.json")
        with open(report_path, "w", encoding='utf-8') as f_rep:
            json.dump(report_data, f_rep, indent=2)

        duration = time.time() - start_time
        PROCESSING_DURATION_SECONDS.labels(file_type=file_type).observe(duration)
        FILES_PROCESSED_TOTAL.labels(status="success", file_type=file_type).inc()
        
        queue_manager.update_job_status(job_id, "completed", {
            "result_path": safe_output_path, # Legacy support
            "duration": duration,
            "report": logs, # Legacy support
            "is_safe": report.is_safe,
            "method": report.method_used,
            
            # New Standard Fields
            "artifacts": {
                 "safe_path": safe_output_path,
                 "original_path": original_archive_path,
                 "report_path": report_path
            }
        })
        logger.info(f"Job {job_id} completed. Artifacts in {job_dir}")
        
    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}")
        SANITIZATION_FAILURES_TOTAL.labels(reason=str(type(e).__name__)).inc()
        FILES_PROCESSED_TOTAL.labels(status="error", file_type=file_type).inc()
        queue_manager.update_job_status(job_id, "failed", {"error": str(e)})


def start_worker():
    logger.info("CDR Worker Started (v3 - Fallback Enabled)...")
    while True:
        try:
            task = queue_manager.dequeue_job()
            if task:
                process_task(task)
            else:
                pass
        except Exception as e:
            logger.error(f"Worker Loop Error: {e}")
            time.sleep(1)

if __name__ == "__main__":
    start_worker()
