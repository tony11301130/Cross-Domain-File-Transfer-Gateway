
from prometheus_client import Counter, Histogram, generate_latest
import time

# Metrics
FILES_PROCESSED_TOTAL = Counter(
    "cdr_files_processed_total", 
    "Total number of files processed by CDR", 
    ["status", "file_type"]
)

PROCESSING_DURATION_SECONDS = Histogram(
    "cdr_processing_duration_seconds",
    "Time spent processing a file",
    ["file_type"]
)

SANITIZATION_FAILURES_TOTAL = Counter(
    "cdr_sanitization_failures_total",
    "Total number of sanitization failures",
    ["reason"]
)

class MetricsMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and scope["path"] == "/metrics":
            await self.handle_metrics(scope, receive, send)
            return
        await self.app(scope, receive, send)

    async def handle_metrics(self, scope, receive, send):
        headers = [
            (b"content-type", b"text/plain"),
        ]
        data = generate_latest()
        await send({
            "type": "http.response.start",
            "status": 200,
            "headers": headers,
        })
        await send({
            "type": "http.response.body",
            "body": data,
        })
