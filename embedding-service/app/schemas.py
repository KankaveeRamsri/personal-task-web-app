from pydantic import BaseModel, field_validator
from typing import List

class EmbedRequest(BaseModel):
    text: str

    @field_validator("text")
    def text_must_not_be_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("Text cannot be empty")
        return v

class EmbedBatchRequest(BaseModel):
    texts: List[str]

    @field_validator("texts")
    def texts_must_not_be_empty(cls, v):
        if not v:
            raise ValueError("Texts list cannot be empty")
        for text in v:
            if not text or not text.strip():
                raise ValueError("List contains empty text")
        return v

class EmbedResponse(BaseModel):
    embedding: List[float]
    dimension: int
    model: str

class EmbedBatchResponse(BaseModel):
    embeddings: List[List[float]]
    dimension: int
    model: str
