# Local Embedding Service

This is a local Python FastAPI service that provides sentence embeddings for the AI Kanban SaaS RAG feature.

## Tech Stack
- **Framework**: FastAPI
- **Model**: `sentence-transformers/all-MiniLM-L6-v2`
- **Output Dimension**: 384
- **Normalization**: L2 normalized for cosine similarity

## How to Run Locally

### Using Python (Virtual Environment)
```bash
cd embedding-service
python -m venv venv
source venv/bin/activate  # On macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Using Docker
```bash
cd embedding-service
docker build -t local-embedding-service .
docker run -p 8000:8000 local-embedding-service
```

## How to Test

**1. Health Check**
```bash
curl http://localhost:8000/health
```

**2. Embed Single Text**
```bash
curl -X POST http://localhost:8000/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "Implement task-focused RAG"}'
```

**3. Embed Batch of Texts**
```bash
curl -X POST http://localhost:8000/embed/batch \
  -H "Content-Type: application/json" \
  -d '{"texts": ["First task", "Second task"]}'
```
