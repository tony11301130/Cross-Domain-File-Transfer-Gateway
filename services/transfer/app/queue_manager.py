import redis
import json
import os
import uuid
import time
from typing import Dict, Any, Optional

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
QUEUE_NAME = "transfer_tasks"
RESULT_PREFIX = "transfer_result:"
# We might want a transfer_results queue later

class QueueManager:
    def __init__(self):
        try:
            self.redis = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
            self.redis.ping()
            print(f"Connected to Redis at {REDIS_HOST}:{REDIS_PORT}")
        except Exception as e:
            print(f"Failed to connect to Redis: {e}")
            self.redis = None

    def dequeue_task(self) -> Optional[Dict[str, Any]]:
        if not self.redis:
            return None
        # Blocking pop
        item = self.redis.blpop(QUEUE_NAME, timeout=5)
        if item:
            return json.loads(item[1])
        return None

    def update_status(self, job_id: str, status: str, details: Optional[Dict] = None):
        if not self.redis:
            return
            
        key = f"{RESULT_PREFIX}{job_id}"
        payload = {
            "job_id": job_id,
            "status": status,
            "timestamp": time.time()
        }
        if details:
            payload.update(details)
            
        # Expire in 24 hours
        self.redis.setex(key, 86400, json.dumps(payload))
        print(f"Updated Transfer Job {job_id} -> {status}")

queue_manager = QueueManager()
