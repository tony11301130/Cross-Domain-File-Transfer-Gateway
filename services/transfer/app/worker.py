import time
import sys
import logging
from .queue_manager import queue_manager
from .utils.transfer import transfer_file_to_remote

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

def process_task(task):
    job_id = task.get('job_id')
    source_path = task.get('source_path')
    remote_filename = task.get('remote_filename')
    config = task.get('config')
    
    if not job_id or not source_path:
        logger.error("Invalid task payload: missing job_id or source_path")
        return

    logger.info(f"Processing Transfer Job {job_id}: {source_path}")
    queue_manager.update_status(job_id, "processing")
    
    try:
        remote_path = transfer_file_to_remote(source_path, remote_filename, config)
        queue_manager.update_status(job_id, "completed", {"remote_path": remote_path})
        logger.info(f"Job {job_id} transfer successful.")
        
    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}")
        queue_manager.update_status(job_id, "failed", {"error": str(e)})

def start_worker():
    logger.info("Transfer Worker Started...")
    while True:
        try:
            task = queue_manager.dequeue_task()
            if task:
                process_task(task)
            else:
                pass 
        except Exception as e:
            logger.error(f"Worker Loop Error: {e}")
            time.sleep(1)

if __name__ == "__main__":
    start_worker()
