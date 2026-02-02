import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  uploadPreview,
  createIndexJob,
  getJobStatus,
  search as apiSearch,
  type PreviewResponse,
  type SearchResult,
} from "../api";
import DocumentModal from "../components/DocumentModal";
import { useJobs } from "../context/JobsContext";

type WizardStep = "upload" | "configure" | "indexing" | "search";

export default function Collection() {
  const { name } = useParams<{ name: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const collectionName = name ? decodeURIComponent(name) : "";
  const { registerJob } = useJobs();

  // Determine initial step based on mode parameter
  const initialMode = searchParams.get("mode");
  const [step, setStep] = useState<WizardStep>(initialMode === "add" ? "upload" : "search");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [textFields, setTextFields] = useState<string[]>([]);
  const [titleField, setTitleField] = useState<string>("");
  const [idField, setIdField] = useState<string>("");
  const [metadataFields, setMetadataFields] = useState<string[]>([]);
  const [jobStatus, setJobStatus] = useState<{ status: string; processed: number; total_records: number; failed: number } | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!collectionName) navigate("/");
  }, [collectionName, navigate]);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    setError(null);
    try {
      const res = await uploadPreview(file);
      setPreview(res);
      setUploadId(res.upload_id);
      setTextFields(res.suggested_text_fields.length ? res.suggested_text_fields : res.columns.slice(0, 1));
      setTitleField(res.columns.includes("title") ? "title" : res.columns[0] || "");
      setIdField(res.suggested_id_field || "");
      setMetadataFields([]);
      setStep("configure");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const res = await uploadPreview(file);
      setPreview(res);
      setUploadId(res.upload_id);
      setTextFields(res.suggested_text_fields.length ? res.suggested_text_fields : res.columns.slice(0, 1));
      setTitleField(res.columns.includes("title") ? "title" : res.columns[0] || "");
      setIdField(res.suggested_id_field || "");
      setMetadataFields([]);
      setStep("configure");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const startIndexing = async () => {
    if (!uploadId || !collectionName) return;
    setError(null);
    try {
      const res = await createIndexJob({
        upload_id: uploadId,
        collection_name: collectionName,
        text_fields: textFields,
        title_field: titleField || undefined,
        id_field: idField || undefined,
        metadata_fields: metadataFields,
      });
      // Register with global context for persistent tracking
      registerJob(res.job_id);
      setStep("indexing");
      pollJob(res.job_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Start job failed");
    }
  };

  const pollJob = (id: string) => {
    const interval = setInterval(async () => {
      try {
        const s = await getJobStatus(id);
        setJobStatus({ status: s.status, processed: s.processed, total_records: s.total_records, failed: s.failed });
        if (s.status === "completed" || s.status === "failed") {
          clearInterval(interval);
          if (s.status === "completed") setStep("search");
        }
      } catch {
        clearInterval(interval);
      }
    }, 1500);
  };

  const doSearch = async () => {
    if (!collectionName || !query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const list = await apiSearch(collectionName, query.trim(), 10);
      setResults(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const toggleMetadata = (col: string) => {
    setMetadataFields((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  if (!collectionName) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate("/")} className="text-slate-600 hover:text-slate-800">
          ← Back
        </button>
        <h1 className="text-xl font-semibold text-slate-800">{collectionName}</h1>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
        )}

        {step === "upload" && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-12 text-center ${
              dragOver ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-white"
            }`}
          >
            <p className="text-slate-600 mb-4">Drag and drop a file here, or click to choose</p>
            <input
              type="file"
              accept=".csv,.tsv,.json,.jsonl"
              onChange={handleFileInput}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md cursor-pointer hover:bg-blue-700"
            >
              Choose file
            </label>
          </div>
        )}

        {step === "configure" && preview && (
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h2 className="text-lg font-medium text-slate-800 mb-4">Index Wizard</h2>
            <p className="text-slate-600 text-sm mb-4">
              Format: {preview.detected_format}. Columns: {preview.columns.join(", ")}
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Text content fields (required)</label>
              <div className="flex flex-wrap gap-2">
                {preview.columns.map((col) => (
                  <label key={col} className="inline-flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={textFields.includes(col)}
                      onChange={() =>
                        setTextFields((prev) =>
                          prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
                        )
                      }
                    />
                    {col}
                  </label>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Title field (optional)</label>
              <select
                value={titleField}
                onChange={(e) => setTitleField(e.target.value)}
                className="w-full max-w-xs px-3 py-2 border border-slate-300 rounded-md"
              >
                <option value="">—</option>
                {preview.columns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">ID field (optional)</label>
              <select
                value={idField}
                onChange={(e) => setIdField(e.target.value)}
                className="w-full max-w-xs px-3 py-2 border border-slate-300 rounded-md"
              >
                <option value="">—</option>
                {preview.columns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Metadata fields (optional)</label>
              <div className="flex flex-wrap gap-2">
                {preview.columns.map((col) => (
                  <label key={col} className="inline-flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={metadataFields.includes(col)}
                      onChange={() => toggleMetadata(col)}
                    />
                    {col}
                  </label>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <p className="text-sm font-medium text-slate-700 mb-2">Preview (first 5 rows)</p>
              <div className="overflow-x-auto border border-slate-200 rounded p-2 text-sm max-h-48 overflow-y-auto">
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(preview.preview_records.slice(0, 5), null, 2)}
                </pre>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={startIndexing}
                disabled={textFields.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Start indexing
              </button>
              <button
                onClick={() => {
                  setStep("upload");
                  setPreview(null);
                  setUploadId(null);
                }}
                className="px-4 py-2 border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {step === "indexing" && jobStatus && (
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h2 className="text-lg font-medium text-slate-800 mb-4">
              {jobStatus.status === "completed" ? "Indexing Complete" : "Indexing in progress"}
            </h2>
            <p className="text-slate-600">
              {jobStatus.status === "completed" ? (
                <>Done! Processed {jobStatus.processed} documents.{jobStatus.failed > 0 && ` (${jobStatus.failed} failed)`}</>
              ) : (
                <>Status: {jobStatus.status}. Processed: {jobStatus.processed} / {jobStatus.total_records || "?"}.
                {jobStatus.failed > 0 && ` Failed: ${jobStatus.failed}`}</>
              )}
            </p>
            {jobStatus.status !== "completed" && (
              <div className="mt-4 w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{
                    width: jobStatus.total_records
                      ? `${(100 * jobStatus.processed) / jobStatus.total_records}%`
                      : "0%",
                  }}
                />
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setStep("search")}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Go to Search
              </button>
              <button
                onClick={() => setStep("upload")}
                className="px-4 py-2 border border-slate-300 rounded-md hover:bg-slate-50 text-slate-700"
              >
                Add More Documents
              </button>
              {jobStatus.status !== "completed" && (
                <button
                  onClick={() => navigate("/")}
                  className="px-4 py-2 border border-slate-300 rounded-md hover:bg-slate-50 text-slate-700"
                >
                  Continue in background
                </button>
              )}
            </div>
            {jobStatus.status !== "completed" && (
              <p className="mt-3 text-xs text-slate-500">
                You can navigate away - progress will continue in the background.
              </p>
            )}
          </div>
        )}

        {step === "search" && (
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h2 className="text-lg font-medium text-slate-800 mb-4">Search</h2>
            <div className="flex gap-2 mb-6">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSearch()}
                placeholder="Enter search query..."
                className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={doSearch}
                disabled={searching}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Search
              </button>
            </div>
            {results.length > 0 && (
              <ul className="space-y-3">
                {results.map((r, i) => (
                  <li
                    key={r.doc_id + i}
                    onClick={() => setSelectedDoc(r)}
                    className="p-4 border border-slate-200 rounded-md cursor-pointer hover:bg-slate-50"
                  >
                    <div className="font-medium text-slate-800">{r.title || r.doc_id}</div>
                    <div className="text-sm text-slate-600 mt-1">{r.snippet}</div>
                    {r.score != null && (
                      <div className="text-xs text-slate-400 mt-1">Score: {r.score.toFixed(4)}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {results.length === 0 && query && !searching && (
              <p className="text-slate-500">No results found.</p>
            )}
            {results.length === 0 && !query && (
              <p className="text-slate-500">Enter a query to search this collection.</p>
            )}
          </div>
        )}
      </main>
      {selectedDoc && (
        <DocumentModal doc={selectedDoc} onClose={() => setSelectedDoc(null)} />
      )}
    </div>
  );
}
