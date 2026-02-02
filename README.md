# Semantic Search

A self-hosted semantic search application. Upload your data files, index them with vector embeddings, and search using natural language.

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
   - Drag and drop a `.csv`, `.tsv`, `.json`, or `.jsonl` file
   - Select which fields contain text content
   - Start indexing
   - Search your documents

## Supported File Formats

- **CSV** - Comma-separated values
- **TSV** - Tab-separated values
- **JSON** - Array of objects or object with array
- **JSONL** - Newline-delimited JSON

## Configuration

Copy `.env.example` to `.env` to customize settings:

| Variable | Default | Description |
|----------|---------|-------------|
| `EMBED_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | Embedding model |
| `MAX_UPLOAD_MB` | `50` | Maximum upload size |

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
