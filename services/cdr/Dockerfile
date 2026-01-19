# Base Image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libmagic1 \
    libreoffice-nogui \
    poppler-utils \
    ghostscript \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
# We install directly to keep it simple as per instructions, 
# but in production, requirements.txt is preferred.
# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY ./app /app/app

# Expose the port
EXPOSE 8000

# Command to run the application
CMD ["python", "-m", "app.worker"]
