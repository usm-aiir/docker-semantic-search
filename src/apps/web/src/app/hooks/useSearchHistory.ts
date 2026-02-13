import { useState, useEffect, useCallback } from "react";

export interface SearchHistoryEntry {
  id: string;
  query: string;
  collection: string;
  timestamp: number;
  resultCount?: number;
}

const STORAGE_KEY = "semantic-search-history";
const MAX_HISTORY = 20;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadHistory(): SearchHistoryEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: SearchHistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // localStorage might be full or unavailable
  }
}

export function useSearchHistory(collection?: string) {
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);

  // Load history on mount
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // Add a new search to history
  const addSearch = useCallback(
    (query: string, resultCount?: number) => {
      if (!query.trim() || !collection) return;

      setHistory((prev) => {
        // Remove duplicate queries for the same collection
        const filtered = prev.filter(
          (h) => !(h.query === query && h.collection === collection)
        );

        const newEntry: SearchHistoryEntry = {
          id: generateId(),
          query: query.trim(),
          collection,
          timestamp: Date.now(),
          resultCount,
        };

        // Add to front, limit to MAX_HISTORY
        const updated = [newEntry, ...filtered].slice(0, MAX_HISTORY);
        saveHistory(updated);
        return updated;
      });
    },
    [collection]
  );

  // Get history for current collection (or all if no collection specified)
  const getCollectionHistory = useCallback(
    (limit?: number): SearchHistoryEntry[] => {
      const filtered = collection
        ? history.filter((h) => h.collection === collection)
        : history;
      return limit ? filtered.slice(0, limit) : filtered;
    },
    [history, collection]
  );

  // Clear history (optionally for specific collection)
  const clearHistory = useCallback((collectionOnly = false) => {
    setHistory((prev) => {
      const updated = collectionOnly && collection
        ? prev.filter((h) => h.collection !== collection)
        : [];
      saveHistory(updated);
      return updated;
    });
  }, [collection]);

  // Remove a single entry
  const removeEntry = useCallback((id: string) => {
    setHistory((prev) => {
      const updated = prev.filter((h) => h.id !== id);
      saveHistory(updated);
      return updated;
    });
  }, []);

  return {
    history,
    addSearch,
    getCollectionHistory,
    clearHistory,
    removeEntry,
  };
}
