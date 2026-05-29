'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  MessageSquare,
  FileText,
  Edit3,
  Check,
  X,
  Loader2,
  Trash2,
  ChevronRight,
} from 'lucide-react';
import {
  ChatMessage,
  ChatSession,
  DocumentFile,
  DiffResult,
  ChatMode,
} from '@/lib/types';
import {
  getDocuments,
  getSessions,
  updateSession,
  deleteSession,
  getDocument,
  updateDocument,
  getQAPairs,
  addAuditEntry,
} from '@/lib/store';

export default function ChatbotPage() {
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentFile | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showSessionSidebar, setShowSessionSidebar] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDocuments(getDocuments());
    setSessions(getSessions());
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages]);

  const selectDocument = (doc: DocumentFile) => {
    setSelectedDoc(doc);
    // Find existing session or create new
    const existingSession = getSessions().find((s) => s.documentId === doc.id);
    if (existingSession) {
      setCurrentSession(existingSession);
    } else {
      const newSession: ChatSession = {
        id: crypto.randomUUID(),
        documentId: doc.id,
        documentName: doc.name,
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updateSession(newSession);
      setCurrentSession(newSession);
      setSessions(getSessions());
    }
  };

  const loadSession = (session: ChatSession) => {
    setCurrentSession(session);
    const doc = getDocument(session.documentId);
    if (doc) setSelectedDoc(doc);
  };

  const handleDeleteSession = (sessionId: string) => {
    deleteSession(sessionId);
    setSessions(getSessions());
    if (currentSession?.id === sessionId) {
      setCurrentSession(null);
      setSelectedDoc(null);
    }
  };

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !selectedDoc || !currentSession || isStreaming) return;

    const mode: ChatMode = editMode ? 'edit' : 'qa';
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
      mode,
    };

    const updatedMessages = [...currentSession.messages, userMessage];
    const updatedSession = {
      ...currentSession,
      messages: updatedMessages,
      updatedAt: new Date().toISOString(),
    };
    setCurrentSession(updatedSession);
    updateSession(updatedSession);
    setInput('');
    setIsStreaming(true);

    // Build Q&A context
    const qaPairs = getQAPairs()
      .filter((p) => p.active)
      .map((p) => `Q: ${p.question}\nA: ${p.answer}`)
      .join('\n\n');

    const docContent =
      selectedDoc.versions[selectedDoc.currentVersionIndex]?.content || selectedDoc.content;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          documentText: docContent,
          mode,
          qaPairs: qaPairs || undefined,
        }),
      });

      if (!res.ok) throw new Error('API request failed');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream reader');

      const decoder = new TextDecoder();
      let fullResponse = '';

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        mode,
      };

      const streamMessages = [...updatedMessages, assistantMessage];
      const streamSession = {
        ...updatedSession,
        messages: streamMessages,
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) {
                fullResponse += data.text;
                assistantMessage.content = fullResponse;
                setCurrentSession({
                  ...streamSession,
                  messages: [...updatedMessages, { ...assistantMessage }],
                });
              }
            } catch {}
          }
        }
      }

      // Handle edit mode — try to parse diff
      if (mode === 'edit') {
        try {
          const cleaned = fullResponse
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();
          const diff: DiffResult = JSON.parse(cleaned);
          assistantMessage.diff = diff;
          assistantMessage.diffStatus = 'pending';
          assistantMessage.content = fullResponse;
        } catch {
          // Not valid JSON, just show as text
        }
      }

      const finalMessages = [...updatedMessages, assistantMessage];
      const finalSession = {
        ...updatedSession,
        messages: finalMessages,
        updatedAt: new Date().toISOString(),
      };
      setCurrentSession(finalSession);
      updateSession(finalSession);
      setSessions(getSessions());

      addAuditEntry({
        action: mode === 'edit' ? 'edit_request' : 'chat_query',
        resourceType: 'document',
        resourceId: selectedDoc.id,
        details: `${mode === 'edit' ? 'Edit request' : 'Q&A query'}: "${input.trim().slice(0, 100)}"`,
      });
    } catch (err) {
      console.error('Chat error:', err);
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Sorry, an error occurred. Please try again.',
        timestamp: new Date().toISOString(),
      };
      const errorSession = {
        ...updatedSession,
        messages: [...updatedMessages, errorMessage],
      };
      setCurrentSession(errorSession);
      updateSession(errorSession);
    }

    setIsStreaming(false);
  }, [input, selectedDoc, currentSession, isStreaming, editMode]);

  const handleAcceptEdit = (message: ChatMessage) => {
    if (!message.diff || !selectedDoc) return;

    const currentContent =
      selectedDoc.versions[selectedDoc.currentVersionIndex]?.content || selectedDoc.content;
    const newContent = currentContent.replace(message.diff.original, message.diff.revised);

    const newVersion = {
      id: crypto.randomUUID(),
      content: newContent,
      timestamp: new Date().toISOString(),
      trigger: `Chat edit: "${currentSession?.messages.find((m) => m.id !== message.id && m.role === 'user')?.content?.slice(0, 80) || 'Edit'}"`,
      label: `v${selectedDoc.versions.length + 1} - Chat Edit`,
    };

    const updatedDoc = {
      ...selectedDoc,
      content: newContent,
      versions: [...selectedDoc.versions, newVersion],
      currentVersionIndex: selectedDoc.versions.length,
    };
    updateDocument(updatedDoc);
    setSelectedDoc(updatedDoc);

    // Update message status
    if (currentSession) {
      const updatedMessages = currentSession.messages.map((m) =>
        m.id === message.id ? { ...m, diffStatus: 'accepted' as const } : m
      );
      const updatedSession = { ...currentSession, messages: updatedMessages };
      setCurrentSession(updatedSession);
      updateSession(updatedSession);
    }

    addAuditEntry({
      action: 'edit_accepted',
      resourceType: 'document',
      resourceId: selectedDoc.id,
      details: `Edit accepted, created ${newVersion.label}`,
    });
  };

  const handleRejectEdit = (message: ChatMessage) => {
    if (!currentSession) return;
    const updatedMessages = currentSession.messages.map((m) =>
      m.id === message.id ? { ...m, diffStatus: 'rejected' as const } : m
    );
    const updatedSession = { ...currentSession, messages: updatedMessages };
    setCurrentSession(updatedSession);
    updateSession(updatedSession);
  };

  return (
    <div className="flex h-[calc(100vh-120px)] relative">
      {/* Mobile overlay for session sidebar */}
      {showSessionSidebar && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 z-20"
          onClick={() => setShowSessionSidebar(false)}
        />
      )}

      {/* Session Sidebar */}
      {showSessionSidebar && (
        <div className="absolute md:relative z-30 w-64 sm:w-72 h-full border-r border-gray-200 bg-gray-50 flex flex-col shadow-lg md:shadow-none">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 text-sm">Chat Sessions</h3>
          </div>

          {/* Document selector */}
          <div className="p-3 border-b border-gray-200">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Select Document
            </label>
            <select
              className="mt-1 w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
              value={selectedDoc?.id || ''}
              onChange={(e) => {
                const doc = documents.find((d) => d.id === e.target.value);
                if (doc) selectDocument(doc);
              }}
            >
              <option value="">Choose a document...</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Session list */}
          <div className="flex-1 overflow-y-auto">
            {sessions.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">No sessions yet</p>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className={`flex items-center justify-between p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors ${
                    currentSession?.id === session.id ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => loadSession(session)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {session.documentName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {session.messages.length} messages —{' '}
                      {new Date(session.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSession(session.id);
                    }}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSessionSidebar(!showSessionSidebar)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight
                className={`w-4 h-4 text-gray-500 transition-transform ${
                  showSessionSidebar ? 'rotate-180' : ''
                }`}
              />
            </button>
            {selectedDoc ? (
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-sm text-gray-900 truncate max-w-[150px] sm:max-w-none">{selectedDoc.name}</span>
              </div>
            ) : (
              <span className="text-sm text-gray-400">Select a document to start chatting</span>
            )}
          </div>

          {selectedDoc && (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs font-medium text-gray-600">Edit Mode</span>
                <button
                  onClick={() => setEditMode(!editMode)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    editMode ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                      editMode ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </label>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {!selectedDoc ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <MessageSquare className="w-12 h-12 mb-3" />
              <p className="text-lg font-medium">Chat with your documents</p>
              <p className="text-sm mt-1">Select a document from the sidebar to begin</p>
            </div>
          ) : currentSession?.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <MessageSquare className="w-12 h-12 mb-3" />
              <p className="text-lg font-medium">Start a conversation</p>
              <p className="text-sm mt-1">
                Ask questions about <span className="font-medium">{selectedDoc.name}</span>
              </p>
              {editMode && (
                <p className="text-xs mt-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full">
                  Edit Mode is active — propose changes to the document
                </p>
              )}
            </div>
          ) : (
            currentSession?.messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] sm:max-w-[75%] rounded-xl px-3 sm:px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-800'
                  }`}
                >
                  {message.mode === 'edit' && message.role === 'user' && (
                    <span className="inline-block text-xs bg-blue-500 px-2 py-0.5 rounded mb-1">
                      Edit Request
                    </span>
                  )}

                  {/* Diff view for edit responses */}
                  {message.diff && message.role === 'assistant' ? (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Proposed Changes:</p>
                      <div className="space-y-2 mb-3">
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="text-xs font-medium text-red-600 mb-1">Original:</p>
                          <p className="text-sm text-red-800 line-through">
                            {message.diff.original}
                          </p>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <p className="text-xs font-medium text-green-600 mb-1">Revised:</p>
                          <p className="text-sm text-green-800">{message.diff.revised}</p>
                        </div>
                      </div>

                      {message.diffStatus === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAcceptEdit(message)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                          >
                            <Check className="w-3 h-3" />
                            Accept
                          </button>
                          <button
                            onClick={() => handleRejectEdit(message)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                          >
                            <X className="w-3 h-3" />
                            Reject
                          </button>
                        </div>
                      )}
                      {message.diffStatus === 'accepted' && (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600">
                          <Check className="w-3 h-3" /> Accepted
                        </span>
                      )}
                      {message.diffStatus === 'rejected' && (
                        <span className="inline-flex items-center gap-1 text-xs text-red-500">
                          <X className="w-3 h-3" /> Rejected
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}

                  <p
                    className={`text-xs mt-2 ${
                      message.role === 'user' ? 'text-blue-200' : 'text-gray-400'
                    }`}
                  >
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))
          )}
          {isStreaming && (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              AI is thinking...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {selectedDoc && (
          <div className="border-t border-gray-200 bg-white p-3 sm:p-4">
            {editMode && (
              <div className="mb-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 flex items-center gap-2">
                <Edit3 className="w-3 h-3" />
                Edit Mode: Describe the changes you want to make to the document
              </div>
            )}
            <div className="flex gap-2 sm:gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={
                  editMode
                    ? 'Describe the edit you want to make...'
                    : 'Ask a question about the document...'
                }
                disabled={isStreaming}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isStreaming}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
