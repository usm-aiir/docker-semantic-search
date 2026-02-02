import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listCollections, createCollection, deleteCollection } from "../api";

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

export default function Home() {
  const [collections, setCollections] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const res = await listCollections();
      setCollections(res.collections);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await createCollection(newName.trim());
      setNewName("");
      await load();
      navigate(`/collection/${encodeURIComponent(newName.trim())}?mode=add`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete collection "${name}"? This will remove all indexed documents.`)) return;
    setDeleting(name);
    setError(null);
    try {
      await deleteCollection(name);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="text-xl font-semibold text-slate-800">Semantic Search</h1>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-10">
        <h2 className="text-lg font-medium text-slate-700 mb-4">Collections</h2>
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
        )}
        <form onSubmit={handleCreate} className="flex gap-2 mb-6">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New collection name"
            className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Create
          </button>
        </form>
        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : collections.length === 0 ? (
          <p className="text-slate-500">No collections yet. Create one above.</p>
        ) : (
          <ul className="space-y-2">
            {collections.map((name) => (
              <li
                key={name}
                className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg transition-all"
              >
                <button
                  onClick={() => navigate(`/collection/${encodeURIComponent(name)}?mode=search`)}
                  className="flex-1 px-2 py-2 text-left transition-all"
                >
                  <span className="block px-3 py-2 font-medium text-slate-800 rounded-md hover:bg-slate-100 hover:shadow-inner transition-all">
                    {name}
                  </span>
                </button>
                <div className="flex items-center gap-1 pr-2">
                  <button
                    onClick={() => navigate(`/collection/${encodeURIComponent(name)}?mode=add`)}
                    className="p-2 rounded-md hover:bg-green-50 text-slate-500 hover:text-green-600 transition-colors"
                    title="Add to this collection"
                  >
                    <PlusIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(name)}
                    disabled={deleting === name}
                    className="p-2 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
                    title="Delete collection"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
