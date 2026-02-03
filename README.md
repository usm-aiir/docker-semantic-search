# Semantic Search

A self-hosted semantic search application. Upload your data files, index them with vector embeddings, and search using natural language. Includes hybrid search (BM25 + vectors) and RAG-powered chat with your documents.

## Features

- **Hybrid Search** - Combines BM25 keyword search with semantic vector search using Reciprocal Rank Fusion (RRF)
- **RAG Chat** - Ask questions and get AI-generated answers based on your documents (supports Gemini API and Ollama)
- **Multiple File Formats** - CSV, TSV, JSON, JSONL
- **Background Indexing** - Upload large files without blocking

## Quickstart

1. **Install Docker**

   Make sure Docker and Docker Compose are installed on your system.

2. **Run the application**

   ```bash
   ./run
   ```

3. **Open the web app**

   Navigate to [http://localhost:8080](http://localhost:8080)

4. **Upload and search**

   - Create a collection
   - Click the **+** icon to add documents
   - Drag and drop a `.csv`, `.tsv`, `.json`, or `.jsonl` file
   - Select which fields contain text content
   - Start indexing
   - Click the **search** icon to search or chat with your documents

## Supported File Formats

- **CSV** - Comma-separated values
- **TSV** - Tab-separated values
- **JSON** - Array of objects or object with array
- **JSONL** - Newline-delimited JSON

## Configuration

Copy `.env.example` to `.env` to customize settings:

### Core Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `EMBED_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | Embedding model |
| `MAX_UPLOAD_MB` | `50` | Maximum upload size |

### LLM Configuration (for RAG Chat)

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `gemini` | LLM provider: `gemini` or `ollama` |
| `GEMINI_API_KEY` | - | Your Google Gemini API key |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Gemini model to use |
| `OLLAMA_URL` | `http://ollama:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `llama3.2` | Ollama model to use |

### Setting up Chat

**Option 1: Google Gemini (Recommended for quick start)**

1. Get a free API key from [Google AI Studio](https://aistudio.google.com/apikey)
2. Create `.env` file: `cp .env.example .env`
3. Set `GEMINI_API_KEY=your-key-here`

**Option 2: Ollama (Local, private)**

1. Install Ollama from [ollama.ai](https://ollama.ai)
2. Pull a model: `ollama pull llama3.2`
3. Set `LLM_PROVIDER=ollama` in your `.env`

## Troubleshooting

**Web app not loading?**
- Wait for all services to start — first run downloads the embedding model (~80MB) which can take 1-2 minutes
- Check logs: `docker compose logs -f`

**Search not returning results?**
- Ensure indexing completed successfully
- Check the job status shows "completed"

**Indexing job stuck at "0 / N documents"?**
- The worker service must be running to process jobs. With `./run` or `docker compose up`, the worker starts automatically. If you run only the API and web, jobs stay queued until a worker picks them up.

**Out of memory?**
- The embedding model requires RAM; ensure Docker has at least 4GB allocated

## Stopping

Press `Ctrl+C` in the terminal, or run:

```bash
docker compose down
```

To also remove data volumes:

```bash
docker compose down -v
```
