import { DocumentFile, ChatSession, QAPair, AuditLogEntry, User } from './types';
import { getCurrentUser } from './auth';

const STORAGE_KEYS = {
  DOCUMENTS: 'doca_documents',
  SESSIONS: 'doca_sessions',
  QA_PAIRS: 'doca_qa_pairs',
  AUDIT_LOG: 'doca_audit_log',
};

function getItem<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

function setItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

// Get current authenticated user
export function currentUser(): User {
  const user = getCurrentUser();
  if (user) return user;
  return { id: 'unknown', name: 'Unknown', email: '', role: 'Caregiver' };
}

// Documents
export function getDocuments(): DocumentFile[] {
  return getItem<DocumentFile[]>(STORAGE_KEYS.DOCUMENTS, []);
}

export function saveDocuments(docs: DocumentFile[]): void {
  setItem(STORAGE_KEYS.DOCUMENTS, docs);
}

export function getDocument(id: string): DocumentFile | undefined {
  return getDocuments().find((d) => d.id === id);
}

export function updateDocument(doc: DocumentFile): void {
  const docs = getDocuments();
  const index = docs.findIndex((d) => d.id === doc.id);
  if (index !== -1) {
    docs[index] = doc;
    saveDocuments(docs);
  }
}

export function deleteDocument(id: string): void {
  const docs = getDocuments().filter((d) => d.id !== id);
  saveDocuments(docs);
}

// Chat Sessions
export function getSessions(): ChatSession[] {
  return getItem<ChatSession[]>(STORAGE_KEYS.SESSIONS, []);
}

export function saveSessions(sessions: ChatSession[]): void {
  setItem(STORAGE_KEYS.SESSIONS, sessions);
}

export function getSession(id: string): ChatSession | undefined {
  return getSessions().find((s) => s.id === id);
}

export function updateSession(session: ChatSession): void {
  const sessions = getSessions();
  const index = sessions.findIndex((s) => s.id === session.id);
  if (index !== -1) {
    sessions[index] = session;
  } else {
    sessions.push(session);
  }
  saveSessions(sessions);
}

export function deleteSession(id: string): void {
  const sessions = getSessions().filter((s) => s.id !== id);
  saveSessions(sessions);
}

// QA Pairs
export function getQAPairs(): QAPair[] {
  return getItem<QAPair[]>(STORAGE_KEYS.QA_PAIRS, []);
}

export function saveQAPairs(pairs: QAPair[]): void {
  setItem(STORAGE_KEYS.QA_PAIRS, pairs);
}

// Audit Log
export function getAuditLog(): AuditLogEntry[] {
  return getItem<AuditLogEntry[]>(STORAGE_KEYS.AUDIT_LOG, []);
}

// Basic PHI redaction patterns for audit log details
function redactPHI(text: string): string {
  return text
    // SSN patterns
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN REDACTED]')
    // Phone patterns
    .replace(/\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[PHONE REDACTED]')
    // Email in content (not user emails in action context)
    .replace(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, '[EMAIL REDACTED]')
    // Date of birth patterns
    .replace(/\b(DOB|Date of Birth|D\.O\.B\.?)\s*:?\s*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/gi, '[DOB REDACTED]')
    // MRN / Medical Record Numbers
    .replace(/\b(MRN|Medical Record)\s*#?\s*:?\s*\d+/gi, '[MRN REDACTED]');
}

export function addAuditEntry(entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'userId'>): void {
  const log = getAuditLog();
  log.unshift({
    ...entry,
    details: redactPHI(entry.details),
    id: crypto.randomUUID(),
    userId: currentUser().id,
    timestamp: new Date().toISOString(),
  });
  // Keep last 500 entries
  if (log.length > 500) log.length = 500;
  setItem(STORAGE_KEYS.AUDIT_LOG, log);
}
