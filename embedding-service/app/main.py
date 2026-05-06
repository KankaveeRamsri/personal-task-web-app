from fastapi import FastAPI, HTTPException
from contextlib import asynccontextmanager
import logging
from .schemas import EmbedRequest, EmbedBatchRequest, EmbedResponse, EmbedBatchResponse
from .embedder import embedder_instance, MODEL_NAME, DIMENSION

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load model once at startup
    logger.info(f"Loading embedding model: {MODEL_NAME}")
    embedder_instance.load_model()
    logger.info("Model loaded successfully.")
    yield
    # Clean up resources if needed
    logger.info("Shutting down embedding service.")

app = FastAPI(
    title="Local Embedding Service",
    description="FastAPI service for generating sentence embeddings using sentence-transformers.",
    version="1.0.0",
    lifespan=lifespan
)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "model": MODEL_NAME,
        "dimension": DIMENSION
    }

@app.post("/embed", response_model=EmbedResponse)
def embed(request: EmbedRequest):
    try:
        embedding = embedder_instance.embed_text(request.text)
        return EmbedResponse(
            embedding=embedding,
            dimension=DIMENSION,
            model=MODEL_NAME
        )
    except Exception as e:
        logger.error(f"Error generating embedding: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error generating embedding")

@app.post("/embed/batch", response_model=EmbedBatchResponse)
def embed_batch(request: EmbedBatchRequest):
    try:
        embeddings = embedder_instance.embed_batch(request.texts)
        return EmbedBatchResponse(
            embeddings=embeddings,
            dimension=DIMENSION,
            model=MODEL_NAME
        )
    except Exception as e:
        logger.error(f"Error generating batch embeddings: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error generating batch embeddings")
