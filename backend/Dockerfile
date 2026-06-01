FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p /app/data/uploads/{blueprints,books,papers,syllabus,question_images,student_submissions,course_outcomes} \
    && mkdir -p /app/logs

# Expose port
EXPOSE 8010

# Health check
HEALTHCHECK --interval=15s --timeout=10s --retries=5 \
    CMD python -c "import requests; requests.get('http://localhost:8010/docs')" || exit 1

# Run the application
CMD ["python", "main.py"]
