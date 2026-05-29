'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  Edit3,
  Trash2,
  Search,
  BookOpen,
  ToggleLeft,
  ToggleRight,
  Save,
} from 'lucide-react';
import { QAPair } from '@/lib/types';
import { getQAPairs, saveQAPairs, addAuditEntry } from '@/lib/store';

export default function KnowledgeBasePage() {
  const [pairs, setPairs] = useState<QAPair[]>([]);
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');

  useEffect(() => {
    setPairs(getQAPairs());
  }, []);

  const filtered = pairs.filter(
    (p) =>
      p.question.toLowerCase().includes(search.toLowerCase()) ||
      p.answer.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    if (!newQuestion.trim() || !newAnswer.trim()) return;
    const newPair: QAPair = {
      id: crypto.randomUUID(),
      question: newQuestion.trim(),
      answer: newAnswer.trim(),
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [newPair, ...pairs];
    saveQAPairs(updated);
    setPairs(updated);
    setNewQuestion('');
    setNewAnswer('');
    setShowAddForm(false);
    addAuditEntry({
      action: 'create',
      resourceType: 'qa_pair',
      resourceId: newPair.id,
      details: `Added Q&A: "${newQuestion.trim().slice(0, 60)}"`,
    });
  };

  const handleUpdate = (id: string) => {
    if (!editQuestion.trim() || !editAnswer.trim()) return;
    const updated = pairs.map((p) =>
      p.id === id
        ? { ...p, question: editQuestion.trim(), answer: editAnswer.trim(), updatedAt: new Date().toISOString() }
        : p
    );
    saveQAPairs(updated);
    setPairs(updated);
    setEditingId(null);
    addAuditEntry({
      action: 'update',
      resourceType: 'qa_pair',
      resourceId: id,
      details: `Updated Q&A: "${editQuestion.trim().slice(0, 60)}"`,
    });
  };

  const handleDelete = (id: string) => {
    const updated = pairs.filter((p) => p.id !== id);
    saveQAPairs(updated);
    setPairs(updated);
    addAuditEntry({
      action: 'delete',
      resourceType: 'qa_pair',
      resourceId: id,
      details: 'Deleted Q&A pair',
    });
  };

  const handleToggle = (id: string) => {
    const updated = pairs.map((p) =>
      p.id === id ? { ...p, active: !p.active, updatedAt: new Date().toISOString() } : p
    );
    saveQAPairs(updated);
    setPairs(updated);
  };

  const startEdit = (pair: QAPair) => {
    setEditingId(pair.id);
    setEditQuestion(pair.question);
    setEditAnswer(pair.answer);
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-0 sm:justify-between mb-6">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Q&A pairs..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors sm:ml-4"
        >
          <Plus className="w-4 h-4" />
          Add Q&A Pair
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">New Q&A Pair</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Question
              </label>
              <textarea
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="e.g., What does PRN mean in medication schedules?"
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={2}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Answer
              </label>
              <textarea
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
                placeholder="e.g., PRN stands for 'pro re nata', meaning 'as needed'..."
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={!newQuestion.trim() || !newAnswer.trim()}
                className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewQuestion('');
                  setNewAnswer('');
                }}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Q&A List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-200">
          <BookOpen className="w-12 h-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No Q&A pairs yet</h3>
          <p className="text-sm text-gray-500 mt-1">
            Add knowledge to improve AI responses for your documents
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((pair) => (
            <div
              key={pair.id}
              className="bg-white border border-gray-200 rounded-xl shadow-sm p-5"
            >
              {editingId === pair.id ? (
                <div className="space-y-3">
                  <textarea
                    value={editQuestion}
                    onChange={(e) => setEditQuestion(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={2}
                  />
                  <textarea
                    value={editAnswer}
                    onChange={(e) => setEditAnswer(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdate(pair.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"
                    >
                      <Save className="w-3 h-3" />
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{pair.question}</p>
                      <p className="text-sm text-gray-600 mt-1.5">{pair.answer}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        Updated {new Date(pair.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          pair.active
                            ? 'bg-green-50 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {pair.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleToggle(pair.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      {pair.active ? (
                        <ToggleRight className="w-4 h-4 text-green-600" />
                      ) : (
                        <ToggleLeft className="w-4 h-4 text-gray-400" />
                      )}
                      {pair.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => startEdit(pair)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(pair.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
