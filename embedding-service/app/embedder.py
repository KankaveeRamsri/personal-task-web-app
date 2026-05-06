from sentence_transformers import SentenceTransformer

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
DIMENSION = 384

class Embedder:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Embedder, cls).__new__(cls)
            cls._instance.model = None
        return cls._instance

    def load_model(self):
        if self.model is None:
            # Let sentence_transformers automatically choose the best available device (CPU/MPS/CUDA)
            self.model = SentenceTransformer(MODEL_NAME)
        
    def embed_text(self, text: str) -> list[float]:
        # Encode and normalize for cosine similarity
        embedding = self.model.encode(text, normalize_embeddings=True)
        return embedding.tolist()

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        # Encode and normalize for cosine similarity
        embeddings = self.model.encode(texts, normalize_embeddings=True)
        return embeddings.tolist()

embedder_instance = Embedder()
