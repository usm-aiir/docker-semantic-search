FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install core package
COPY src/packages/core /app/packages/core
RUN pip install --no-cache-dir -e /app/packages/core

# Install worker package
COPY src/apps/worker /app/apps/worker
RUN pip install --no-cache-dir -e /app/apps/worker

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

CMD ["python", "-m", "semantic_search_worker.main"]
