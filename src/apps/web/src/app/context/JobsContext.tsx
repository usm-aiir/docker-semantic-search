import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { listJobs, getJobStatus, type JobStatus } from "../api";

interface JobsContextValue {
  jobs: JobStatus[];
  activeCount: number;
  registerJob: (jobId: string) => void;
  dismissJob: (jobId: string) => void;
  refreshJobs: () => Promise<void>;
}

const JobsContext = createContext<JobsContextValue | null>(null);

export function useJobs() {
  const ctx = useContext(JobsContext);
  if (!ctx) throw new Error("useJobs must be used within JobsProvider");
  return ctx;
}

export function JobsProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const pollingRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<number | null>(null);

  const refreshJobs = useCallback(async () => {
    try {
      const res = await listJobs();
      setJobs((prev) => {
        // Merge: keep locally tracked jobs that aren't in the server response yet
        const serverIds = new Set(res.jobs.map((j) => j.job_id));
        const localOnly = prev.filter(
          (j) => !serverIds.has(j.job_id) && (j.status === "queued" || j.status === "processing")
        );
        return [...res.jobs, ...localOnly];
      });
    } catch {
      // Ignore errors during background polling
    }
  }, []);

  // Poll individual jobs that are active
  const pollActiveJobs = useCallback(async () => {
    const activeJobs = jobs.filter(
      (j) => (j.status === "queued" || j.status === "processing") && !dismissed.has(j.job_id)
    );

    if (activeJobs.length === 0) return;

    const updates = await Promise.all(
      activeJobs.map(async (job) => {
        try {
          return await getJobStatus(job.job_id);
        } catch {
          return job;
        }
      })
    );

    setJobs((prev) => {
      const updateMap = new Map(updates.map((u) => [u.job_id, u]));
      return prev.map((j) => updateMap.get(j.job_id) || j);
    });
  }, [jobs, dismissed]);

  // Register a new job for tracking
  const registerJob = useCallback((jobId: string) => {
    pollingRef.current.add(jobId);
    // Immediately add a placeholder and start polling
    setJobs((prev) => {
      if (prev.some((j) => j.job_id === jobId)) return prev;
      return [
        {
          job_id: jobId,
          status: "queued",
          total_records: 0,
          processed: 0,
          failed: 0,
          error_sample: null,
        },
        ...prev,
      ];
    });
  }, []);

  // Dismiss a completed/failed job from the UI
  const dismissJob = useCallback((jobId: string) => {
    setDismissed((prev) => new Set([...prev, jobId]));
    pollingRef.current.delete(jobId);
  }, []);

  // Initial load
  useEffect(() => {
    refreshJobs();
  }, [refreshJobs]);

  // Polling interval for active jobs
  useEffect(() => {
    const hasActive = jobs.some(
      (j) => (j.status === "queued" || j.status === "processing") && !dismissed.has(j.job_id)
    );

    if (hasActive) {
      intervalRef.current = window.setInterval(pollActiveJobs, 2000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [jobs, dismissed, pollActiveJobs]);

  const visibleJobs = jobs.filter((j) => !dismissed.has(j.job_id));
  const activeCount = visibleJobs.filter(
    (j) => j.status === "queued" || j.status === "processing"
  ).length;

  return (
    <JobsContext.Provider
      value={{ jobs: visibleJobs, activeCount, registerJob, dismissJob, refreshJobs }}
    >
      {children}
    </JobsContext.Provider>
  );
}
