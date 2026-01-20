
import time
import os
import signal
import sys
import logging
from .queue_manager import queue_manager
from .engine import get_sanitizer
from .metrics import FILES_PROCESSED_TOTAL, PROCESSING_DURATION_SECONDS, SANITIZATION_FAILURES_TOTAL
from .utils.transfer import transfer_file_to_remote, FileTransferError

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
        
        # Fallback Execution
        if use_fallback:
             fallback = FallbackSanitizer(mime_type=file_type)
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
            
        # Save output
        with open(output_path, "wb") as f_out:
            f_out.write(sanitized_content)


        # Transfer Phase
        transfer_status = "skipped"
        remote_path = None
        
        # DETERMINE CONFIG
        t_conf = task.get('transfer_config') or {}
        # Precedence: Task Config > Env Config
        enable_transfer = t_conf.get('enabled') 
        if enable_transfer is None:
             enable_transfer = os.getenv("ENABLE_TRANSFER", "false").lower() == "true"
        
        if enable_transfer:
            try:
                logger.info("Starting file transfer...")
                # Use same filename for remote
                remote_name = os.path.basename(output_path)
                remote_path = transfer_file_to_remote(output_path, remote_name, config=t_conf)
                transfer_status = "success"
                logger.info(f"File transferred successfully to {remote_path}")
            except Exception as e:
                # If transfer is critical, we might want to raise here.
                # For now, we log it and mark status as failed-transfer, but keeps the job "completed" (sanitization done)
                # Or we can mark job as partial? Let's keep job completed but with transfer info.
                logger.error(f"Transfer step failed: {e}")
                transfer_status = "failed"
            
        duration = time.time() - start_time
        PROCESSING_DURATION_SECONDS.labels(file_type=file_type).observe(duration)
        FILES_PROCESSED_TOTAL.labels(status="success", file_type=file_type).inc()
        
        # Serialize report (update to use new model fields)
        logs = [log.dict() for log in report.logs]
        
        queue_manager.update_job_status(job_id, "completed", {
            "result_path": output_path,
            "duration": duration,
            "report": logs,
            "is_safe": report.is_safe,
            "method": report.method_used,
            "transfer_status": transfer_status,
            "remote_path": remote_path
        })
        logger.info(f"Job {job_id} completed in {duration:.2f}s using {report.method_used}")
        
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
