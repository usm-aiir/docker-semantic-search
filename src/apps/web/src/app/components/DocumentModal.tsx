import type { SearchResult } from "../api";

interface Props {
  doc: SearchResult;
  onClose: () => void;
}

export default function DocumentModal({ doc, onClose }: Props) {
  const body = doc.body ?? doc.snippet;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-start">
          <h3 className="text-lg font-semibold text-slate-800">{doc.title || doc.doc_id}</h3>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {Object.keys(doc.metadata).length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-slate-600 mb-2">Metadata</h4>
              <dl className="text-sm">
                {Object.entries(doc.metadata).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="font-medium text-slate-600">{k}:</dt>
                    <dd className="text-slate-800">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          <h4 className="text-sm font-medium text-slate-600 mb-2">Content</h4>
          <div className="text-slate-800 whitespace-pre-wrap text-sm">{body}</div>
        </div>
      </div>
    </div>
  );
}
