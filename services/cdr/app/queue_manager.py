
import redis
import json
import os
import uuid
import time
from typing import Dict, Any, Optional

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
QUEUE_NAME = "cdr_tasks"
RESULT_PREFIX = "cdr_result:"

class QueueManager:
    def __init__(self):
        try:
            self.redis = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
            # Test connection
            self.redis.ping()
            print(f"Connected to Redis at {REDIS_HOST}:{REDIS_PORT}")
        except Exception as e:
            print(f"Failed to connect to Redis: {e}")
            self.redis = None

    def enqueue_job(self, file_path: str, file_type: str, original_filename: str) -> str:
        job_id = str(uuid.uuid4())
        task = {
            "job_id": job_id,
            "file_path": file_path,
            "file_type": file_type,
            "original_filename": original_filename,
            "timestamp": time.time(),
            "status": "queued"
        }
        
        if self.redis:
            # Add to queue
            self.redis.rpush(QUEUE_NAME, json.dumps(task))
            # Set initial status key with expiration (e.g., 1 hour)
            self.redis.setex(f"{RESULT_PREFIX}{job_id}", 3600, json.dumps(task))
        else:
            print("Redis not available, cannot enqueue job.")
            return None
            
        return job_id

    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        if not self.redis:
            return None
            
        data = self.redis.get(f"{RESULT_PREFIX}{job_id}")
        if data:
            return json.loads(data)
        return None

    def update_job_status(self, job_id: str, status: str, result: Optional[Dict] = None):
        if not self.redis:
            return

        key = f"{RESULT_PREFIX}{job_id}"
        current_data = self.redis.get(key)
        
        if current_data:
            task = json.loads(current_data)
        else:
            task = {"job_id": job_id}

        task["status"] = status
        if result:
            task.update(result)
            
        # Update with expiration (reset it)
        self.redis.setex(key, 3600, json.dumps(task))

    def dequeue_job(self) -> Optional[Dict[str, Any]]:
        if not self.redis:
            return None
            
        # Blocking pop for worker
        # blpop returns tuple (queue_name, data)
        item = self.redis.blpop(QUEUE_NAME, timeout=5)
        if item:
            return json.loads(item[1])
        return None

queue_manager = QueueManager()
