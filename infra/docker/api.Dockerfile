FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install core package
COPY src/packages/core /app/packages/core
RUN pip install --no-cache-dir -e /app/packages/core

# Install API package
COPY src/apps/api /app/apps/api
RUN pip install --no-cache-dir -e /app/apps/api

# Install worker package (needed for task imports)
COPY src/apps/worker /app/apps/worker
RUN pip install --no-cache-dir -e /app/apps/worker

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

EXPOSE 8000
CMD ["uvicorn", "semantic_search_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
