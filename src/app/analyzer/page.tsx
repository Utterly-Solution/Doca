'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Upload,
  FileText,
  AlertTriangle,
  AlertCircle,
  Info,
  Loader2,
  RotateCcw,
  Download,
  ChevronDown,
  History,
  CheckCircle2,
  User,
  Calendar,
  Pill,
  Heart,
  Phone,
  Target,
  Tag,
} from 'lucide-react';
import { DocumentFile, AnalysisFinding, DocumentVersion, ExtractedMetadata } from '@/lib/types';
import {
  getDocuments,
  saveDocuments,
  getDocument,
  updateDocument,
  addAuditEntry,
} from '@/lib/store';
import { parseDocument } from '@/lib/parse-document';
import { exportAsTxt, exportAsDocx, exportAsPdf } from '@/lib/export-document';
import { validateFile } from '@/lib/file-validator';

const ACCEPTED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt', '.md'];

export default function AnalyzerPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-400">Loading...</div>}>
      <AnalyzerContent />
    </Suspense>
  );
}

function AnalyzerContent() {
  const searchParams = useSearchParams();
  const docId = searchParams.get('id');

  const [document, setDocument] = useState<DocumentFile | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'analysis' | 'content'>('summary');

  useEffect(() => {
    if (docId) {
      const doc = getDocument(docId);
      if (doc) setDocument(doc);
    }
  }, [docId]);

  const callAI = useCallback(
    async (mode: 'summary' | 'analysis' | 'extract', text: string): Promise<string> => {
      const promptMap = {
        summary: 'Please summarize this document.',
        analysis: 'Please analyze this document for issues.',
        extract: 'Please extract key metadata from this document.',
      };
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: promptMap[mode] }],
          documentText: text,
          mode,
        }),
      });

      if (!res.ok) throw new Error('API call failed');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream reader');

      const decoder = new TextDecoder();
      let result = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) result += data.text;
            } catch {}
          }
        }
      }

      return result;
    },
    []
  );

  const handleUpload = useCallback(
    async (file: File) => {
      setError(null);

      // Validate file (format, size, and security scan)
      const validation = await validateFile(file);
      if (!validation.valid) {
        setError(validation.error || 'File validation failed.');
        return;
      }

      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      setIsUploading(true);

      try {
        const content = await parseDocument(file);

        const newDoc: DocumentFile = {
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          type: file.type || ext,
          content,
          uploadDate: new Date().toISOString(),
          versions: [
            {
              id: crypto.randomUUID(),
              content,
              timestamp: new Date().toISOString(),
              trigger: 'Initial upload',
              label: 'v1 - Original',
            },
          ],
          currentVersionIndex: 0,
        };

        const docs = getDocuments();
        docs.push(newDoc);
        saveDocuments(docs);
        setDocument(newDoc);
        setIsUploading(false);

        addAuditEntry({
          action: 'upload',
          resourceType: 'document',
          resourceId: newDoc.id,
          details: `Uploaded: ${file.name} (${formatSize(file.size)})`,
        });

        // Auto-summarize
        setIsSummarizing(true);
        try {
          const summary = await callAI('summary', content);
          newDoc.summary = summary;
          updateDocument(newDoc);
          setDocument({ ...newDoc });
          addAuditEntry({
            action: 'summarize',
            resourceType: 'document',
            resourceId: newDoc.id,
            details: `Auto-summary generated for: ${file.name}`,
          });
        } catch (err) {
          console.error('Summary failed:', err);
        }
        setIsSummarizing(false);

        // Auto-analyze
        setIsAnalyzing(true);
        try {
          const analysisRaw = await callAI('analysis', content);
          let analysis: AnalysisFinding[] = [];
          try {
            const cleaned = analysisRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            analysis = JSON.parse(cleaned);
          } catch {
            analysis = [
              {
                severity: 'Info',
                section: 'General',
                description: 'Analysis completed. No structured findings extracted.',
              },
            ];
          }
          newDoc.analysis = analysis;
          updateDocument(newDoc);
          setDocument({ ...newDoc });
          addAuditEntry({
            action: 'analyze',
            resourceType: 'document',
            resourceId: newDoc.id,
            details: `Analysis completed: ${analysis.length} findings for ${file.name}`,
          });
        } catch (err) {
          console.error('Analysis failed:', err);
        }
        setIsAnalyzing(false);

        // Auto-extract metadata
        setIsExtracting(true);
        try {
          const extractRaw = await callAI('extract', content);
          const cleaned = extractRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const metadata: ExtractedMetadata = JSON.parse(cleaned);
          newDoc.extractedMetadata = metadata;
          updateDocument(newDoc);
          setDocument({ ...newDoc });
          addAuditEntry({
            action: 'extract_metadata',
            resourceType: 'document',
            resourceId: newDoc.id,
            details: `Key information extracted for: ${file.name}`,
          });
        } catch (err) {
          console.error('Extraction failed:', err);
        }
        setIsExtracting(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
        setIsUploading(false);
      }
    },
    [callAI]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const handleRollback = (version: DocumentVersion, index: number) => {
    if (!document) return;
    const updated = {
      ...document,
      content: version.content,
      currentVersionIndex: index,
    };
    updated.versions.push({
      id: crypto.randomUUID(),
      content: version.content,
      timestamp: new Date().toISOString(),
      trigger: `Rolled back to ${version.label}`,
      label: `v${updated.versions.length + 1} - Rollback`,
    });
    updated.currentVersionIndex = updated.versions.length - 1;
    updateDocument(updated);
    setDocument(updated);
    addAuditEntry({
      action: 'rollback',
      resourceType: 'document',
      resourceId: document.id,
      details: `Rolled back to ${version.label}`,
    });
  };

  const handleExport = (format: 'txt' | 'docx' | 'pdf') => {
    if (!document) return;
    const baseName = document.name.replace(/\.[^.]+$/, '');
    const content = document.versions[document.currentVersionIndex]?.content || document.content;
    if (format === 'txt') exportAsTxt(content, baseName);
    else if (format === 'docx') exportAsDocx(content, baseName);
    else exportAsPdf(content, baseName);
    setShowExportMenu(false);
    addAuditEntry({
      action: 'export',
      resourceType: 'document',
      resourceId: document.id,
      details: `Exported as ${format.toUpperCase()}: ${document.name}`,
    });
  };

  const severityIcon = (severity: string) => {
    switch (severity) {
      case 'Critical':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'Warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const severityBg = (severity: string) => {
    switch (severity) {
      case 'Critical':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'Warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  // No document loaded — show upload zone
  if (!document) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">Document Analyzer</h1>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 sm:p-16 text-center transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 bg-white hover:border-gray-400'
          }`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
              <p className="text-lg text-gray-600">Processing document...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Upload className="w-12 h-12 text-gray-400" />
              <div>
                <p className="text-lg font-medium text-gray-700">
                  Drag & drop your document here
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Supports PDF, DOC, DOCX, TXT, MD — up to 10 MB
                </p>
              </div>
              <label className="mt-4 px-6 py-2.5 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors font-medium">
                Browse Files
                <input
                  type="file"
                  className="hidden"
                  accept={ACCEPTED_EXTENSIONS.join(',')}
                  onChange={handleFileSelect}
                />
              </label>
            </div>
          )}
        </div>
      </div>
    );
  }

  const meta = document.extractedMetadata;

  // Document loaded — show analysis workspace
  return (
    <div className="p-4 sm:p-6">
      {/* Document header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <FileText className="w-6 h-6 text-blue-600 flex-shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{document.name}</h1>
            <p className="text-xs sm:text-sm text-gray-500">
              {formatSize(document.size)} — Uploaded{' '}
              {new Date(document.uploadDate).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowVersionHistory(!showVersionHistory)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">Version History</span>
            <span className="sm:hidden">History</span>
            ({document.versions.length})
          </button>

          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
              <ChevronDown className="w-3 h-3" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <button
                  onClick={() => handleExport('txt')}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 rounded-t-lg"
                >
                  Download as TXT
                </button>
                <button
                  onClick={() => handleExport('docx')}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50"
                >
                  Download as DOCX
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 rounded-b-lg"
                >
                  Download as PDF
                </button>
              </div>
            )}
          </div>

          <label className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">New Upload</span>
            <span className="sm:hidden">Upload</span>
            <input
              type="file"
              className="hidden"
              accept={ACCEPTED_EXTENSIONS.join(',')}
              onChange={handleFileSelect}
            />
          </label>
        </div>
      </div>

      {/* Version History Panel */}
      {showVersionHistory && (
        <div className="mb-6 bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <History className="w-5 h-5" />
            Version History
          </h3>
          <div className="space-y-2">
            {document.versions.map((version, index) => (
              <div
                key={version.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border ${
                  index === document.currentVersionIndex
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-gray-100 bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  {index === document.currentVersionIndex && (
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{version.label}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(version.timestamp).toLocaleString()} — {version.trigger}
                    </p>
                  </div>
                </div>
                {index !== document.currentVersionIndex && (
                  <button
                    onClick={() => handleRollback(version, index)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Rollback
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main content with sidebar */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Tabs and content */}
        <div className="flex-1 min-w-0">
          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
            {(['summary', 'analysis', 'content'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === tab
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {activeTab === 'summary' && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Document Summary</h3>
              {isSummarizing ? (
                <div className="flex items-center gap-3 text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating summary with AI...
                </div>
              ) : document.summary ? (
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {document.summary}
                </p>
              ) : (
                <p className="text-gray-400 italic">No summary available.</p>
              )}
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Smart Analysis</h3>
              {isAnalyzing ? (
                <div className="flex items-center gap-3 text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analyzing document for issues...
                </div>
              ) : document.analysis && document.analysis.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex gap-3 mb-4">
                    {['Critical', 'Warning', 'Info'].map((sev) => {
                      const count = document.analysis!.filter((f) => f.severity === sev).length;
                      if (count === 0) return null;
                      return (
                        <span
                          key={sev}
                          className={`px-3 py-1 rounded-full text-xs font-medium border ${severityBg(sev)}`}
                        >
                          {count} {sev}
                        </span>
                      );
                    })}
                  </div>

                  {document.analysis.map((finding, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-3 p-4 rounded-lg border ${severityBg(finding.severity)}`}
                    >
                      {severityIcon(finding.severity)}
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wide">
                          {finding.section}
                        </span>
                        <p className="text-sm mt-0.5">{finding.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="w-5 h-5" />
                  No issues found. Document looks good!
                </div>
              )}
            </div>
          )}

          {activeTab === 'content' && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Document Content</h3>
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-mono bg-gray-50 p-4 rounded-lg max-h-[600px] overflow-y-auto">
                {document.versions[document.currentVersionIndex]?.content || document.content}
              </div>
            </div>
          )}
        </div>

        {/* Right: Key Information Sidebar */}
        <div className="w-full lg:w-80 flex-shrink-0">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 sticky top-4">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Tag className="w-4 h-4 text-blue-600" />
              Key Information
            </h3>

            {isExtracting ? (
              <div className="flex items-center gap-3 text-gray-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Extracting key information...
              </div>
            ) : meta ? (
              <div className="space-y-4">
                {meta.documentType && (
                  <MetadataField icon={<FileText className="w-3.5 h-3.5" />} label="Document Type" value={meta.documentType} />
                )}
                {meta.patientName && (
                  <MetadataField icon={<User className="w-3.5 h-3.5" />} label="Patient Name" value={meta.patientName} />
                )}
                {meta.dateOfBirth && (
                  <MetadataField icon={<Calendar className="w-3.5 h-3.5" />} label="Date of Birth" value={meta.dateOfBirth} />
                )}
                {meta.caregiverName && (
                  <MetadataField icon={<User className="w-3.5 h-3.5" />} label="Caregiver" value={meta.caregiverName} />
                )}
                {meta.serviceDates && (
                  <MetadataField icon={<Calendar className="w-3.5 h-3.5" />} label="Service Dates" value={meta.serviceDates} />
                )}
                {meta.medications && meta.medications.length > 0 && (
                  <MetadataList icon={<Pill className="w-3.5 h-3.5" />} label="Medications" items={meta.medications} />
                )}
                {meta.allergies && meta.allergies.length > 0 && (
                  <MetadataList icon={<Heart className="w-3.5 h-3.5" />} label="Allergies" items={meta.allergies} color="text-red-600 bg-red-50" />
                )}
                {meta.emergencyContacts && meta.emergencyContacts.length > 0 && (
                  <MetadataList icon={<Phone className="w-3.5 h-3.5" />} label="Emergency Contacts" items={meta.emergencyContacts} />
                )}
                {meta.carePlanGoals && meta.carePlanGoals.length > 0 && (
                  <MetadataList icon={<Target className="w-3.5 h-3.5" />} label="Care Plan Goals" items={meta.carePlanGoals} />
                )}
                {meta.otherFields && Object.keys(meta.otherFields).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Other Details</p>
                    <div className="space-y-1.5">
                      {Object.entries(meta.otherFields).map(([key, value]) => (
                        <div key={key} className="text-sm">
                          <span className="font-medium text-gray-700">{key}:</span>{' '}
                          <span className="text-gray-600">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No metadata extracted yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetadataField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
        {icon}
        {label}
      </div>
      <p className="text-sm text-gray-900">{value}</p>
    </div>
  );
}

function MetadataList({ icon, label, items, color }: { icon: React.ReactNode; label: string; items: string[]; color?: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
        {icon}
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span key={i} className={`text-xs px-2 py-1 rounded-md ${color || 'text-gray-700 bg-gray-100'}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
