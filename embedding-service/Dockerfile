FROM python:3.11-slim

WORKDIR /app

# Install dependencies needed for compiling certain python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create a non-root user to run the app
RUN useradd -m -u 1000 appuser
USER appuser

# Create huggingface cache dir so the user can write the downloaded model
ENV HF_HOME=/home/appuser/.cache/huggingface
RUN mkdir -p /home/appuser/.cache/huggingface

COPY --chown=appuser:appuser app/ app/

# Pre-download the model during build time
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
