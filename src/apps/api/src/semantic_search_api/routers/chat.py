"""Chat endpoint with RAG (Retrieval-Augmented Generation)."""
import os
from typing import Any

import httpx
import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from semantic_search_core.search.opensearch import (
    get_client,
    safe_index_name,
    search_hybrid,
)
from semantic_search_core.embed import get_embedding_model

logger = structlog.get_logger()

router = APIRouter(prefix="/chat", tags=["chat"])


def _get_llm_config():
    """Get LLM configuration from environment variables."""
    return {
        "provider": os.getenv("LLM_PROVIDER", "gemini"),
        "gemini_api_key": os.getenv("GEMINI_API_KEY", ""),
        "gemini_model": os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
        "ollama_url": os.getenv("OLLAMA_URL", "http://ollama:11434"),
        "ollama_model": os.getenv("OLLAMA_MODEL", "llama3.2"),
    }


class ChatRequest(BaseModel):
    """Chat request."""

    collection_name: str
    question: str
    k: int = Field(default=5, ge=1, le=20, description="Number of context chunks to retrieve")
    filters: dict[str, str | int | bool] | None = None


class SourceDocument(BaseModel):
    """Source document referenced in the answer."""

    doc_id: str
    title: str
    snippet: str


class ChatResponse(BaseModel):
    """Chat response."""

    answer: str
    sources: list[SourceDocument]
    model: str


def _build_prompt(question: str, context_chunks: list[dict]) -> str:
    """Build the RAG prompt with retrieved context."""
    context_text = "\n\n---\n\n".join(
        f"[Document: {chunk.get('title') or chunk.get('doc_id')}]\n{chunk.get('body', '')}"
        for chunk in context_chunks
    )
    
    return f"""You are a helpful assistant that answers questions based on the provided context documents.

CONTEXT DOCUMENTS:
{context_text}

---

USER QUESTION: {question}

INSTRUCTIONS:
- Answer the question based ONLY on the information provided in the context documents above.
- If the context doesn't contain enough information to answer the question, say so clearly.
- Be concise and direct in your response.
- If you quote or reference specific documents, mention which document the information comes from.

ANSWER:"""


async def _call_gemini(prompt: str, config: dict) -> str:
    """Call Google Gemini API."""
    api_key = config["gemini_api_key"]
    model = config["gemini_model"]
    
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY not configured. Set it in your environment variables.",
        )
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            url,
            params={"key": api_key},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.3,
                    "maxOutputTokens": 1024,
                },
            },
        )
        
        if response.status_code != 200:
            logger.error("gemini_api_error", status=response.status_code, body=response.text)
            raise HTTPException(status_code=502, detail=f"Gemini API error: {response.status_code}")
        
        data = response.json()
        try:
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError) as e:
            logger.error("gemini_parse_error", error=str(e), data=data)
            raise HTTPException(status_code=502, detail="Failed to parse Gemini response")


async def _call_ollama(prompt: str, config: dict) -> str:
    """Call local Ollama API."""
    ollama_url = config["ollama_url"]
    ollama_model = config["ollama_model"]
    url = f"{ollama_url}/api/generate"
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            response = await client.post(
                url,
                json={
                    "model": ollama_model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.3,
                        "num_predict": 1024,
                    },
                },
            )
        except httpx.ConnectError:
            raise HTTPException(
                status_code=503,
                detail=f"Cannot connect to Ollama at {ollama_url}. Make sure Ollama is running.",
            )
        
        if response.status_code != 200:
            logger.error("ollama_api_error", status=response.status_code, body=response.text)
            raise HTTPException(status_code=502, detail=f"Ollama API error: {response.status_code}")
        
        data = response.json()
        return data.get("response", "")


@router.post("", response_model=ChatResponse)
async def chat(body: ChatRequest):
    """
    Chat with your documents using RAG.
    
    Retrieves relevant document chunks and uses an LLM to generate an answer.
    Configure LLM_PROVIDER env var to use "gemini" (default) or "ollama".
    """
    # Get LLM config
    config = _get_llm_config()
    provider = config["provider"]
    
    # Validate collection exists
    client = get_client()
    index_name = safe_index_name(body.collection_name)
    if not client.indices.exists(index=index_name):
        raise HTTPException(
            status_code=404, detail=f"Collection not found: {body.collection_name}"
        )
    
    # Retrieve relevant chunks using hybrid search
    model = get_embedding_model()
    query_embedding = model.encode(body.question, convert_to_numpy=True).tolist()
    
    chunks = search_hybrid(
        client,
        index_name,
        body.question,
        query_embedding,
        k=body.k,
        filters=body.filters,
    )
    
    if not chunks:
        model_name = config["ollama_model"] if provider == "ollama" else config["gemini_model"]
        return ChatResponse(
            answer="I couldn't find any relevant documents to answer your question. Try uploading some documents first.",
            sources=[],
            model=f"{provider}/{model_name}",
        )
    
    # Build prompt with context
    prompt = _build_prompt(body.question, chunks)
    
    # Call LLM based on provider
    if provider == "ollama":
        answer = await _call_ollama(prompt, config)
        model_name = f"ollama/{config['ollama_model']}"
    else:
        answer = await _call_gemini(prompt, config)
        model_name = f"gemini/{config['gemini_model']}"
    
    # Build response with sources
    sources = [
        SourceDocument(
            doc_id=chunk["doc_id"],
            title=chunk.get("title") or chunk["doc_id"],
            snippet=chunk.get("snippet", ""),
        )
        for chunk in chunks
    ]
    
    return ChatResponse(answer=answer, sources=sources, model=model_name)


@router.get("/config")
def get_chat_config():
    """Get current chat/LLM configuration."""
    config = _get_llm_config()
    provider = config["provider"]
    return {
        "provider": provider,
        "model": config["ollama_model"] if provider == "ollama" else config["gemini_model"],
        "gemini_configured": bool(config["gemini_api_key"]),
        "ollama_url": config["ollama_url"] if provider == "ollama" else None,
    }
