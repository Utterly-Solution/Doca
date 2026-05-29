export interface ExtractedMetadata {
  patientName?: string;
  dateOfBirth?: string;
  caregiverName?: string;
  serviceDates?: string;
  medications?: string[];
  allergies?: string[];
  emergencyContacts?: string[];
  carePlanGoals?: string[];
  documentType?: string;
  otherFields?: Record<string, string>;
}

export interface DocumentFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content: string;
  uploadDate: string;
  summary?: string;
  analysis?: AnalysisFinding[];
  extractedMetadata?: ExtractedMetadata;
  versions: DocumentVersion[];
  currentVersionIndex: number;
}

export interface DocumentVersion {
  id: string;
  content: string;
  timestamp: string;
  trigger: string;
  label: string;
}

export interface AnalysisFinding {
  severity: 'Critical' | 'Warning' | 'Info';
  section: string;
  description: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  mode?: ChatMode;
  diff?: DiffResult;
  diffStatus?: 'pending' | 'accepted' | 'rejected';
}

export interface DiffResult {
  original: string;
  revised: string;
}

export interface ChatSession {
  id: string;
  documentId: string;
  documentName: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export type ChatMode = 'qa' | 'summary' | 'analysis' | 'edit' | 'extract';

export interface QAPair {
  id: string;
  question: string;
  answer: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details: string;
  timestamp: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Administrator' | 'Care Coordinator' | 'Nurse' | 'Caregiver' | 'Compliance Officer';
  avatar?: string;
}
