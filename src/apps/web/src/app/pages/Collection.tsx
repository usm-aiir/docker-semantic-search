import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  uploadPreview,
  createIndexJob,
  getJobStatus,
  search as apiSearch,
  chat as apiChat,
  type PreviewResponse,
  type SearchResult,
  type ChatResponse,
} from "../api";
import DocumentModal from "../components/DocumentModal";
import { useJobs } from "../context/JobsContext";

type WizardStep = "upload" | "configure" | "indexing" | "search";

// Sparkle icon component
const SparklesIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
  </svg>
);

// X icon component
const XIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);

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
  
  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [showAiButton, setShowAiButton] = useState(false);
  const [chatQuery, setChatQuery] = useState(""); // The query that triggered the chat
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null); // Question currently being processed
  const [chatHistory, setChatHistory] = useState<Array<{ question: string; response: ChatResponse }>>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
    setShowAiButton(false); // Hide button while searching
    try {
      const list = await apiSearch(collectionName, query.trim(), 10);
      setResults(list);
      // Animate the AI button in after a brief delay
      if (list.length > 0) {
        setTimeout(() => setShowAiButton(true), 300);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const doChat = async (question?: string) => {
    const q = question || chatQuestion.trim();
    if (!collectionName || !q) return;
    
    // Show the question immediately and clear input
    setPendingQuestion(q);
    setChatQuestion("");
    setChatLoading(true);
    setError(null);
    
    try {
      const response = await apiChat(collectionName, q, 5);
      setChatHistory((prev) => [...prev, { question: q, response }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat failed");
    } finally {
      setChatLoading(false);
      setPendingQuestion(null);
    }
  };

  // Open chat panel - triggers animation and sends query to chat
  const openChat = () => {
    if (!query.trim() || results.length === 0) return;
    
    setShowAiButton(false); // Hide button when opening chat
    
    // If same query, just reopen without resending
    if (chatQuery === query.trim() && chatHistory.length > 0) {
      setChatOpen(true);
      return;
    }
    
    // New query - clear history and send to chat
    setChatHistory([]);
    setChatQuery(query.trim());
    setChatOpen(true);
    // Send the search query as the first chat message
    doChat(query.trim());
  };

  // Close chat panel
  const closeChat = () => {
    setChatOpen(false);
    // Slide the AI button back in after closing
    if (results.length > 0) {
      setTimeout(() => setShowAiButton(true), 300);
    }
  };

  // Scroll to bottom of chat when new messages arrive or pending question appears
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, pendingQuestion]);

  const toggleMetadata = (col: string) => {
    setMetadataFields((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  if (!collectionName) return null;

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4 flex-shrink-0">
        <button onClick={() => navigate("/")} className="text-slate-600 hover:text-slate-800">
          ← Back
        </button>
        <h1 className="text-xl font-semibold text-slate-800">{collectionName}</h1>
      </header>
      <main className={`flex-1 px-4 py-4 transition-all duration-500 overflow-hidden relative ${chatOpen ? "max-w-none" : "max-w-5xl mx-auto w-full"}`}>
        {error && (
          <div className="absolute top-4 left-4 right-4 z-10 p-3 bg-red-50 text-red-700 rounded-md text-sm shadow-md">{error}</div>
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
          <div className="relative h-full overflow-hidden">
            {/* Container for sliding animation */}
            <div 
              className="flex gap-4 h-full transition-transform duration-500 ease-out"
              style={{
                width: chatOpen ? '100%' : '100%',
              }}
            >
              {/* Search Section - slides left when chat opens */}
              <div 
                className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col h-full transition-all duration-500 ease-out flex-shrink-0"
                style={{
                  width: chatOpen ? 'calc(50% - 8px)' : '100%',
                }}
              >
              {/* Search Bar - slides up when chat is open */}
              <div className={`border-b border-slate-200 transition-all duration-500 ease-in-out flex-shrink-0 ${
                chatOpen ? "max-h-0 opacity-0 overflow-hidden p-0 border-b-0" : "max-h-20 opacity-100 p-4"
              }`}>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && doSearch()}
                    placeholder="What are you looking for?"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    onClick={doSearch}
                    disabled={searching}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {searching ? "..." : "Search"}
                  </button>
                </div>
              </div>

              {/* Results - fills remaining space */}
              <div className="flex-1 overflow-hidden flex flex-col">
                {chatOpen && (
                  <div className="px-4 py-3 border-b border-slate-200 flex-shrink-0">
                    <p className="text-sm text-slate-500">Results for: <span className="font-medium text-slate-700">"{chatQuery}"</span></p>
                  </div>
                )}
                <div className="flex-1 overflow-y-auto">
                  {results.length > 0 && (
                    <ul className="divide-y divide-slate-100">
                      {results.map((r, i) => (
                        <li
                          key={r.doc_id + i}
                          onClick={() => setSelectedDoc(r)}
                          className="px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                        >
                          <div className="font-medium text-slate-800">{r.title || r.doc_id}</div>
                          <div className="text-sm text-slate-600 mt-1 line-clamp-2">{r.snippet}</div>
                          {r.score != null && (
                            <div className="text-xs text-slate-400 mt-1">Score: {r.score.toFixed(4)}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {results.length === 0 && query && !searching && (
                    <p className="text-slate-500 p-4">No results found.</p>
                  )}
                </div>
              </div>
            </div>

              {/* Chat Panel - slides in from right */}
              <div 
                className={`bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col h-full transition-all duration-500 ease-out flex-shrink-0 ${
                  chatOpen 
                    ? "opacity-100" 
                    : "opacity-0 pointer-events-none"
                }`}
                style={{
                  width: chatOpen ? 'calc(50% - 8px)' : '0px',
                  minWidth: chatOpen ? 'calc(50% - 8px)' : '0px',
                }}
              >
              {chatOpen && (
                <>
                  {/* Chat Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-purple-50 to-blue-50 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <SparklesIcon className="w-5 h-5 text-purple-600" />
                      <span className="font-medium text-slate-800">AI Chat</span>
                    </div>
                    <button
                      onClick={closeChat}
                      className="p-1 rounded-md hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
                      title="Close chat"
                    >
                      <XIcon className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Chat Messages - fills remaining space */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {chatHistory.map((item, i) => (
                      <div key={i} className="space-y-3">
                        {/* User message */}
                        <div className="flex justify-end">
                          <div className="bg-blue-600 text-white rounded-lg px-4 py-2 max-w-[80%]">
                            {item.question}
                          </div>
                        </div>
                        {/* AI response */}
                        <div className="flex justify-start">
                          <div className="bg-slate-100 rounded-lg px-4 py-3 max-w-[90%]">
                            <div className="text-slate-800 whitespace-pre-wrap text-sm">{item.response.answer}</div>
                            {item.response.sources.length > 0 && (
                              <div className="mt-3 pt-2 border-t border-slate-200">
                                <p className="text-xs text-slate-500 mb-1">Sources:</p>
                                <div className="flex flex-wrap gap-1">
                                  {item.response.sources.map((src, j) => (
                                    <span
                                      key={j}
                                      className="inline-block px-2 py-0.5 bg-slate-200 text-slate-600 text-xs rounded"
                                    >
                                      {src.title || src.doc_id}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {/* Pending question and loading indicator */}
                    {pendingQuestion && (
                      <div className="space-y-3">
                        {/* User message (pending) */}
                        <div className="flex justify-end">
                          <div className="bg-blue-600 text-white rounded-lg px-4 py-2 max-w-[80%]">
                            {pendingQuestion}
                          </div>
                        </div>
                        {/* Loading indicator */}
                        <div className="flex justify-start">
                          <div className="bg-slate-100 rounded-lg px-4 py-3">
                            <div className="flex items-center gap-2 text-slate-500">
                              <div className="flex gap-1">
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Chat Input */}
                  <div className="p-3 border-t border-slate-200 bg-slate-50 flex-shrink-0">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={chatQuestion}
                        onChange={(e) => setChatQuestion(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !chatLoading && doChat()}
                        placeholder="Ask a follow-up question..."
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 text-sm"
                        disabled={chatLoading}
                      />
                      <button
                        onClick={() => doChat()}
                        disabled={chatLoading || !chatQuestion.trim()}
                        className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            </div>
          </div>
        )}
      </main>
      {/* Floating AI Button - slides in from right when search results appear */}
      {step === "search" && results.length > 0 && !chatOpen && (
        <button
          onClick={openChat}
          className={`fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-purple-600 to-blue-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center justify-center group ${
            showAiButton ? "translate-x-0 opacity-100" : "translate-x-20 opacity-0"
          }`}
          title="Chat with AI about your search"
        >
          <SparklesIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
          {/* Tooltip */}
          <span className="absolute right-full mr-3 px-3 py-2 bg-slate-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Ask AI about results
          </span>
        </button>
      )}

      {selectedDoc && (
        <DocumentModal doc={selectedDoc} onClose={() => setSelectedDoc(null)} />
      )}
    </div>
  );
}
