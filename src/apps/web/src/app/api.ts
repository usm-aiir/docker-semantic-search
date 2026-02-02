const API = "/api";

export async function health(): Promise<{ status: string }> {
  const r = await fetch(`${API}/health`);
  if (!r.ok) throw new Error("Health check failed");
  return r.json();
}

export async function listCollections(): Promise<{ collections: string[] }> {
  const r = await fetch(`${API}/collections`);
  if (!r.ok) throw new Error("Failed to list collections");
  return r.json();
}

export async function createCollection(name: string): Promise<{ name: string }> {
  const r = await fetch(`${API}/collections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.detail || "Failed to create collection");
  }
  return r.json();
}

export async function deleteCollection(name: string): Promise<void> {
  const r = await fetch(`${API}/collections/${encodeURIComponent(name)}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Failed to delete collection");
}

export interface PreviewResponse {
  upload_id: string;
  detected_format: string;
  columns: string[];
  preview_records: Record<string, unknown>[];
  suggested_text_fields: string[];
  suggested_id_field: string | null;
}

export async function uploadPreview(file: File): Promise<PreviewResponse> {
  const form = new FormData();
  form.append("file", file);
  const r = await fetch(`${API}/uploads/preview`, { method: "POST", body: form });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.detail || "Upload failed");
  }
  return r.json();
}

export interface IndexJobCreate {
  upload_id: string;
  collection_name: string;
  text_fields: string[];
  title_field?: string;
  id_field?: string;
  metadata_fields?: string[];
}

export async function createIndexJob(body: IndexJobCreate): Promise<{ job_id: string }> {
  const r = await fetch(`${API}/index/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.detail || "Failed to start job");
  }
  return r.json();
}

export interface JobStatus {
  job_id: string;
  collection_name?: string;
  status: string;
  total_records: number;
  processed: number;
  failed: number;
  error_sample: string | null;
  created_at?: string;
  updated_at?: string;
}

export async function getJobStatus(job_id: string): Promise<JobStatus> {
  const r = await fetch(`${API}/index/jobs/${job_id}`);
  if (!r.ok) throw new Error("Job not found");
  return r.json();
}

export async function listJobs(activeOnly = false): Promise<{ jobs: JobStatus[] }> {
  const r = await fetch(`${API}/index/jobs?active_only=${activeOnly}`);
  if (!r.ok) throw new Error("Failed to list jobs");
  return r.json();
}

export async function cancelJob(job_id: string): Promise<{ job_id: string; status: string }> {
  const r = await fetch(`${API}/index/jobs/${job_id}/cancel`, { method: "POST" });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.detail || "Failed to cancel job");
  }
  return r.json();
}

export interface SearchResult {
  doc_id: string;
  title: string;
  snippet: string;
  metadata: Record<string, unknown>;
  score: number | null;
  body?: string;
}

export async function search(
  collection_name: string,
  query: string,
  k = 10,
  filters?: Record<string, string | number | boolean>
): Promise<SearchResult[]> {
  const r = await fetch(`${API}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ collection_name, query, k, filters }),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.detail || "Search failed");
  }
  return r.json();
}
