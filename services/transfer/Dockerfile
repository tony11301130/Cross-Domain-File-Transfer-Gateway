FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Assume shared storage is mounted at /app/storage
ENV PYTHONPATH=/app

CMD ["python", "-m", "app.worker"]
