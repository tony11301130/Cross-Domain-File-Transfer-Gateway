
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from queue_manager import queue_manager
from metrics import MetricsMiddleware
import shutil
import os
import magic

app = FastAPI(title="CDR Service")

# Add Metrics Middleware
app.add_middleware(MetricsMiddleware)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "../uploads")
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

@app.get("/health")
async def health_check():
    redis_status = "connected" if queue_manager.redis and queue_manager.redis.ping() else "disconnected"
    return {"status": "ok", "redis": redis_status}

@app.post("/sanitize")
async def sanitize_file(file: UploadFile = File(...)):
    try:
        # 1. Save file temporarily
        file_location = os.path.join(UPLOAD_DIR, f"temp_{file.filename}")
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(file.file, file_object)
            
        # 2. Detect MIME type using magic from file (more reliable)
        mime = magic.Magic(mime=True)
        file_type = mime.from_file(file_location)
        
        if file_type == "application/octet-stream":
             if file.filename.lower().endswith(".zip"):
                 print(f"Fallback: Detecting zip from extension for {file.filename}")
                 file_type = "application/zip"
        
        print(f"Received file: {file.filename}, Detected MIME: {file_type}")
        
        # 3. Enqueue Job
        job_id = queue_manager.enqueue_job(file_location, file_type, file.filename)
        
        if not job_id:
             raise HTTPException(status_code=503, detail="Service Unavailable (Queue Error)")

        return {"job_id": job_id, "status": "queued"}
        
    except Exception as e:
        print(f"Error submitting job: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/status/{job_id}")
async def get_status(job_id: str):
    status = queue_manager.get_job_status(job_id)
    if not status:
        raise HTTPException(status_code=404, detail="Job not found")
    return status
