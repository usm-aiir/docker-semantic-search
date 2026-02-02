import { useState, useEffect } from "react";
import { useJobs } from "../context/JobsContext";
import { cancelJob } from "../api";

export default function BackgroundJobs() {
  const { jobs, activeCount, dismissJob, refreshJobs } = useJobs();
  const [expanded, setExpanded] = useState(false);
  const [recentlyCompleted, setRecentlyCompleted] = useState<Set<string>>(new Set());
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleDismissOrCancel = async (job: { job_id: string; status: string }) => {
    const isActive = job.status === "queued" || job.status === "processing";
    if (isActive) {
      setCancellingId(job.job_id);
      try {
        await cancelJob(job.job_id);
        refreshJobs();
        dismissJob(job.job_id);
      } catch {
        // Leave job visible on error
      } finally {
        setCancellingId(null);
      }
    } else {
      dismissJob(job.job_id);
    }
  };

  // Track recently completed jobs for auto-dismiss
  useEffect(() => {
    const completed = jobs.filter(
      (j) => j.status === "completed" || j.status === "failed" || j.status === "cancelled"
    );
    const newlyCompleted = completed.filter((j) => !recentlyCompleted.has(j.job_id));

    if (newlyCompleted.length > 0) {
      setRecentlyCompleted((prev) => new Set([...prev, ...newlyCompleted.map((j) => j.job_id)]));

      // Auto-dismiss completed jobs after 10 seconds
      newlyCompleted.forEach((job) => {
        setTimeout(() => {
          dismissJob(job.job_id);
        }, 10000);
      });
    }
  }, [jobs, recentlyCompleted, dismissJob]);

  // Don't render if no jobs
  if (jobs.length === 0) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-600";
      case "failed":
        return "text-red-600";
      case "cancelled":
        return "text-amber-600";
      case "processing":
        return "text-blue-600";
      default:
        return "text-slate-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case "failed":
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case "cancelled":
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        );
      case "processing":
        return (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth={2} />
          </svg>
        );
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-50">
      {/* Collapsed view */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg shadow-lg hover:bg-slate-50 transition-colors"
        >
          {activeCount > 0 ? (
            <>
              <svg className="w-4 h-4 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-slate-700">
                {activeCount} job{activeCount !== 1 ? "s" : ""} running
              </span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-slate-700">
                {jobs.length} job{jobs.length !== 1 ? "s" : ""} complete
              </span>
            </>
          )}
        </button>
      )}

      {/* Expanded view */}
      {expanded && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-xl w-80 max-h-96 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
            <span className="text-sm font-medium text-slate-700">Background Jobs</span>
            <button
              onClick={() => setExpanded(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Job list */}
          <div className="overflow-y-auto max-h-72">
            {jobs.map((job) => (
              <div
                key={job.job_id}
                className="px-4 py-3 border-b border-slate-100 last:border-b-0"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={getStatusColor(job.status)}>{getStatusIcon(job.status)}</span>
                    <span className="text-sm font-medium text-slate-800 truncate">
                      {job.collection_name || "Indexing"}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDismissOrCancel(job)}
                    disabled={cancellingId === job.job_id}
                    className="text-slate-400 hover:text-slate-600 flex-shrink-0 disabled:opacity-50"
                    title={job.status === "queued" || job.status === "processing" ? "Cancel job" : "Dismiss"}
                  >
                    {cancellingId === job.job_id ? (
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Progress info */}
                <div className="text-xs text-slate-500 mb-1.5">
                  {job.status === "completed" ? (
                    <span className="text-green-600">
                      Completed: {job.processed} document{job.processed !== 1 ? "s" : ""}
                    </span>
                  ) : job.status === "failed" ? (
                    <span className="text-red-600">
                      Failed{job.error_sample ? `: ${job.error_sample}` : ""}
                    </span>
                  ) : job.status === "cancelled" ? (
                    <span className="text-amber-600">
                      Cancelled: {job.processed} / {job.total_records || "?"} documents
                    </span>
                  ) : (
                    <span>
                      {job.processed} / {job.total_records || "?"} documents
                      {job.failed > 0 && ` (${job.failed} failed)`}
                    </span>
                  )}
                </div>

                {/* Progress bar for active jobs */}
                {(job.status === "queued" || job.status === "processing") && (
                  <div className="w-full bg-slate-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                      style={{
                        width: job.total_records
                          ? `${Math.min(100, (100 * job.processed) / job.total_records)}%`
                          : "0%",
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
