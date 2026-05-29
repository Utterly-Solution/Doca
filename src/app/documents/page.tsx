'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Trash2,
  Eye,
  Search,
  Upload,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { DocumentFile } from '@/lib/types';
import { getDocuments, deleteDocument, addAuditEntry } from '@/lib/store';

export default function DocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    setDocuments(getDocuments());
  }, []);

  const filtered = documents.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = (doc: DocumentFile) => {
    deleteDocument(doc.id);
    addAuditEntry({
      action: 'delete',
      resourceType: 'document',
      resourceId: doc.id,
      details: `Document deleted: ${doc.name}`,
    });
    setDocuments(getDocuments());
    setDeleteConfirm(null);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (documents.length === 0 && !search) {
    return (
      <div className="p-4 sm:p-6">
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-200">
          <Upload className="w-12 h-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No documents yet</h3>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            Upload your first document to get started
          </p>
          <button
            onClick={() => router.push('/analyzer')}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Analyzer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Search bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-0 sm:justify-between mb-6">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={() => router.push('/analyzer')}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors sm:ml-4"
        >
          <Upload className="w-4 h-4" />
          Upload New
        </button>
      </div>

      {/* Mobile: Card layout */}
      <div className="sm:hidden space-y-3">
        {filtered.map((doc) => (
          <div key={doc.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-900 truncate">{doc.name}</span>
              </div>
              {doc.summary ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full flex-shrink-0">
                  <CheckCircle2 className="w-3 h-3" />
                  Analyzed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full flex-shrink-0">
                  <AlertCircle className="w-3 h-3" />
                  Pending
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
              <span>{formatSize(doc.size)}</span>
              <span>{new Date(doc.uploadDate).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
              <button
                onClick={() => router.push(`/analyzer?id=${doc.id}`)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
              >
                <Eye className="w-3.5 h-3.5" />
                View
              </button>
              {deleteConfirm === doc.id ? (
                <div className="flex items-center gap-1">
                  <button onClick={() => handleDelete(doc)} className="px-2 py-1.5 text-xs bg-red-600 text-white rounded-lg">
                    Confirm
                  </button>
                  <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1.5 text-xs bg-gray-200 text-gray-700 rounded-lg">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(doc.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && search && (
          <div className="py-12 text-center text-gray-400 text-sm">
            No documents matching &quot;{search}&quot;
          </div>
        )}
      </div>

      {/* Desktop: Table layout */}
      <div className="hidden sm:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Size</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Upload Date</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((doc) => (
              <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{doc.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-sm text-gray-500 hidden md:table-cell">{formatSize(doc.size)}</td>
                <td className="px-5 py-3.5 text-sm text-gray-500">
                  {new Date(doc.uploadDate).toLocaleDateString()}
                </td>
                <td className="px-5 py-3.5">
                  {doc.summary ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      Analyzed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-50 px-2 py-1 rounded-full">
                      <AlertCircle className="w-3 h-3" />
                      Pending
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => router.push(`/analyzer?id=${doc.id}`)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                      title="View / Analyze"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {deleteConfirm === doc.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(doc)} className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700">Confirm</button>
                        <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300">Cancel</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(doc.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && search && (
          <div className="py-12 text-center text-gray-400 text-sm">
            No documents matching &quot;{search}&quot;
          </div>
        )}
      </div>
    </div>
  );
}
